import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBranches, fetchOperations } from '../api';
import type { BranchInfo, OperationInfo } from '../types';

const Home: React.FC = () => {
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [operations, setOperations] = useState<OperationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [b, o] = await Promise.all([fetchBranches(), fetchOperations()]);
        if (!alive) return;

        setBranches(b);
        setOperations(o);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Erro ao carregar listas');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const term = q.trim().toLowerCase();

  const filteredBranches = useMemo(() => {
    if (!term) return branches;
    return branches.filter((b) => {
      return (
        (b.branch_route || '').toLowerCase().includes(term) ||
        (b.branch || '').toLowerCase().includes(term) ||
        (b.branch_name || '').toLowerCase().includes(term)
      );
    });
  }, [branches, term]);

  const filteredOperations = useMemo(() => {
    if (!term) return operations;
    return operations.filter((o) => {
      return (
        (o.operation_code || '').toLowerCase().includes(term) ||
        (o.operation || '').toLowerCase().includes(term)
      );
    });
  }, [operations, term]);

  return (
    <div className="h-screen bg-[#0b1024] text-white flex flex-col">
      <header className="sticky top-0 z-10 bg-[#212A57] border-b border-[#079AE1]/30 px-6 py-5 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">OM Digital</h1>
            <span className="text-[11px] md:text-xs text-[#079AE1] uppercase tracking-[0.22em] font-black">
              Selecione filial ou operação
            </span>
          </div>

          <div className="w-full max-w-md">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por 0121, nome da filial, 515, nome da operação..."
              className="w-full bg-white/10 border border-white/10 focus:border-[#079AE1]/70 outline-none rounded-xl px-4 py-3 text-sm"
            />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
          {loading && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="text-sm text-white/80">Carregando…</div>
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
              <div className="font-bold">Não foi possível carregar</div>
              <div className="text-sm text-white/80 mt-2">{error}</div>
            </div>
          )}

          {!loading && !error && (
            <>
              <section className="space-y-3">
                <div className="text-xs text-[#079AE1] uppercase tracking-[0.22em] font-black">
                  Filiais
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredBranches.map((b) => (
                    <Link
                      key={b.branch_route}
                      to={`/branch/${b.branch_route}`}
                      className="group block bg-white/5 hover:bg-white/8 border border-white/10 hover:border-[#079AE1]/40 rounded-2xl p-5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xl font-black tracking-tight uppercase truncate">
                            {b.branch_name || 'SEM NOME'}
                          </div>
                          <div className="text-xs text-white/70 mt-1">
                            Branch: <span className="font-mono">{b.branch}</span>
                          </div>
                        </div>

                        <div className="shrink-0 bg-[#079AE1]/10 border border-[#079AE1]/20 rounded-xl px-3 py-2">
                          <div className="text-sm font-black font-mono">{b.branch_route}</div>
                          <div className="text-[10px] text-[#079AE1] uppercase tracking-[0.2em] font-black text-center mt-1">
                            /branch
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="text-xs text-[#079AE1] uppercase tracking-[0.22em] font-black">
                  Operações
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredOperations.map((o) => (
                    <Link
                      key={o.operation_code}
                      to={`/operation/${o.operation_code}`}
                      className="group block bg-white/5 hover:bg-white/8 border border-white/10 hover:border-[#079AE1]/40 rounded-2xl p-5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xl font-black tracking-tight uppercase truncate">
                            {o.operation || 'SEM NOME'}
                          </div>
                          <div className="text-xs text-white/70 mt-1">
                            Código: <span className="font-mono">{o.operation_code}</span>
                          </div>
                        </div>

                        <div className="shrink-0 bg-[#079AE1]/10 border border-[#079AE1]/20 rounded-xl px-3 py-2">
                          <div className="text-sm font-black font-mono">{o.operation_code}</div>
                          <div className="text-[10px] text-[#079AE1] uppercase tracking-[0.2em] font-black text-center mt-1">
                            /operation
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              <footer className="pt-2 pb-10">
                <div className="text-xs text-white/50">
                  Rotas: <code className="px-2 py-1 bg-white/10 rounded">/branch/0121</code> e{' '}
                  <code className="px-2 py-1 bg-white/10 rounded">/operation/515</code>
                </div>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Home;
