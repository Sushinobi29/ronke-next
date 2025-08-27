'use client';

import Image from "next/image";
import { useEffect, useState } from "react";
import RonkeCursor from "./ronke-cursor";

export default function TokensSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isRonkeExcited, setIsRonkeExcited] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    const section = document.getElementById('charts');
    if (section) {
      observer.observe(section);
    }

    return () => {
      if (section) {
        observer.unobserve(section);
      }
    };
  }, []);

  const scrollToRRF = () => {
    const rrfSection = document.getElementById('rrf');
    if (rrfSection) {
      rrfSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const copyToClipboard = async (address: string, tokenName: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedToken(tokenName);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleBuyToken = (tokenAddress: string) => {
    // Trigger Ronke cursor excitement
    setIsRonkeExcited(true);
    
    // Open Katana swap with the specific token
    const swapUrl = `https://app.roninchain.com/swap?outputCurrency=${tokenAddress}&inputCurrency=RON`;
    window.open(swapUrl, '_blank');
    
    // Reset excitement after a short delay
    setTimeout(() => {
      setIsRonkeExcited(false);
    }, 2000);
  };

  return (
    <section id="charts" className="min-h-screen bg-gradient-to-br from-gray-50 to-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className={`text-center mb-16 transition-all duration-1000 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <h2 className="text-5xl md:text-7xl font-extralight text-gray-900 mb-4">
            LIVE <span className="text-[#27B9FC] font-thin">CHARTS</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Track the pulse of the Ronkeverse ecosystem in real-time
          </p>
        </div>

        {/* Token Cards - Single Column */}
        <div className="space-y-12">
          
          {/* RONKE Token Card */}
          <div className={`transition-all duration-1000 ease-out delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden hover:shadow-3xl transition-shadow duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
                {/* Chart Section */}
                <div className="lg:col-span-3 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                        <Image src="/ronke-logo.webp" alt="Ronke Logo" width={60} height={60} />
                      <div>
                        <h3 className="text-3xl font-bold text-gray-900">$RONKE</h3>
                        <p className="text-gray-500">The Blue Monkey Token</p>
                        <button
                          onClick={() => copyToClipboard('0xf988F63Bf26c3Ed3fBf39922149E3E7B1e5c27Cb', 'RONKE-CA')}
                          className={`text-xs font-mono px-2 py-1 rounded transition-all duration-200 mt-1 max-w-full truncate ${
                            copiedToken === 'RONKE-CA' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {copiedToken === 'RONKE-CA' ? '✓ Copied!' : '0xf988F63Bf26c3Ed3fBf39922149E3E7B1e5c27Cb'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="relative h-80 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl overflow-hidden shadow-inner">
                    <iframe
                      src="https://www.geckoterminal.com/ronin/pools/0x75ae353997242927c701d4d6c2722ebef43fd2d3?embed=1&info=0&swaps=0"
                      width="100%"
                      height="100%"
                      className="border-0"
                      title="RONKE Token Chart"
                      allow="fullscreen"
                    />
                  </div>
                </div>
                
                {/* Info Section */}
                <div className="lg:col-span-2 bg-gradient-to-br from-gray-50 to-gray-100 p-8 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-4">The New World Token</h4>
                    <p className="text-gray-700 leading-relaxed mb-6">
                      Born from a simple MS Paint creation, abandoned by its original developer, but reborn through 
                      community power. RONKE represents resilience and the unstoppable force of collective belief.
                    </p>
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={() => handleBuyToken('0xf988F63Bf26c3Ed3fBf39922149E3E7B1e5c27Cb')}
                      className="w-full bg-[#27B9FC] text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-600 transition-all duration-200"
                    >
                      Buy RONKE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ronkeverse NFTs Card */}
          <div className={`transition-all duration-1000 ease-out delay-400 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden hover:shadow-3xl transition-shadow duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
                {/* Chart Section */}
                <div className="lg:col-span-3 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-3xl font-bold text-gray-900">Ronkeverse NFTs</h3>
                        <p className="text-gray-500">Premium Collection</p>
                      </div>
                    </div>
                  </div>
                  <div className="relative h-80 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-xl overflow-hidden shadow-inner">
                    <Image
                      src="/ronkeverse-banner.png"
                      alt="Ronkeverse Banner"
                      width={400}
                      height={320}
                      className="w-full h-full object-cover"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    <div className="absolute bottom-4 left-4 right-4 text-center">
                      <h4 className="text-white text-lg font-bold mb-1 drop-shadow-lg">
                        The Rolex of the 21st Century
                      </h4>
                    </div>
                  </div>
                </div>
                
                {/* Info Section */}
                <div className="lg:col-span-2 bg-gradient-to-br from-purple-50 to-pink-50 p-8 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-4">RONKEVERSE NFTs</h4>
                    <p className="text-gray-700 leading-relaxed mb-6">
                      The Rolex of the 21st Century. Scarce by design. 6969 Blue Citizens of the new world.
                    </p>
                  </div>
                  <div className="mt-6">
                    <a 
                      href="https://marketplace.roninchain.com/collections/ronkeverse"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-700 transition-all duration-200 text-center block"
                    >
                      Browse Collection
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RICE Token Card */}
          <div className={`transition-all duration-1000 ease-out delay-600 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden hover:shadow-3xl transition-shadow duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
                {/* Chart Section */}
                <div className="lg:col-span-3 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <Image src="/rice.webp" alt="Rice Logo" width={60} height={60} />
                      <div>
                        <h3 className="text-3xl font-bold text-gray-900">$RICE</h3>
                        <p className="text-gray-500">Ronke Rice Farmer Token</p>
                        <button
                          onClick={() => copyToClipboard('0x9049ca10dd4cba0248226b4581443201f8f225c6', 'RICE-CA')}
                          className={`text-xs font-mono px-2 py-1 rounded transition-all duration-200 mt-1 max-w-full truncate ${
                            copiedToken === 'RICE-CA' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {copiedToken === 'RICE-CA' ? '✓ Copied!' : '0x9049ca10dd4cba0248226b4581443201f8f225c6'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="relative h-80 bg-gradient-to-br from-green-50 to-yellow-50 rounded-xl overflow-hidden shadow-inner">
                    <iframe
                      src="https://www.geckoterminal.com/ronin/pools/0x93171ecace2f6b8be8dd09539f55fabe7f805af1?embed=1&info=0&swaps=0"
                      width="100%"
                      height="100%"
                      className="border-0"
                      title="RICE Token Chart"
                      allow="fullscreen"
                    />
                  </div>
                </div>
                
                {/* Info Section */}
                <div className="lg:col-span-2 bg-gradient-to-br from-green-50 to-yellow-50 p-8 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 mb-4">Farming Ecosystem</h4>
                    <p className="text-gray-700 leading-relaxed mb-6">
                      The agricultural backbone of the Ronkeverse. RICE powers the Ronke Rice Farmer (RRF) ecosystem, 
                      providing sustainable yield generation through innovative farming mechanics.
                    </p>
                  </div>
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={scrollToRRF}
                      className="w-full bg-gray-800 text-white py-3 px-6 rounded-xl font-semibold hover:bg-gray-900 transition-colors duration-200"
                    >
                      What is Ronke Rice Farmer?
                    </button>
                    <button
                      onClick={() => handleBuyToken('0x9049ca10dd4cba0248226b4581443201f8f225c6')}
                      className="w-full bg-[#27B9FC] text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-600 transition-all duration-200"
                    >
                      Buy RICE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom CTA */}
      

      </div>
      
      {/* Excited Ronke Cursor for buy interactions */}
      {isRonkeExcited && <RonkeCursor isActive={true} isExcited={true} />}
    </section>
  );
}