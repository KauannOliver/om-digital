import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0b1024] text-white flex items-center justify-center px-6">
      <div className="max-w-lg w-full bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="text-[#079AE1] text-xs uppercase tracking-[0.22em] font-black">
          404
        </div>

        <h1 className="text-3xl font-black tracking-tight mt-2">
          Página não encontrada
        </h1>

        <p className="text-sm text-white/80 mt-3">
          A rota que você acessou não existe. Volte para a lista de filiais e escolha uma rota válida (ex:{' '}
          <span className="font-mono">/0123</span>).
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center bg-[#079AE1] text-[#0b1024] font-black px-5 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Voltar para filiais
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
