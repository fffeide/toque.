import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return (
    <div
      aria-hidden="true"
      className={`bg-[#E3DDD2]/60 animate-pulse rounded-md ${className}`}
    />
  );
};
