import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

export interface BottomLeftCardProps {
  statNumber?: string;
  statLabel?: string;
  buttonLabel?: string;
  onButtonClick?: () => void;
}

export const BottomLeftCard: React.FC<BottomLeftCardProps> = ({
  statNumber = '5.2K',
  statLabel = 'Active Yielders',
  buttonLabel = 'Join Discord',
  onButtonClick,
}) => {
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="absolute bottom-28 right-4 left-auto md:left-6 md:right-auto md:bottom-6 lg:bottom-10 lg:left-10 p-3 md:p-4 lg:p-5 rounded-[1.2rem] md:rounded-[1.5rem] lg:rounded-[2.2rem] bg-white/30 backdrop-blur-xl flex flex-col gap-2 lg:gap-3 min-w-[140px] md:min-w-[150px] lg:min-w-[180px] w-fit shadow-lg border border-white/40"
    >
      <div className="flex flex-col">
        <span className="text-2xl md:text-3xl font-bold text-[#0c1a38] tracking-tight">
          {statNumber}
        </span>
        <span className="text-[10px] md:text-[12px] font-bold text-[#1e325a] uppercase tracking-wider">
          {statLabel}
        </span>
      </div>

      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onButtonClick}
        className="flex items-center bg-white rounded-full pl-1.5 pr-5 py-1.5 gap-2 hover:bg-white/90 transition-colors self-start group cursor-pointer shadow-xs"
      >
        <div className="bg-[rgba(30,50,90,0.1)] p-1 rounded-full flex items-center justify-center">
          <ArrowUpRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-[rgba(30,50,90,0.9)]" />
        </div>
        <span className="text-[14px] font-normal text-[rgba(30,50,90,0.9)]">
          {buttonLabel}
        </span>
      </motion.button>
    </motion.div>
  );
};

export default BottomLeftCard;
