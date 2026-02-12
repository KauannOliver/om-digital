import React, { useEffect, useMemo, useState } from 'react';
import type { Announcement, BranchInfo } from '../types';
import { ASSETS, COLORS } from '../constants';
import { fetchBranches } from '../api';

interface AnnouncementManagerProps {
  onAdd: (announcement: Announcement) => void;
  onCancel: () => void;
}

function todayPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

const AnnouncementManager: React.FC<AnnouncementManagerProps> = ({ onAdd, onCancel }) => {
  const [imageUrl, setImageUrl] = useState<string>(ASSETS.ANNOUNCEMENT_DEFAULT);
  const [durationSeconds, setDurationSeconds] = useState<number>(10);
  const [expirationDate, setExpirationDate] = useState<string>(todayPlusDays(30));

  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  // Alvos selecionados: branch_route (ex: "0123") ou "*" (todas)
  const [targets, setTargets] = useState<string[]>(['*']);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoadingBranches(true);
        setBranchesError(null);
        const data = await fetchBranches();
        if (!alive) return;
        setBranches(data);
      } catch (e: any) {
        if (!alive) return;
        setBranchesError(e?.message || 'Erro ao carregar filiais');
      } finally {
        if (!alive) return;
        setLoadingBranches(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const branchesSorted = useMemo(() => {
    return [...branches].sort((a, b) => (a.branch_route || '').localeCompare(b.branch_route || ''));
  }, [branches]);

  const toggleTarget = (branchRoute: string) => {
    setTargets((prev) => {
      const hasAll = prev.includes('*');

      if (branchRoute === '*') {
        // Se marcou "Todas", vira só ["*"]
        return ['*'];
      }

      // se estava em "*", remove "*" e adiciona a filial
      const base = hasAll ? [] : prev;

      if (base.includes(branchRoute)) {
        const next = base.filter((x) => x !== branchRoute);
        return next.length ? next : ['*']; // se tirou tudo, volta para todas
      }

      return [...base, branchRoute];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newAnnouncement: Announcement = {
      id: `ann-${Date.now()}`,
      imageUrl: imageUrl?.trim() || ASSETS.ANNOUNCEMENT_DEFAULT,
      durationSeconds: Math.max(3, Math.min(120, Number(durationSeconds) || 10)),
      expirationDate,
      operations: targets
    };

    onAdd(newAnnouncement);
  };

  return (
    <div className="h-full w-full p-6 bg-[#0b1024] overflow-auto">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-[#079AE1] text-xs uppercase tracking-[0.22em] font-black">Gerenciar</div>
            <h2 className="text-2xl font-black text-[#212A57]">Novo comunicado</h2>
          </div>

          <button
            onClick={onCancel}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-black px-4 py-2 rounded-xl"
          >
            Voltar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
            <div className="text-sm font-black text-[#212A57] mb-3 uppercase tracking-wider">
              Pré-visualização
            </div>

            <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
              <img
                src={imageUrl || ASSETS.ANNOUNCEMENT_DEFAULT}
                alt="Preview comunicado"
                className="w-full h-[260px] object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = ASSETS.ANNOUNCEMENT_DEFAULT;
                }}
              />
            </div>

            <div className="mt-4 text-sm text-gray-700">
              <div><b>Duração:</b> {durationSeconds}s</div>
              <div><b>Expira em:</b> {expirationDate}</div>
              <div className="mt-2">
                <b>Alvo:</b>{' '}
                {targets.includes('*')
                  ? 'Todas as filiais'
                  : targets.join(', ')}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-black text-gray-600 uppercase tracking-wider mb-2">
                URL da imagem
              </label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#079AE1]/60"
                placeholder="https://..."
              />
              <div className="text-[11px] text-gray-500 mt-2">
                Se quebrar, usamos a imagem padrão.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-600 uppercase tracking-wider mb-2">
                  Duração (seg)
                </label>
                <input
                  type="number"
                  min={3}
                  max={120}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#079AE1]/60"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-600 uppercase tracking-wider mb-2">
                  Expiração
                </label>
                <input
                  type="datetime-local"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#079AE1]/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-600 uppercase tracking-wider mb-2">
                Filiais alvo
              </label>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                <button
                  type="button"
                  onClick={() => toggleTarget('*')}
                  className={`w-full mb-3 px-4 py-3 rounded-xl font-black border transition-colors ${
                    targets.includes('*')
                      ? 'bg-[#079AE1] text-white border-[#079AE1]'
                      : 'bg-white text-[#212A57] border-gray-200 hover:border-[#079AE1]/40'
                  }`}
                >
                  Todas as filiais
                </button>

                {loadingBranches && (
                  <div className="text-sm text-gray-600 font-bold">Carregando filiais…</div>
                )}

                {!loadingBranches && branchesError && (
                  <div className="text-sm text-red-700 font-bold">{branchesError}</div>
                )}

                {!loadingBranches && !branchesError && (
                  <div className="max-h-56 overflow-auto grid grid-cols-1 gap-2 pr-1">
                    {branchesSorted.map((b) => {
                      const selected = targets.includes(b.branch_route) && !targets.includes('*');
                      return (
                        <button
                          key={b.branch_route}
                          type="button"
                          onClick={() => toggleTarget(b.branch_route)}
                          className={`px-4 py-3 rounded-xl font-black border text-left transition-colors ${
                            selected
                              ? 'bg-[#212A57] text-white border-[#212A57]'
                              : 'bg-white text-[#212A57] border-gray-200 hover:border-[#079AE1]/40'
                          }`}
                          title={b.branch}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate uppercase">{b.branch_name || 'SEM NOME'}</div>
                            <div className="font-mono text-xs bg-black/5 px-2 py-1 rounded-lg">
                              {b.branch_route}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#F36229] hover:opacity-90 text-white font-black px-5 py-3 rounded-xl"
              >
                SALVAR COMUNICADO
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-black px-5 py-3 rounded-xl"
              >
                CANCELAR
              </button>
            </div>

            <div className="text-[11px] text-gray-500">
              * Esses comunicados ainda ficam em memória (estado do app). Se você quiser persistir no banco depois, a gente cria tabela/endpoint.
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 text-xs text-gray-500">
          Cores: <span style={{ color: COLORS.NAVY }} className="font-black">NAVY</span>{' '}
          <span style={{ color: COLORS.CYAN }} className="font-black">CYAN</span>{' '}
          <span style={{ color: COLORS.ORANGE }} className="font-black">ORANGE</span>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementManager;
