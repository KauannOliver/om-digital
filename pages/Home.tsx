import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGlobalData } from '../components/GlobalDataContext';

function normalizeName(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameMatches(name: string | null | undefined, query: string) {
  const normalizedName = normalizeName(name);
  const normalizedQuery = normalizeName(query);

  if (!normalizedQuery) return true;
  if (!normalizedName) return false;

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return tokens.every((token) => normalizedName.includes(token));
}

const Home: React.FC = () => {
  const { branches, operations, initialLoading: loading, error } = useGlobalData();
  const [q, setQ] = useState('');
  const [submittedQ, setSubmittedQ] = useState('');

  const filteredBranches = useMemo(() => {
    if (!submittedQ.trim()) return branches;
    
    const qStr = normalizeName(submittedQ);
    const qNoSpaces = qStr.replace(/\s+/g, '');
    const isOnlyNumbers = /^\d+$/.test(qNoSpaces);
    const tokens = qStr.split(' ').filter(Boolean);

    return branches.filter((b) => {
      const texts = [b.branch_name, b.branch, b.branch_route].map(normalizeName);
      
      // Match forte com toda a string junta (ideal p/ remover espaços de buscas)
      const unifiedNoSpaces = texts.map(t => t.replace(/\s+/g, '')).join('@@');
      if (unifiedNoSpaces.includes(qNoSpaces)) return true;

      // Se for apenas número, restringimos para não dar match cruzado (ex: 01 01 nos tokens = true default)
      if (isOnlyNumbers) return false;

      // Fallback: match flexível por tokens (ex: MATRIZ 01)
      const unified = texts.join(' ');
      return tokens.every(token => unified.includes(token));
    });
  }, [branches, submittedQ]);

  const filteredOperations = useMemo(() => {
    if (!submittedQ.trim()) return operations;
    
    const qStr = normalizeName(submittedQ);
    const qNoSpaces = qStr.replace(/\s+/g, '');
    const isOnlyNumbers = /^\d+$/.test(qNoSpaces);
    const tokens = qStr.split(' ').filter(Boolean);

    return operations.filter((o) => {
      const texts = [o.operation, o.operation_code].map(normalizeName);
      
      const unifiedNoSpaces = texts.map(t => t.replace(/\s+/g, '')).join('@@');
      if (unifiedNoSpaces.includes(qNoSpaces)) return true;

      if (isOnlyNumbers) return false;

      const unified = texts.join(' ');
      return tokens.every(token => unified.includes(token));
    });
  }, [operations, submittedQ]);

  return (
    <div className="h-screen flex flex-col bg-[#0b1024] text-white">
      <header className="shrink-0 sticky top-0 z-10 bg-[#212A57] border-b border-[#079AE1]/30 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">
              OM Digital
            </h1>
            <span className="text-[11px] md:text-xs text-[#079AE1] uppercase tracking-[0.22em] font-black">
              Selecione filial ou operação
            </span>
          </div>

          <div className="w-full max-w-md flex gap-2">
            <div className="relative flex-grow">
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  if (e.target.value === '') setSubmittedQ('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSubmittedQ(q);
                }}
              placeholder="Buscar pelo nome da filial ou operação..."
              className="w-full bg-white/10 border border-white/10 focus:border-[#079AE1]/70 outline-none rounded-xl px-4 py-3 text-sm"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setSubmittedQ('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
              >
                ✕
              </button>
            )}
            </div>
            <button
              onClick={() => setSubmittedQ(q)}
              className="bg-[#079AE1] hover:opacity-90 text-white font-black px-5 py-3 rounded-xl transition-all"
            >
              BUSCAR
            </button>
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
              <div className="font-bold">Aviso</div>
              <div className="text-sm text-white/80 mt-2">{error}</div>
            </div>
          )}

          {!loading && (
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
                            Filial: <span className="font-mono">{b.branch}</span>
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

                {filteredBranches.length === 0 && (
                  <div className="text-sm text-white/70 font-bold">
                    Nenhuma filial encontrada.
                  </div>
                )}
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

                {filteredOperations.length === 0 && (
                  <div className="text-sm text-white/70 font-bold">
                    Nenhuma operação encontrada.
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <footer className="shrink-0 max-w-6xl mx-auto px-6 pb-6 pt-2 w-full">
        <div className="text-xs text-white/50">
          Rotas: <code className="px-2 py-1 bg-white/10 rounded">/branch/0902</code> e{' '}
          <code className="px-2 py-1 bg-white/10 rounded">/operation/23</code>
        </div>
      </footer>
    </div>
  );
};

export default Home;