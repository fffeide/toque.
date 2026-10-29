import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../components/ui/Avatar';
import { ArrowLeft, Compass, Wallet } from 'lucide-react';

export const NotFoundView: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F6] flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full rounded-[32px] bg-[#141414] border border-[#242424] p-8 text-center space-y-5 shadow-2xl">
        <div className="flex justify-center">
          <BrandLogo variant="isotipo" size="md" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D95B26]/15 border border-[#D95B26]/30 text-[#D95B26] text-xs font-semibold">
          <Compass className="w-3.5 h-3.5" />
          <span>Error 404 · Página no encontrada</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            No encontramos esta dirección
          </h1>
          <p className="text-xs text-[#9E9EA8] leading-relaxed">
            Es posible que el enlace haya cambiado o que el código del cartel esté mal escrito.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Link
            to="/"
            className="w-full sm:w-auto flex-1 py-3 px-4 rounded-2xl bg-[#D95B26] hover:bg-[#e56732] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ir al inicio</span>
          </Link>

          <Link
            to="/toquecitos"
            className="w-full sm:w-auto flex-1 py-3 px-4 rounded-2xl bg-[#1C1C22] hover:bg-[#26262E] border border-[#242424] text-[#F4F4F6] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Wallet className="w-4 h-4 text-[#D95B26]" />
            <span>Abrir Toquecitos</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundView;
