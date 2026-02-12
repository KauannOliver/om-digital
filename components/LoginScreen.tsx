import React, { useState } from 'react';
import { ASSETS } from '../constants';
import { LOGIN_CREDENTIALS } from '../constants';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onCancel: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onCancel }) => {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (user === LOGIN_CREDENTIALS.user && pass === LOGIN_CREDENTIALS.pass) {
      onLoginSuccess();
    } else {
      setError('Credenciais inválidas. Tente novamente.');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#212A57] flex flex-col items-center justify-center z-[100] p-6 animate-in zoom-in duration-300">
      <div className="w-full max-w-md bg-white/10 p-12 rounded-3xl border border-white/20 backdrop-blur-xl shadow-2xl">
        <div className="flex justify-center mb-10">
          <img src={ASSETS.LOGO} alt="OM Digital Logo" className="h-10 object-contain" />
        </div>
        
        <h2 className="text-white text-3xl font-black text-center mb-8 tracking-tight">ÁREA RESTRITA</h2>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-white text-xs font-black mb-2 tracking-widest uppercase">Usuário</label>
            <input 
              type="text" 
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full bg-white/10 border border-white/30 rounded-xl px-6 py-4 text-white text-xl font-bold focus:outline-none focus:border-[#079AE1] transition-all"
              placeholder="Digite o usuário"
            />
          </div>
          <div>
            <label className="block text-white text-xs font-black mb-2 tracking-widest uppercase">Senha</label>
            <input 
              type="password" 
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full bg-white/10 border border-white/30 rounded-xl px-6 py-4 text-white text-xl font-bold focus:outline-none focus:border-[#079AE1] transition-all"
              placeholder="Digite a senha"
            />
          </div>
          
          {error && <p className="text-red-400 text-sm font-bold text-center">{error}</p>}

          <div className="flex flex-col gap-4 mt-10">
            <button 
              type="submit"
              className="w-full bg-[#079AE1] hover:bg-[#079AE1]/80 text-white py-4 rounded-xl font-black text-xl transition-all shadow-lg active:scale-95"
            >
              ENTRAR
            </button>
            <button 
              type="button"
              onClick={onCancel}
              className="w-full text-white/50 hover:text-white font-bold transition-colors"
            >
              CANCELAR
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
