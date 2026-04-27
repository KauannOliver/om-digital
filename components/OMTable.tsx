import React, { useEffect, useRef, useMemo } from 'react';
import type { MainOrderRow } from '../types';
import { COLORS } from '../constants';

interface OMTableProps {
  rows: MainOrderRow[];
}

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const v = String(s).trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const normalized = v.replace('T', ' ').replace('Z', '');
    const [datePart, timePartRaw] = normalized.split(' ');
    const [y, m, d] = datePart.split('-').map((x) => Number(x));

    let hh = 0,
      mm = 0,
      ss = 0;
    if (timePartRaw) {
      const timePart = timePartRaw.split('.')[0];
      const parts = timePart.split(':');
      hh = Number(parts[0] ?? 0) || 0;
      mm = Number(parts[1] ?? 0) || 0;
      ss = Number(parts[2] ?? 0) || 0;
    }

    const dt = new Date(y, (m || 1) - 1, d || 1, hh, mm, ss);
    return isNaN(dt.getTime()) ? null : dt;
  }

  if (/^\d{2}\/\d{2}\/\d{4}/.test(v)) {
    const [datePart, timePartRaw] = v.split(' ');
    const [dd, mm2, yyyy] = datePart.split('/').map((x) => Number(x));

    let hh = 0,
      mi = 0,
      ss = 0;
    if (timePartRaw) {
      const timePart = timePartRaw.split('.')[0];
      const parts = timePart.split(':');
      hh = Number(parts[0] ?? 0) || 0;
      mi = Number(parts[1] ?? 0) || 0;
      ss = Number(parts[2] ?? 0) || 0;
    }

    const dt = new Date(yyyy, (mm2 || 1) - 1, dd || 1, hh, mi, ss);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const dt = new Date(v);
  return isNaN(dt.getTime()) ? null : dt;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDateShort(s?: string | null) {
  const d = parseDate(s);
  if (!d) return '-';
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${dd}/${mm} ${hh}:${mi}`;
}

function calculateDuration(start?: string | null) {
  const d = parseDate(start);
  if (!d) return '-';
  const diff = Math.max(0, Date.now() - d.getTime());
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  let res = '';
  if (days > 0) res += `${days}d `;
  if (hours > 0 || days > 0) res += `${hours}h `;
  res += `${minutes}min`;
  return res;
}

function isOverdue(prev?: string | null) {
  const d = parseDate(prev);
  if (!d) return false;
  return d.getTime() < Date.now();
}

function statusColor(desc?: string | null) {
  const s = (desc || '').toLowerCase();
  if (s.includes('andamento')) return COLORS.GREEN;
  if (s.includes('aguard') || s.includes('pend')) return COLORS.ORANGE;
  if (s.includes('concl') || s.includes('finaliz')) return COLORS.DARK_RED;
  return COLORS.CYAN;
}

function statusLabel(desc?: string | null) {
  const s = (desc || '').trim().toLowerCase();

  if (s.includes('aguardando execução') || s === 'aguardando') return 'AGUARDANDO EXEC.';
  if (s.includes('atividade conclu') || s.includes('conclu')) return 'ATIV. CONCLUÍDA';
  if (s.includes('em andamento') || s.includes('andamento')) return 'EM ANDAMENTO';

  return (desc || '-').toUpperCase();
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

function publicImg(fileName: string) {
  return `${import.meta.env.BASE_URL}imgs/${stripExt(fileName)}.png`;
}

function familyIconSrc(familyName?: string | null) {
  const s = normalizeFamilyName(familyName);

  if (s.includes('VEICUL') && s.includes('LEVE')) return publicImg('veiculo_leve-removebg-preview');
  if (s.includes('CAMINH')) return publicImg('caminhao-removebg-preview');
  if (s.includes('CAVAL') && s.includes('MECAN')) return publicImg('cavalo_mecanico-removebg-preview');
  if (s.includes('CAVAL')) return publicImg('cavalo_mecanico-removebg-preview');
  if (s.includes('SEMI') || s.includes('REBOQ')) return publicImg('semi_reboque-removebg-preview');
  if (s.includes('CARROCER')) return publicImg('semi_reboque-removebg-preview');
  if (s.includes('TRATOR')) return publicImg('trator-removebg-preview');
  if (s.includes('MAQUIN')) return publicImg('maquina-removebg-preview');
  if (s.includes('EMPIL')) return publicImg('empilhadeira-removebg-preview');
  if (s.includes('ONIBUS')) return publicImg('onibus-removebg-preview');
  if (s.includes('EQUIP')) return publicImg('equipamentos-removebg-preview');
  if (s.includes('AERONAV') || s.includes('AERONAVE') || s.includes('AVIAO')) return publicImg('aeronave-removebg-preview');

  return publicImg('maquina-removebg-preview');
}

const OMTable: React.FC<OMTableProps> = ({ rows }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRequestRef = useRef<number | null>(null);

  const sortedRows = useMemo(() => {
    const now = Date.now();

    const dueMs = (r: MainOrderRow) => {
      const d = parseDate(r.PREVTERMINO);
      return d ? d.getTime() : Number.POSITIVE_INFINITY;
    };

    const anyOverdue = rows.some((r) => {
      const ms = dueMs(r);
      return ms !== Number.POSITIVE_INFINITY && ms < now;
    });

    const arr = [...rows];

    arr.sort((a, b) => {
      const aDue = dueMs(a);
      const bDue = dueMs(b);

      const aIsOver = aDue < now;
      const bIsOver = bDue < now;

      if (anyOverdue) {
        if (aIsOver && bIsOver) {
          const aDiff = now - aDue;
          const bDiff = now - bDue;
          return bDiff - aDiff;
        }
        if (aIsOver && !bIsOver) return -1;
        if (!aIsOver && bIsOver) return 1;

        return aDue - bDue;
      }

      return aDue - bDue;
    });

    return arr;
  }, [rows]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let pauseStartTime = 0;
    let state: 'TOP_PAUSE' | 'SCROLLING_DOWN' | 'BOTTOM_PAUSE' | 'SCROLLING_UP' = 'TOP_PAUSE';

    const PAUSE_DURATION = 5000;
    const SCROLL_SPEED = 0.6;

    const animate = (timestamp: number) => {
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const maxScroll = Math.max(0, scrollHeight - clientHeight);

      if (maxScroll <= 0) {
        scrollRequestRef.current = requestAnimationFrame(animate);
        return;
      }

      switch (state) {
        case 'TOP_PAUSE':
          if (!pauseStartTime) pauseStartTime = timestamp;
          if (timestamp - pauseStartTime > PAUSE_DURATION) {
            state = 'SCROLLING_DOWN';
            pauseStartTime = 0;
          }
          break;

        case 'SCROLLING_DOWN':
          container.scrollTop += SCROLL_SPEED;
          if (container.scrollTop >= maxScroll - 1) {
            container.scrollTop = maxScroll;
            state = 'BOTTOM_PAUSE';
          }
          break;

        case 'BOTTOM_PAUSE':
          if (!pauseStartTime) pauseStartTime = timestamp;
          if (timestamp - pauseStartTime > PAUSE_DURATION) {
            state = 'SCROLLING_UP';
            pauseStartTime = 0;
          }
          break;

        case 'SCROLLING_UP':
          container.scrollTop -= SCROLL_SPEED;
          if (container.scrollTop <= 1) {
            container.scrollTop = 0;
            state = 'TOP_PAUSE';
          }
          break;
      }

      scrollRequestRef.current = requestAnimationFrame(animate);
    };

    scrollRequestRef.current = requestAnimationFrame(animate);
    return () => {
      if (scrollRequestRef.current) cancelAnimationFrame(scrollRequestRef.current);
    };
  }, [sortedRows]);

  const cellStyle = 'text-center text-[#374151] font-bold text-[13px] tracking-tight';

  if (!sortedRows.length) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-white">
        <div className="text-[#212A57] font-black text-xl">Nenhuma OM em aberto para esta filial.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-white">
      <div className="grid grid-cols-[90px_110px_80px_150px_90px_110px_120px_110px_1fr] bg-[#079AE1] text-white font-black text-[10px] py-4 px-2 uppercase tracking-wider items-center sticky top-0 z-20 shadow-md">
        <div className="text-center">OM</div>
        <div className="text-center">Placa</div>
        <div className="text-center">Família</div>
        <div className="text-center">Status</div>
        <div className="text-center">Serv.</div>
        <div className="text-center">Início</div>
        <div className="text-center">Previsão</div>
        <div className="text-center">Duração</div>
        <div className="text-left px-3">Resp. Abertura</div>
      </div>

      <div ref={containerRef} className="flex-grow overflow-y-hidden" style={{ scrollBehavior: 'auto' }}>
        {sortedRows.map((r) => {
          const overdue = isOverdue(r.PREVTERMINO);

          return (
            <div
              key={`${r.id}-${r.number}`}
              className={[
                'grid grid-cols-[90px_110px_80px_150px_90px_110px_120px_110px_1fr] border-b py-3 px-2 items-center',
                overdue ? 'bg-red-200 border-red-300' : 'bg-white border-gray-100'
              ].join(' ')}
            >
              <div className={cellStyle} title={`ID: ${r.id}`}>
                {String(r.number ?? '').replace(/\D/g, '').padStart(6, '0')}
              </div>

              <div className={`${cellStyle} uppercase`}>{(r.asset_plate || '-').replace(/-/g, '')}</div>

              <div className="flex items-center justify-center" title={r.asset_family_name || '-'}>
                <img
                  src={familyIconSrc(r.asset_family_name)}
                  alt={r.asset_family_name || 'FAMÍLIA'}
                  className="w-13 h-9 object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>

              <div className="flex justify-center">
                <span
                  className="px-1.5 py-1 rounded-md text-white text-[10px] font-black min-w-[130px] text-center shadow-sm"
                  style={{ backgroundColor: statusColor(r.status_description) }}
                  title={`Status code: ${r.status ?? '-'}`}
                >
                  {statusLabel(r.status_description)}
                </span>
              </div>

              <div className={cellStyle}>{r.service_code || '-'}</div>

              <div className={cellStyle}>{formatDateShort(r.INICIOPARADA)}</div>

              <div className={cellStyle} style={{ color: overdue ? COLORS.DARK_RED : '#374151' }}>
                {formatDateShort(r.PREVTERMINO)}
              </div>

              <div className={cellStyle}>{calculateDuration(r.INICIOPARADA)}</div>

              <div
                className="px-3 text-left truncate text-[#374151] font-bold text-[13px] uppercase"
                title={r.resp_register_name || ''}
              >
                {r.resp_register_name || '-'}
              </div>
            </div>
          );
        })}
        <div className="h-8 w-full"></div>
      </div>
    </div>
  );
};

export default OMTable;