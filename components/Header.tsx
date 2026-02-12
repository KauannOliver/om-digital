import React, { useState, useEffect } from 'react';
import { ASSETS } from '../constants';

interface HeaderProps {
  title: string;
  operation: string;
  lastUpdate: Date;
  onLogoClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, operation, lastUpdate, onLogoClick }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) =>
    date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  return (
    <header className="h-20 bg-[#212A57] border-b border-[#079AE1]/30 flex items-center justify-between px-8 text-white z-50">
      <div className="flex items-center gap-6">
        <div onClick={onLogoClick} className="cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-4">
          <div className="bg-transparent p-2 rounded-lg flex items-center justify-center">
            <img src={ASSETS.LOGO} alt="OM Digital Logo" className="h-10 object-contain" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-10">
        <div className="max-w-[520px] text-right">
          <span className="text-3xl font-black tracking-tighter uppercase truncate block">
            {operation}
          </span>
        </div>

        <div className="text-3xl font-mono font-black bg-[#079AE1]/10 px-6 py-2 rounded-full border border-[#079AE1]/20">
          {formatDate(time).split(' ')[1]}
        </div>
      </div>
    </header>
  );
};

export default Header;
