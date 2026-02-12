
import React from 'react';
import { Announcement } from '../types';

interface AnnouncementDisplayProps {
  announcement?: Announcement;
}

const AnnouncementDisplay: React.FC<AnnouncementDisplayProps> = ({ announcement }) => {
  if (!announcement) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#212A57]">
        <h2 className="text-white text-4xl font-black">AGUARDANDO COMUNICADO...</h2>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black flex items-center justify-center animate-in fade-in duration-700">
      <img 
        src={announcement.imageUrl} 
        alt="Comunicado" 
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
};

export default AnnouncementDisplay;
