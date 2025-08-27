'use client';

import Image from "next/image";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Navigation items in the desired order
  const navItems = [
    { id: 'about', label: 'ABOUT' },
    { id: 'charts', label: 'CHARTS' },
    { id: 'rrf', label: 'RRF' },
    { id: 'ronke-casino', label: 'RONKE CASINO' },
    { id: 'ronke-staking', label: 'STAKING' },
    { id: 'burnonomics', label: 'BURNONOMICS' },
  ];

  // External navigation items
  const externalNavItems = [
    { href: '/gallery', label: 'GALLERY' },
    { href: '/passport', label: 'PASSPORT' },
  ];

  // Handle hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const handleScroll = () => {
      const aboutSection = document.getElementById('about');
      if (aboutSection) {
        const rect = aboutSection.getBoundingClientRect();
        // Show navbar when next section is in view (top of section reaches top of viewport)
        setIsVisible(rect.top <= 0);
      }

      // Determine active section based on scroll position
      const sections = navItems.map(item => item.id);
      let currentActiveSection = '';
      
      // Get current scroll position plus some offset to account for navbar
      const scrollPosition = window.scrollY + 100;
      
      // Check each section and find which one we're currently in
      for (let i = 0; i < sections.length; i++) {
        const element = document.getElementById(sections[i]);
        if (element) {
          const rect = element.getBoundingClientRect();
          const elementTop = window.scrollY + rect.top;
          
          // Check if this section starts at or before our current scroll position
          if (elementTop <= scrollPosition) {
            currentActiveSection = sections[i];
          }
        }
      }
      
      // Fallback: if no section is found or we're at the very top, default to 'about'
      if (!currentActiveSection || window.scrollY < 200) {
        currentActiveSection = 'about';
      }

      setActiveSection(currentActiveSection);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMounted]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Close mobile menu after navigation
      setIsMobileMenuOpen(false);
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Don't render until mounted to prevent hydration issues
  if (!isMounted) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 opacity-0 -translate-y-full transition-all duration-500 ease-out">
        <div className="bg-[#27B9FC] shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <div className="flex items-center">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                  <Image
                    src="/ronke-logo.webp"
                    alt="Ronke Logo"
                    width={60}
                    height={60}
                    className="rounded-full"
                  />
                </div>
              </div>

              {/* Desktop Navigation Links */}
              <div className="hidden md:flex items-center space-x-8">
                {navItems.map((item) => (
                  <div key={item.id} className="text-white/80 font-medium">
                    {item.label}
                  </div>
                ))}
                
                {/* Separator */}
                <div className="w-px h-6 bg-white/30"></div>
                
                {/* External Links */}
                {externalNavItems.map((item) => (
                  <div key={item.href} className="text-white/80 font-medium">
                    {item.label}
                  </div>
                ))}
              </div>

              {/* Mobile menu button placeholder */}
              <div className="md:hidden">
                <div className="h-6 w-6"></div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
    }`}>
      <div className="bg-[#27B9FC] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                <Image
                  src="/ronke-logo.webp"
                  alt="Ronke Logo"
                  width={60}
                  height={60}
                  className="rounded-full"
                />
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              {navItems.map((item) => (
                <button 
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-white transition-all duration-200 font-medium relative ${
                    activeSection === item.id 
                      ? 'text-white scale-105' 
                      : 'text-white/80 hover:text-white hover:scale-105'
                  }`}
                >
                  {item.label}
                  {/* Active indicator */}
                  {activeSection === item.id && (
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full"></div>
                  )}
                </button>
              ))}
              
              {/* Separator */}
              <div className="w-px h-6 bg-white/30"></div>
              
              {/* External Links */}
              {externalNavItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-white/80 hover:text-white hover:scale-105 transition-all duration-200 font-medium"
                >
                  {item.label}
                </a>
              ))}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button 
                onClick={toggleMobileMenu}
                className="text-white hover:text-gray-200 transition-colors duration-200"
                aria-label="Toggle mobile menu"
              >
                <svg 
                  className={`h-6 w-6 transition-transform duration-200 ${isMobileMenuOpen ? 'rotate-90' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <div className={`md:hidden transition-all duration-300 ease-out ${
            isMobileMenuOpen 
              ? 'max-h-96 opacity-100 pb-4' 
              : 'max-h-0 opacity-0 overflow-hidden'
          }`}>
            <div className="space-y-1 pt-2">
              {/* Mobile Section Links */}
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`block w-full text-left px-3 py-2 rounded-md transition-all duration-200 font-medium ${
                    activeSection === item.id
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              
              {/* Separator */}
              <div className="my-2 border-t border-white/20"></div>
              
              {/* Mobile External Links */}
              {externalNavItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 rounded-md text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200 font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}