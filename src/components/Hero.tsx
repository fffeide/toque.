import React from 'react';
import { motion } from 'motion/react';
import { Navbar } from './Navbar';
import { HeroBadge } from './HeroBadge';
import { BottomLeftCard } from './BottomLeftCard';
import { BottomRightCorner } from './BottomRightCorner';

export interface HeroProps {
  headline?: string;
  subheadline?: string;
  badgeText?: string;
  statNumber?: string;
  statLabel?: string;
  cardButtonLabel?: string;
  cornerTitle?: string;
  cornerSubtitle?: string;
  onBookDemo?: () => void;
  onJoinDiscord?: () => void;
  onCornerClick?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  headline = 'Fluid Asset Streams',
  subheadline = 'Access Smart Vaults, stake RIVR, NFTs, transform rigid holdings into liquid cash instantly.',
  badgeText = 'Fluid Staking',
  statNumber = '5.2K',
  statLabel = 'Active Yielders',
  cardButtonLabel = 'Join Discord',
  cornerTitle = 'Documentation',
  cornerSubtitle = 'Library',
  onBookDemo,
  onJoinDiscord,
  onCornerClick,
}) => {
  return (
    <div className="w-full h-screen flex items-center justify-center p-3 md:p-5 bg-[#f0f0f0]">
      <section className="relative w-full max-w-[1536px] h-full rounded-[1.5rem] md:rounded-[3rem] overflow-hidden shadow-none flex flex-col items-center bg-white/10 group">
        {/* The Video Background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover object-[65%] lg:object-center z-0"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260428_193507_4286c423-2fd9-4efd-92bd-91a939453fc1.mp4"
        />

        {/* The Content Layer */}
        <div className="relative z-10 w-full h-full flex flex-col items-center justify-between">
          <Navbar
            brandTitle="TOQUE"
            onBookDemo={onBookDemo}
            menuItems={[
              { label: 'Cómo funciona', href: '#como-funciona', hasDropdown: false },
              { label: 'Red de Fabricantes', href: '#red-fabricantes', hasDropdown: false },
              { label: 'Para fabricantes', href: '#fabricantes', hasDropdown: false },
              { label: 'Para negocios', href: '#negocios', hasDropdown: false },
              { label: 'Privacidad', href: '#privacidad', hasDropdown: false },
              { label: 'Precios', href: '#precios', hasDropdown: false },
              { label: 'Preguntas', href: '#faq', hasDropdown: false },
            ]}
          />

          {/* Text Container */}
          <div className="w-full flex flex-col items-center pt-8 px-6 text-center max-w-4xl my-auto">
            <HeroBadge text={badgeText} />

            <motion.h1
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-[76px] font-bold text-[#0c1a38] mb-3 tracking-tight leading-[1.05] drop-shadow-xs"
            >
              {headline}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-sm sm:text-base md:text-lg text-[#0f172a] font-medium leading-relaxed max-w-2xl bg-white/75 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-white/80 shadow-xs"
            >
              {subheadline}
            </motion.p>
          </div>

          {/* Floating elements inside container */}
          <BottomLeftCard
            statNumber={statNumber}
            statLabel={statLabel}
            buttonLabel={cardButtonLabel}
            onButtonClick={onJoinDiscord}
          />

          <BottomRightCorner
            title={cornerTitle}
            subtitle={cornerSubtitle}
            onClick={onCornerClick}
          />
        </div>
      </section>
    </div>
  );
};

export default Hero;
