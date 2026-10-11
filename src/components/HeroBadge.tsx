import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

export interface HeroBadgeProps {
  text?: string;
}

export const HeroBadge: React.FC<HeroBadgeProps> = ({ text = 'Fluid Staking' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/85 backdrop-blur-md border border-white/80 mx-auto mb-3 w-fit shadow-xs"
    >
      <Sparkles className="w-4 h-4 text-[rgba(30,50,90,1)]" />
      <span className="text-[14px] font-semibold text-[rgba(15,35,75,0.95)]">{text}</span>
    </motion.div>
  );
};

export default HeroBadge;
