import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-[#f1f1ee]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3.5 py-2.5 rounded-xl border bg-[#18181b] text-[#f1f1ee] placeholder-[#a1a1aa] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#bec8ff] ${
          error ? 'border-red-500' : 'border-[#28282a] hover:border-[#343438]'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs font-medium text-red-400">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-[#a1a1aa]">{helperText}</p>
      ) : null}
    </div>
  );
};
