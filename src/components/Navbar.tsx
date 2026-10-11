import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface NavbarProps {
  onBookDemo?: () => void;
  brandTitle?: string;
  menuItems?: Array<{ label: string; href?: string; hasDropdown?: boolean }>;
}

export const Navbar: React.FC<NavbarProps> = ({
  onBookDemo,
  brandTitle = 'RIVR',
  menuItems = [
    { label: 'Ecosystem', href: '#como-funciona', hasDropdown: false },
    { label: 'Economics', href: '#fabricantes', hasDropdown: true },
    { label: 'Developers', href: '#demo', hasDropdown: false },
    { label: 'Governance', href: '#precios', hasDropdown: true },
  ],
}) => {
  const handleScroll = (href?: string) => {
    if (!href) return;
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <nav className="flex items-center justify-between py-6 px-6 md:px-10 w-full relative z-10">
      {/* Left Side (hidden spacer for centering on desktop, or subtle brand) */}
      <div className="flex-1 hidden md:flex items-center gap-2">
        <Link to="/" className="text-xl font-medium tracking-tighter text-[rgba(30,50,90,0.9)] hover:opacity-80 transition-opacity">
          {brandTitle}
        </Link>
      </div>

      {/* Center Menu */}
      <ul className="hidden md:flex items-center gap-8 text-[rgb(45,45,45)] font-normal text-sm">
        {menuItems.map((item, idx) => (
          <li
            key={idx}
            onClick={() => handleScroll(item.href)}
            className="cursor-pointer hover:opacity-70 transition-opacity flex items-center gap-1 group select-none"
          >
            <span>{item.label}</span>
            {item.hasDropdown && (
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 opacity-60" />
            )}
          </li>
        ))}
      </ul>

      {/* Mobile Logo */}
      <div className="md:hidden">
        <span className="font-regular tracking-tighter text-xl text-[rgba(30,50,90,0.9)]">
          {brandTitle}
        </span>
      </div>

      {/* Right Buttons */}
      <div className="flex-1 flex justify-end items-center gap-2.5">
        <Link
          to="/login"
          className="text-xs md:text-sm font-semibold text-[rgba(15,35,75,0.95)] hover:text-black bg-white/70 hover:bg-white px-3.5 py-1.5 rounded-full border border-white/80 transition-all shadow-2xs"
        >
          Ingresar
        </Link>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBookDemo || (() => handleScroll('#demo'))}
          className="flex items-center bg-[rgba(20,40,80,0.92)] text-white rounded-full pl-2 pr-4 md:pr-5 py-1.5 md:py-2 gap-2 hover:bg-[rgba(15,30,65,1)] transition-colors group cursor-pointer shadow-sm"
        >
          <div className="bg-white/20 p-1 md:p-1.5 rounded-full flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs md:text-sm font-semibold">Probar Demo</span>
        </motion.button>
      </div>
    </nav>
  );
};

export default Navbar;
