'use client';

import Image from "next/image";
import { useEffect, useState } from "react";
import RonkeCursor from "./ronke-cursor";

export default function HeroBanner() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showSpeechBubble, setShowSpeechBubble] = useState(false);
  const [bananaPosition, setBananaPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [ronkeJumping, setRonkeJumping] = useState(false);
  const [bananaFed, setBananaFed] = useState(false);
  const [copiedContract, setCopiedContract] = useState<string | null>(null);

  useEffect(() => {
    // Prevent scrolling until banana is fed
    if (!bananaFed) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
      document.body.style.height = 'auto';
      document.documentElement.style.overflow = 'auto';
    }

    // Trigger animations after component mounts
    const timer = setTimeout(() => setIsLoaded(true), 100);
    
    // Animate banana floating around
    const floatInterval = setInterval(() => {
      if (!isDragging && !bananaFed) {
        setBananaPosition(prev => ({
          x: prev.x + (Math.random() - 0.5) * 30,
          y: prev.y + (Math.random() - 0.5) * 20
        }));
      }
    }, 2000);

    // Show speech bubble animation after initial load
    const speechTimer = setTimeout(() => {
      if (!bananaFed) {
        setShowSpeechBubble(true);
        // Hide it after 3 seconds, then show again in a loop
        const bubbleInterval = setInterval(() => {
          if (!bananaFed) {
            setShowSpeechBubble(false);
            setTimeout(() => !bananaFed && setShowSpeechBubble(true), 2000);
          }
        }, 5000);
        
        return () => clearInterval(bubbleInterval);
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearTimeout(speechTimer);
      clearInterval(floatInterval);
      // Restore scrolling on cleanup
      document.body.style.overflow = 'auto';
      document.body.style.height = 'auto';
      document.documentElement.style.overflow = 'auto';
    };
  }, [isDragging, bananaFed]);

  const handleBananaMouseDown = (e: React.MouseEvent) => {
    if (bananaFed) return;
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleBananaTouchStart = (e: React.TouchEvent) => {
    if (bananaFed) return;
    e.preventDefault();
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && !bananaFed) {
      setBananaPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && !bananaFed) {
      e.preventDefault();
      const touch = e.touches[0];
      setBananaPosition({
        x: touch.clientX - dragOffset.x,
        y: touch.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging || bananaFed) return;
    setIsDragging(false);

    // Check if banana is dropped on Ronke (rough collision detection)
    const ronkeElement = document.getElementById('ronke-image');
    if (ronkeElement) {
      const ronkeRect = ronkeElement.getBoundingClientRect();
      const bananaX = e.clientX;
      const bananaY = e.clientY;
      
      if (bananaX >= ronkeRect.left && bananaX <= ronkeRect.right &&
          bananaY >= ronkeRect.top && bananaY <= ronkeRect.bottom) {
        // Banana fed to Ronke!
        setBananaFed(true);
        setShowSpeechBubble(false);
        setRonkeJumping(true);
        
        // Stop jumping after animation and scroll
        setTimeout(() => {
          setRonkeJumping(false);
          const aboutSection = document.getElementById('about');
          if (aboutSection) {
            aboutSection.scrollIntoView({ 
              behavior: 'smooth',
              block: 'start'
            });
          }
        }, 2000);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging || bananaFed) return;
    setIsDragging(false);

    // Check if banana is dropped on Ronke (rough collision detection)
    const ronkeElement = document.getElementById('ronke-image');
    if (ronkeElement) {
      const ronkeRect = ronkeElement.getBoundingClientRect();
      const touch = e.changedTouches[0];
      const bananaX = touch.clientX;
      const bananaY = touch.clientY;
      
      if (bananaX >= ronkeRect.left && bananaX <= ronkeRect.right &&
          bananaY >= ronkeRect.top && bananaY <= ronkeRect.bottom) {
        // Banana fed to Ronke!
        setBananaFed(true);
        setShowSpeechBubble(false);
        setRonkeJumping(true);
        
        // Stop jumping after animation and scroll
        setTimeout(() => {
          setRonkeJumping(false);
          const aboutSection = document.getElementById('about');
          if (aboutSection) {
            aboutSection.scrollIntoView({ 
              behavior: 'smooth',
              block: 'start'
            });
          }
        }, 2000);
      }
    }
  };

  const copyContractAddress = async (address: string, tokenName: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedContract(tokenName);
    setTimeout(() => setCopiedContract(null), 2000);
  };

  return (
    <section 
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Headlight spotlight effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/15 via-white/8 to-transparent"></div>
      
      {/* Main content container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Hero text with staggered animation */}
        <div className={`transform transition-all duration-1000 ease-out ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <h1 className="text-4xl md:text-6xl lg:text-8xl font-extralight tracking-tight mb-6">
            <span className="text-[#27B9FC]">RONKE</span><span className="text-gray-300">VERSE</span>
          </h1>
        </div>

        {/* Animated image container */}
        <div className={`transform transition-all duration-1200 ease-out delay-300 ${
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}>
          <div className="relative group">
            {/* Headlight glow effect behind image */}
            <div className="absolute -inset-8 bg-gradient-to-r from-white/30 via-white/20 to-white/10 rounded-full blur-2xl transition-all duration-700 group-hover:blur-3xl group-hover:scale-125 opacity-60 group-hover:opacity-80"></div>
            
            {/* Speech bubble */}
            <div className={`absolute -top-4 left-1/2 transform -translate-x-1/2 transition-all duration-500 ease-out ${
              showSpeechBubble ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
            }`}>
              <div className="relative">
                <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-full text-sm font-medium shadow-lg border dark:border-gray-600">
                  feed me 🍚
                </div>
                {/* Speech bubble tail */}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                  <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-white dark:border-t-gray-800"></div>
                </div>
              </div>
            </div>
            
            {/* Contract Addresses - Desktop: Left and Right sides, Mobile: Below image */}
            {/* RONKE Contract - Left Side (Desktop) */}
            <div className={`absolute left-0 top-1/2 transform -translate-x-full -translate-y-1/2 -ml-8 transition-all duration-1000 ease-out delay-800 hidden lg:block ${
              isLoaded ? 'opacity-100' : 'opacity-0 translate-x-4'
            }`}>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-400 dark:text-gray-300 mb-2">$RONKE</span>
                <button
                  onClick={() => copyContractAddress('0xf988F63Bf26c3Ed3fBf39922149E3E7B1e5c27Cb', 'RONKE-HERO')}
                  className={`font-mono text-xs px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap ${
                    copiedContract === 'RONKE-HERO' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500' 
                      : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-600'
                  }`}
                >
                  {copiedContract === 'RONKE-HERO' ? '✓ Copied!' : '0xf988...27Cb'}
                </button>
              </div>
            </div>

            {/* RICE Contract - Right Side (Desktop) */}
            <div className={`absolute right-0 top-1/2 transform translate-x-full -translate-y-1/2 -mr-8 transition-all duration-1000 ease-out delay-800 hidden lg:block ${
              isLoaded ? 'opacity-100' : 'opacity-0 -translate-x-4'
            }`}>
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-400 dark:text-gray-300 mb-2">$RICE</span>
                <button
                  onClick={() => copyContractAddress('0x9049ca10dd4cba0248226b4581443201f8f225c6', 'RICE-HERO')}
                  className={`font-mono text-xs px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap ${
                    copiedContract === 'RICE-HERO' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500' 
                      : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-600'
                  }`}
                >
                  {copiedContract === 'RICE-HERO' ? '✓ Copied!' : '0x9049...25c6'}
                </button>
              </div>
            </div>
            
            {/* Main image */}
            <div className="relative">
              <Image
                id="ronke-image"
                src="/ronkebase.png"
                alt="Ronkebase"
                width={400}
                height={400}
                className={`mx-auto transition-all duration-200 ease-out group-hover:scale-105 drop-shadow-2xl ${
                  ronkeJumping ? 'animate-bounce' : ''
                }`}
                priority
              />
            </div>

            {/* Contract Addresses - Mobile (Below image) */}
            <div className={`lg:hidden mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center transition-all duration-1000 ease-out delay-800 ${
              isLoaded ? 'opacity-100' : 'opacity-0 translate-y-4'
            }`}>
              {/* RONKE Contract - Mobile */}
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-400 dark:text-gray-300 mb-2">$RONKE</span>
                <button
                  onClick={() => copyContractAddress('0xf988F63Bf26c3Ed3fBf39922149E3E7B1e5c27Cb', 'RONKE-HERO-MOBILE')}
                  className={`font-mono text-xs px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap ${
                    copiedContract === 'RONKE-HERO-MOBILE' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500' 
                      : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-600'
                  }`}
                >
                  {copiedContract === 'RONKE-HERO-MOBILE' ? '✓ Copied!' : '0xf988...27Cb'}
                </button>
              </div>

              {/* RICE Contract - Mobile */}
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-400 dark:text-gray-300 mb-2">$RICE</span>
                <button
                  onClick={() => copyContractAddress('0x9049ca10dd4cba0248226b4581443201f8f225c6', 'RICE-HERO-MOBILE')}
                  className={`font-mono text-xs px-3 py-2 rounded-lg transition-all duration-200 whitespace-nowrap ${
                    copiedContract === 'RICE-HERO-MOBILE' 
                      ? 'bg-green-500/20 text-green-400 border border-green-500' 
                      : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-gray-600'
                  }`}
                >
                  {copiedContract === 'RICE-HERO-MOBILE' ? '✓ Copied!' : '0x9049...25c6'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subtitle with delayed animation */}
        <div className={`transform transition-all duration-1000 ease-out delay-600 ${
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <p className="text-xl md:text-2xl font-light text-[#9FD7DF] mt-12 max-w-2xl mx-auto leading-relaxed">
            Beauty Standards redefined.
                            <span className="block mt-2 text-lg md:text-xl text-gray-400 dark:text-gray-300">
              Where luxury meets Blue Monke
            </span>
          </p>
        </div>

      </div>

      {/* Floating Banana */}
      {!bananaFed && (
        <div
          className={`absolute text-4xl cursor-grab select-none transition-all duration-1000 ease-out ${
            isDragging ? 'cursor-grabbing scale-125' : 'hover:scale-110'
          } ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{
            left: `${bananaPosition.x}px`,
            top: `${bananaPosition.y}px`,
            transform: `translate(-50%, -50%) ${isDragging ? 'rotate(15deg)' : 'rotate(0deg)'}`,
            zIndex: 50
          }}
          onMouseDown={handleBananaMouseDown}
          onTouchStart={handleBananaTouchStart}
        >
          🍚
        </div>
      )}

      {/* Ronke Cursor */}
      <RonkeCursor isActive={bananaFed} />

    </section>
  );
}