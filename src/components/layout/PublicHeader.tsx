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
    <header className="w-full bg-[#0c0c0c] border-b border-[#242426] py-3.5 px-4 sm:px-6 sticky top-0 z-30">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        {businessName ? (
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={businessName}
                className="w-9 h-9 rounded-xl object-cover border border-[#242426]"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#bec8ff] text-[#0c0c0c] flex items-center justify-center font-bold text-base shrink-0">
                {businessName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <span className="font-bold text-sm text-[#f1f1ee] block truncate tracking-tight">
                {businessName}
              </span>
            </div>
          </div>
        ) : (
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#f1f1ee] border border-[#242426] flex items-center justify-center">
              <img src="/assets/logo.svg" alt="" className="w-5 h-5 object-contain" />
            </div>
            <span className="font-bold text-base text-[#f1f1ee] tracking-tight">
              toque™
            </span>
          </Link>
        )}

        {showToqueMark && (
          <Link
            to="/"
            className="text-[11px] font-medium text-[#a1a1aa] hover:text-[#f1f1ee] flex items-center gap-1.5 transition-colors"
          >
            <span>Con</span>
            <span className="font-bold text-[#f1f1ee]">toque™</span>
          </Link>
        )}
      </div>
    </header>
  );
};
