'use client';

import Image from "next/image";
import { useEffect, useState } from "react";

export default function NextSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    const section = document.getElementById('about');
    if (section) {
      observer.observe(section);
    }

    return () => {
      if (section) {
        observer.unobserve(section);
      }
    };
  }, []);

  return (
    <section id="about" className="min-h-screen bg-gradient-to-br from-white to-gray-50 dark:from-black dark:via-gray-900 dark:to-black flex items-center pt-20 sm:pt-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
          
          {/* Left Column - Image */}
          <div className={`order-2 lg:order-1 transition-all duration-1000 ease-out ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-16'
          }`}>
            <div className="relative">
              <Image
                src="/ronkeverse.png"
                alt="Ronkeverse"
                width={600}
                height={600}
                className="w-full h-auto drop-shadow-2xl max-w-md sm:max-w-lg lg:max-w-none mx-auto"
                priority
              />
            </div>
          </div>

          {/* Right Column - Text Content */}
          <div className="order-1 lg:order-2 space-y-6 sm:space-y-8">
            
            {/* Main Title */}
            <div className={`transition-all duration-1000 ease-out delay-300 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extralight text-gray-900 dark:text-gray-100 leading-tight">
                Enter the
                <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-thin text-[#27B9FC] mt-1 sm:mt-2">
                  RONKEVERSE
                </span>
              </h2>
            </div>

            {/* Subtitle */}
            <div className={`transition-all duration-1000 ease-out delay-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed">
                <span className="italic">&ldquo;What is dead, may never die&rdquo;</span> — Born from a simple MS Paint creation, 
                <span className="text-[#27B9FC] font-medium"> reborn through community power</span>.
              </p>
            </div>

            {/* Description */}
            <div className={`transition-all duration-1000 ease-out delay-700 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              <p className="text-sm sm:text-base lg:text-lg text-gray-700 dark:text-gray-300 leading-relaxed max-w-lg">
                From abandoned project to cultural phenomenon—RONKE proves that sometimes the most unexpected 
                heroes rise from the ashes. Our blue monkey didn&apos;t just survive; she built an empire on Ronin blockchain.
              </p>
            </div>

            {/* Features */}
            <div className={`transition-all duration-1000 ease-out delay-900 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-6 sm:mt-8">
                <div className="space-y-1 sm:space-y-2">
                  <div className="w-3 h-3 bg-[#27B9FC] rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Casino Games</h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Premium gaming experience</p>
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <div className="w-3 h-3 bg-[#27B9FC] rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Rice Farming</h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Sustainable yield generation</p>
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <div className="w-3 h-3 bg-[#27B9FC] rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Staking Rewards</h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Passive income opportunities</p>
                </div>
                <div className="space-y-1 sm:space-y-2">
                  <div className="w-3 h-3 bg-[#27B9FC] rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Burnonomics</h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Deflationary tokenomics</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}