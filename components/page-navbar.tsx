'use client';

import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";

export default function PageNavbar() {
  // Only external navigation items for cross-page navigation
  const navItems = [
    { href: '/', label: 'HOME' },
    { href: '/gallery', label: 'GALLERY' },
    { href: '/passport', label: 'PASSPORT' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-[#27B9FC] dark:bg-gray-900/95 shadow-lg backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <a href="/" className="flex items-center">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                  <Image
                    src="/ronke-logo.webp"
                    alt="Ronke Logo"
                    width={60}
                    height={60}
                    className="rounded-full"
                  />
                </div>
              </a>
            </div>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-white/80 dark:text-gray-300 hover:text-white dark:hover:text-white hover:scale-105 transition-all duration-200 font-medium"
                >
                  {item.label}
                </a>
              ))}
              
              {/* Theme Toggle */}
              <ThemeToggle />
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button className="text-white dark:text-gray-100 hover:text-gray-200 dark:hover:text-gray-300">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
} 