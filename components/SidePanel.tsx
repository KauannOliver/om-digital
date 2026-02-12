import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MainOrderRow, AssetFamilySummary } from '../types';
import { COLORS } from '../constants';
import { fetchAssetsSummaryByBranch, fetchAssetsSummaryByOperation } from '../api';

interface SidePanelProps {
  rows: MainOrderRow[];
  scope: { mode: 'branch' | 'operation'; code: string };
  lastUpdate: Date;
}

function normPlate(p?: string | null) {
  return (p || '').toUpperCase().replace(/[-\s]/g, '').trim();
}

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const v = String(s).trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const normalized = v.includes('T') ? v : v.replace(' ', 'T');
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{2}\/\d{2}\/\d{4}/.test(v)) {
    const [datePart, timePartRaw] = v.split(' ');
    const [dd, mm, yyyy] = datePart.split('/').map((x) => Number(x));

    let hh = 0,
      mi = 0,
      ss = 0;
    if (timePartRaw) {
      const parts = timePartRaw.split(':');
      hh = Number(parts[0] ?? 0) || 0;
      mi = Number(parts[1] ?? 0) || 0;
      ss = Number(parts[2] ?? 0) || 0;
    }

    const d = new Date(yyyy, (mm || 1) - 1, dd || 1, hh, mi, ss);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateTimePtBR(date: Date) {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function hexToRgba(hex: string, alpha: number) {
  const h = (hex || '').replace('#', '').trim();
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function stripExt(name: string) {
  return name.replace(/\.png$/i, '');
}

function normalizeFamilyName(v?: string | null) {
  return (v || '')
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function familyIconSrc(familyName?: string | null) {
  const s = normalizeFamilyName(familyName);

  if (s.includes('VEICUL') && s.includes('LEVE'))
    return `/imgs/${stripExt('veiculo_leve-removebg-preview')}.png`;
  if (s.includes('CAMINH')) return `/imgs/${stripExt('caminhao-removebg-preview')}.png`;
  if (s.includes('CAVAL') && s.includes('MECAN'))
    return `/imgs/${stripExt('cavalo_mecanico-removebg-preview')}.png`;
  if (s.includes('CAVAL')) return `/imgs/${stripExt('cavalo_mecanico-removebg-preview')}.png`;
  if (s.includes('SEMI') || s.includes('REBOQ'))
    return `/imgs/${stripExt('semi_reboque-removebg-preview')}.png`;
  if (s.includes('CARROCER')) return `/imgs/${stripExt('semi_reboque-removebg-preview')}.png`;
  if (s.includes('TRATOR')) return `/imgs/${stripExt('trator-removebg-preview')}.png`;
  if (s.includes('MAQUIN')) return `/imgs/${stripExt('maquina-removebg-preview')}.png`;
  if (s.includes('EMPIL')) return `/imgs/${stripExt('empilhadeira-removebg-preview')}.png`;
  if (s.includes('ONIBUS')) return `/imgs/${stripExt('onibus-removebg-preview')}.png`;
  if (s.includes('EQUIP')) return `/imgs/${stripExt('equipamentos-removebg-preview')}.png`;
  if (s.includes('AERONAV') || s.includes('AERONAVE') || s.includes('AVIAO'))
    return `/imgs/${stripExt('aeronave-removebg-preview')}.png`;

  return `/imgs/${stripExt('maquina-removebg-preview')}.png`;
}

type UnavailableFamilyEntry = {
  key: string;
  name: string;
  plates: Set<string>;
};

function isAbortLike(e: any) {
  const name = String(e?.name || '');
  const msg = String(e?.message || '').toLowerCase();
  return name === 'AbortError' || msg.includes('aborted') || msg.includes('signal is aborted');
}

function statusBucket(desc?: string | null) {
  const s = (desc || '').trim().toLowerCase();
  if (s.includes('aguardando execução') || s === 'aguardando') return 'AGUARDANDO EXEC.';
  if (s.includes('em andamento') || s.includes('andamento')) return 'EM ANDAMENTO';
  if (s.includes('atividade conclu') || s.includes('conclu')) return 'ATVD. CONCLUÍDA';
  return 'OUTROS';
}


const SidePanel: React.FC<SidePanelProps> = ({ rows, scope, lastUpdate }) => {
  const [summary, setSummary] = useState<AssetFamilySummary[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'refreshing' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);

  const summaryRef = useRef<AssetFamilySummary[]>([]);
  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  const indisponibilidadeCount = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const p = normPlate(r.asset_plate);
      if (p) set.add(p);
    }
    return set.size;
  }, [rows]);

  const prevLibVencidaCount = useMemo(() => {
    const now = Date.now();
    let n = 0;
    for (const r of rows) {
      const d = parseDate(r.PREVTERMINO);
      if (d && d.getTime() < now) n++;
    }
    return n;
  }, [rows]);

  const statusBreakdown = useMemo(() => {
    const total = rows.length || 0;

    const counts: Record<string, number> = {
      'AGUARDANDO EXEC.': 0,
      'EM ANDAMENTO': 0,
      'ATVD. CONCLUÍDA': 0
    };

    for (const r of rows) {
      const b = statusBucket(r.status_description);
      if (b in counts) counts[b] += 1;
    }

    const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

    return {
      total,
      rows: [
        {
          label: 'AGUARDANDO EXEC.',
          count: counts['AGUARDANDO EXEC.'],
          pct: pct(counts['AGUARDANDO EXEC.'])
        },
        { label: 'EM ANDAMENTO', count: counts['EM ANDAMENTO'], pct: pct(counts['EM ANDAMENTO']) },
        { label: 'ATVD. CONCLUÍDA', count: counts['ATVD. CONCLUÍDA'], pct: pct(counts['ATVD. CONCLUÍDA']) }
      ],
      overduePct: total > 0 ? (prevLibVencidaCount / total) * 100 : 0
    };
  }, [rows, prevLibVencidaCount]);

  const unavailableByFamily = useMemo(() => {
    const map = new Map<string, UnavailableFamilyEntry>();

    for (const r of rows) {
      const plate = normPlate(r.asset_plate);
      if (!plate) continue;

      const famCode = (r.asset_family || '').toUpperCase().trim();
      const famName = (r.asset_family_name || 'SEM FAMÍLIA').toUpperCase().trim();
      const key = famCode || famName;

      if (!map.has(key)) map.set(key, { key, name: famName, plates: new Set<string>() });
      map.get(key)!.plates.add(plate);
    }

    return map;
  }, [rows]);

  useEffect(() => {
    const code = (scope?.code || '').trim();
    if (!code) {
      abortRef.current?.abort();
      setSummary([]);
      setStatus('idle');
      setErrorMsg('');
      return;
    }

    let alive = true;

    const runFetch = async () => {
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      const myReqId = ++reqIdRef.current;

      setStatus((prev) => {
        if (prev === 'ready' || prev === 'refreshing') return 'refreshing';
        if (summaryRef.current.length > 0) return 'refreshing';
        return 'loading';
      });
      setErrorMsg('');

      try {
        const data =
          scope.mode === 'branch'
            ? await fetchAssetsSummaryByBranch(code, { signal: controller.signal, timeoutMs: 60_000 })
            : await fetchAssetsSummaryByOperation(code, { signal: controller.signal, timeoutMs: 60_000 });

        if (!alive) return;
        if (myReqId !== reqIdRef.current) return;

        setSummary(Array.isArray(data) ? data : []);
        setStatus('ready');
      } catch (e: any) {
        if (!alive) return;
        if (myReqId !== reqIdRef.current) return;

        if (isAbortLike(e)) {
          setStatus((prev) => {
            if (prev === 'loading') return summaryRef.current.length > 0 ? 'ready' : 'idle';
            if (prev === 'refreshing') return 'ready';
            return prev;
          });
          return;
        }

        const msg = e?.message || 'Falha ao carregar cadastro (asset_view)';
        setErrorMsg(msg);
        setStatus(summaryRef.current.length > 0 ? 'ready' : 'error');
      }
    };

    runFetch();

    const t = window.setInterval(runFetch, 60_000);

    return () => {
      alive = false;
      window.clearInterval(t);
      abortRef.current?.abort();
    };
  }, [scope.mode, scope.code]);

  const totalVehicles = useMemo(() => {
    const sum = (summary || []).reduce((acc, s) => acc + Number(s.total_plates || 0), 0);
    return sum;
  }, [summary]);

  const indisponibilidadePct = useMemo(() => {
    if (!totalVehicles || totalVehicles <= 0) return null;
    return (indisponibilidadeCount / totalVehicles) * 100;
  }, [indisponibilidadeCount, totalVehicles]);

  const disponibilidadeAtual = useMemo(() => {
    const list = (summary || []).map((s) => {
      const code = (s.family || '').toUpperCase().trim();
      const name = (s.family_name || 'SEM FAMÍLIA').toUpperCase().trim();
      const total = Number(s.total_plates || 0);

      const entry = unavailableByFamily.get(code) || unavailableByFamily.get(name);
      const indisps = entry ? entry.plates.size : 0;
      const disp = Math.max(0, total - indisps);

      return {
        key: code || name,
        family_name: name,
        total,
        disp,
        indisps
      };
    });

    for (const entry of unavailableByFamily.values()) {
      const exists = list.some((x) => x.key === entry.key || x.family_name === entry.name);
      if (!exists) {
        const indisps = entry.plates.size;
        list.push({
          key: entry.key,
          family_name: entry.name,
          total: indisps,
          disp: 0,
          indisps
        });
      }
    }

    list.sort((a, b) => (b.indisps - a.indisps) || (b.total - a.total));
    return list.slice(0, 10);
  }, [summary, unavailableByFamily]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex-[0_0_22%] bg-white rounded-xl shadow-xl p-4 flex items-center relative overflow-hidden border-l-8 border-[#F36229]">
          <div className="flex items-center w-full h-full">
            <div className="w-[35%] flex justify-center items-center text-[#F36229] border-r border-gray-100 pr-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="56"
                height="56"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M7 8h10" />
                <path d="M7 12h10" />
                <path d="M7 16h6" />
              </svg>
            </div>

            <div className="w-[65%] flex flex-col items-center justify-center pl-2">
              <span className="text-[15px] font-black text-[#212A57] uppercase tracking-wide leading-tight text-center">
                INDISPONIBILIDADE
              </span>

              <span className="text-5xl font-black text-[#F36229] tracking-tighter leading-none">
                {indisponibilidadeCount}
              </span>

              <span className="mt-1 text-[15px] font-black uppercase tracking-wider text-[#212A57]/70">
                {indisponibilidadePct == null ? '—' : `${Math.round(indisponibilidadePct)}%`} do total
              </span>
            </div>
          </div>
        </div>

        <div className="flex-[0_0_30%] bg-white rounded-xl shadow-xl p-4 flex flex-col relative overflow-hidden border-l-8 border-red-700 min-h-0">
          {(() => {
            const STATUS_META = [
              { label: 'AGUARDANDO EXEC.', color: COLORS.ORANGE },
              { label: 'EM ANDAMENTO', color: COLORS.GREEN },
              { label: 'ATVD. CONCLUÍDA', color: COLORS.DARK_RED }
            ] as const;

            const total = statusBreakdown.total || 0;
            const overduePctRounded = total > 0 ? Math.round(statusBreakdown.overduePct) : 0;

            return (
              <div className="flex flex-col h-full min-h-0">
                <div className="flex items-center justify-between gap-3 mb-3 border-b border-gray-100 pb-2">
                  <span className="text-sm font-black text-[#212A57] uppercase tracking-widest">
                    PREV. LIB. VENCIDA
                  </span>

                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-red-700 tracking-tighter leading-none">
                      {prevLibVencidaCount}
                    </span>
                    <span className="text-2xl font-black text-black uppercase tracking-wider">
                      {total > 0 ? `(${overduePctRounded}%)` : '(0%)'}
                    </span>
                  </div>
                </div>

                <div className="flex-grow min-h-0 flex flex-col gap-3 overflow-hidden">
                  {STATUS_META.map((m) => {
                    const row = statusBreakdown.rows.find((r) => r.label === m.label);
                    const count = row?.count ?? 0;
                    const pct = row ? Math.round(row.pct) : 0;

                    return (
                      <div key={m.label} className="flex items-center gap-3">
                        <div
                          className="h-8 w-12 rounded-md flex items-center justify-center border"
                          style={{
                            backgroundColor: hexToRgba(m.color, 0.10),
                            borderColor: hexToRgba(m.color, 0.22)
                          }}
                          title={m.label}
                        >
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                        </div>

                        <div className="flex-grow min-w-0">
                          <div className="flex justify-between items-center gap-3">
                            <span
                              className="text-[11px] font-black text-gray-600 uppercase tracking-tight truncate"
                              title={m.label}
                            >
                              {m.label}
                            </span>

                            <span className="text-[12px] font-black text-[#212A57] leading-none whitespace-nowrap">
                              {count}{' '}
                              <span style={{ color: m.color }} className="font-black">
                                ({pct}%)
                              </span>
                            </span>
                          </div>

                          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full transition-all duration-700 shadow-sm"
                              style={{
                                width: `${Math.max(3, Math.min(100, pct))}%`,
                                backgroundColor: m.color
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex-1 min-h-0 bg-white rounded-xl shadow-xl p-4 flex flex-col relative overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-3 border-b border-gray-100 pb-2">
            <span className="text-sm font-black text-[#212A57] uppercase tracking-widest">
              DISPONIBILIDADE ATUAL
            </span>

            {status === 'refreshing' && (
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                atualizando…
              </span>
            )}
          </div>

          <div className="flex-grow flex flex-col gap-3 overflow-hidden">
            {status === 'loading' && summary.length === 0 ? (
              <div className="text-gray-500 font-bold">Carregando cadastro</div>
            ) : status === 'error' && summary.length === 0 ? (
              <div className="text-red-700 font-black">
                Falha ao carregar cadastro.
                <div className="text-[11px] font-bold text-gray-600 mt-1">{errorMsg}</div>
              </div>
            ) : disponibilidadeAtual.length === 0 ? (
              <div className="text-gray-500 font-bold">Sem dados do cadastro para este escopo.</div>
            ) : (
              disponibilidadeAtual.map((f) => {
                const ratio = f.total > 0 ? (f.disp / f.total) * 100 : 0;

                return (
                  <div key={f.key} className="flex items-center gap-3">
                    <div className="h-9 w-12 rounded-md bg-transparent-50 flex items-center justify-center">
                      <img
                        src={familyIconSrc(f.family_name)}
                        alt={f.family_name}
                        className="w-12 h-9 object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>

                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-center gap-3">
                        <span
                          className="text-[11px] font-black text-gray-600 uppercase tracking-tight truncate"
                          title={f.family_name}
                        >
                          {f.family_name}
                        </span>

                        <span className="text-[12px] font-black text-[#212A57] leading-none whitespace-nowrap">
                          {f.disp}/{f.total}{' '}
                          <span className="text-red-700">({f.indisps} INDISP.)</span>
                        </span>
                      </div>

                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full transition-all duration-700 shadow-sm"
                          style={{
                            width: `${Math.max(3, Math.min(100, ratio))}%`,
                            backgroundColor: f.indisps > 0 ? COLORS.ORANGE : COLORS.CYAN
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 text-center">
        <div className="text-[12px] text-white font-black uppercase tracking-[0.22em]">
          Última atualização: {formatDateTimePtBR(lastUpdate)}
        </div>
      </div>
    </div>
  );
};

export default SidePanel;
