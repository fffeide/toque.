import React from 'react';
import { Link } from 'react-router-dom';

export interface PublicHeaderProps {
  businessName?: string;
  logoUrl?: string;
  showToqueMark?: boolean;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({
  businessName,
  logoUrl,
  showToqueMark = true,
}) => {
  return (
    <header className="w-full bg-[#F7F4EE] border-b border-[#E3DDD2] py-3.5 px-4 sm:px-6 sticky top-0 z-30">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        {businessName ? (
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={businessName}
                className="w-9 h-9 rounded-xl object-cover border border-[#E3DDD2]"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#3A3FE0] text-white flex items-center justify-center font-display font-bold text-base shrink-0">
                {businessName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <span className="font-display font-bold text-sm text-[#0B1030] block truncate">
                {businessName}
              </span>
            </div>
          </div>
        ) : (
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-[#3A3FE0] text-white flex items-center justify-center font-display font-bold text-base">
              T
            </div>
            <span className="font-display font-bold text-base text-[#0B1030]">
              Toque
            </span>
          </Link>
        )}

        {showToqueMark && (
          <div className="text-[11px] font-medium text-[#5E6072] flex items-center gap-1.5">
            <span>Con</span>
            <span className="font-display font-bold text-[#0B1030]">Toque™</span>
          </div>
        )}
      </div>
    </header>
  );
};
