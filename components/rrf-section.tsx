'use client';

import Image from "next/image";
import { useEffect, useState } from "react";

export default function RRFSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    const section = document.getElementById('rrf');
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
    <section id="rrf" className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-green-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className={`text-center mb-16 transition-all duration-1000 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <div className="flex items-center justify-center mb-6">
            {/* Left rice icon */}
            <Image src="/rice.webp" alt="Rice Logo" width={60} height={60} className="mr-8" />
            <h2 className="text-5xl md:text-7xl font-extralight text-gray-900">
              RONKE RICE
              <span className="block text-4xl md:text-6xl font-thin text-green-600 mt-2">
                FARMER
              </span>
              
            </h2>
            {/* Right rice icon */}
            <Image src="/rice.webp" alt="Rice Logo" width={60} height={60} className="ml-8" />
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            The ultimate <span className="text-green-600 font-medium">69.69-day farming competition</span> where strategy beats speed, 
            and only the strongest hands survive to harvest the greatest rewards.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
          
          {/* Left Column - Game Overview */}
          <div className={`space-y-8 transition-all duration-1000 ease-out delay-300 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-16'
          }`}>
            <div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">What is RRF?</h3>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                Ronke Rice Farmer (RRF) is a strategic blockchain farming game where players compete to accumulate 
                the highest amount of <span className="text-green-600 font-medium">$RICE</span> tokens over a limited 
                69.69-day period. Built on the Ronin Network in collaboration with the Ronke community.
              </p>
            </div>

            {/* Game Features */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h4 className="text-xl font-bold text-gray-900 mb-4">Core Gameplay</h4>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-gray-700"><strong>Build Farms:</strong> Use $RONKE and $RICE to acquire farms of varying tiers</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-gray-700"><strong>Hire Farmers:</strong> Deploy legendary, master, and expert farmers to maximize production</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-gray-700"><strong>Passive Income:</strong> Farms generate $RICE automatically over time</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-gray-700"><strong>NFT Boosts:</strong> Ronkeverse NFTs provide up to 1.5x yield multipliers</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Visual Placeholder */}
          <div className={`transition-all duration-1000 ease-out delay-500 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-16'
          }`}>
            <div className="relative">
              {/* Placeholder for farming game visual */}
              <div className="bg-gradient-to-br from-green-100 to-yellow-100 rounded-3xl shadow-2xl overflow-hidden aspect-square">
                <div className="w-full h-full flex items-center justify-center">
                  {/* Placeholder content - you can replace with actual image */}
                <video src="/rrf.mp4" autoPlay loop muted className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Jeet Jail Warning */}
        <div className={`bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-8 border-l-4 border-red-400 mb-16 transition-all duration-1000 ease-out delay-900 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <div className="flex items-center mb-4">
            <span className="text-3xl mr-3">⚠️</span>
            <h4 className="text-2xl font-bold text-gray-900">Jeet Jail System</h4>
          </div>
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            <strong>Strategy over speed.</strong> The Jeet Jail system penalizes excessive withdrawals and paper hands. 
            Players who cash out too early get locked out, encouraging long-term strategic thinking over quick profits.
          </p>
          <p className="text-gray-600 italic">
            "Only real farmers survive the full 69.69 days. Are you built for the long haul?"
          </p>
        </div>

        {/* Call to Action */}
        <div className={`text-center transition-all duration-1000 ease-out delay-1100 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <p className="text-lg text-gray-600 mb-8">
            Ready to test your farming strategy and compete for the ultimate rice harvest?
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="https://ronkericefarmer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors duration-200 font-semibold text-lg shadow-lg"
            >
              🌾 Start Farming
            </a>
            <a 
              href="https://ronke-rice-farmers.gitbook.io/landing-page/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 border-2 border-green-600 text-green-600 rounded-full hover:bg-green-600 hover:text-white transition-all duration-200 font-semibold text-lg"
            >
              📚 Learn More
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}