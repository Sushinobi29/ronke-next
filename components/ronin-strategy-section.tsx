'use client';

import { useEffect, useState } from "react";

export default function RoninStrategySection() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: isMobile ? 0.1 : 0.2 }
    );

    const section = document.getElementById('ronin-strategy');
    if (section) {
      observer.observe(section);
    }

    return () => {
      window.removeEventListener('resize', checkMobile);
      if (section) {
        observer.unobserve(section);
      }
    };
  }, [isMobile]);

  return (
    <section id="ronin-strategy" className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-black dark:via-gray-900 dark:to-black py-12 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Title */}
        <div className={`text-center mb-12 sm:mb-16 ${
          isMobile
            ? `transition-all duration-500 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`
            : `transition-all duration-1000 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`
        }`}>
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-extralight text-gray-900 dark:text-gray-100 mb-4">
            RONIN <span className="text-orange-600 font-thin">STRATEGY</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed px-4">
            A <span className="text-orange-600 font-medium">perpetual machine</span> for every NFT collection.
          </p>

          {/* Ronke No Read Button */}
          <div className="mt-6">
            <button
              onClick={() => setShowVideo(!showVideo)}
              className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-6 py-3 rounded-full font-bold text-base sm:text-lg shadow-lg transition-all duration-200 transform hover:scale-105"
            >
              {showVideo ? '📖 Back to Reading' : '🙈 Ronke No Read'}
            </button>
          </div>
        </div>

        {/* Main Content Card */}
        <div className={`${
          isMobile
            ? `${isVisible ? 'opacity-100' : 'opacity-0'}`
            : `transition-all duration-1000 ease-out delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`
        }`}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">

            {/* Video View */}
            {showVideo ? (
              <div className="p-6 sm:p-8 lg:p-12">
                <div className="aspect-video w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl bg-black">
                  <video
                    className="w-full h-full"
                    controls
                    autoPlay
                    loop
                    playsInline
                  >
                    <source src="/roninstrategy-explainer.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            ) : (
              <div className="p-6 sm:p-8 lg:p-12">

              {/* How It Works */}
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">How it works:</h3>
              <div className="space-y-4 mb-8">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300">
                    Every ERC721 NFT collection can have a single <span className="font-semibold text-orange-600">NFTStrategy token</span> deployed for it (1 to 1)
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300">
                    Fees pool up from trades, buy NFTs for that collection, and relist them at <span className="font-semibold text-orange-600">1.2x</span>
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300">
                    When the NFT sells, all of the $RON is used to <span className="font-semibold text-orange-600">buy and burn</span> that NFTStrategy token
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300">
                    This loop runs <span className="font-semibold text-orange-600">forever</span> ♾️
                  </p>
                </div>
              </div>

              <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 mb-8 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border-l-4 border-orange-600">
                We&apos;re starting with <span className="font-bold text-orange-600">$RONKESTR</span>, the NFTStrategy token for the Ronkeverse.
              </p>

              {/* Fee Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* $RONKESTR Fees */}
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800">
                  <h4 className="text-xl font-bold text-orange-700 dark:text-orange-400 mb-4">💸 $RONKESTR Fees</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 dark:text-gray-300">NFT accumulation pool</span>
                      <span className="font-bold text-orange-600">8%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 dark:text-gray-300">Ronin Strategy Team</span>
                      <span className="font-bold text-orange-600">1%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 dark:text-gray-300">$RONKE buyback & burn</span>
                      <span className="font-bold text-orange-600">1%</span>
                    </div>
                  </div>
                </div>

                {/* NFTStrategy Tokens Fees */}
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800">
                  <h4 className="text-xl font-bold text-amber-700 dark:text-amber-400 mb-4">💸 NFTStrategy Token Fees</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 dark:text-gray-300">NFT accumulation pool</span>
                      <span className="font-bold text-amber-600">8%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 dark:text-gray-300">Collection owner</span>
                      <span className="font-bold text-amber-600">1%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700 dark:text-gray-300">$RONKESTR buyback & burn</span>
                      <span className="font-bold text-amber-600">1%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fair Launch Details */}
              <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl p-6 text-white mb-8">
                <h4 className="text-xl sm:text-2xl font-bold mb-4">🚀 Fair Launch Details</h4>
                <div className="space-y-2">
                  <p className="text-orange-100"><strong>Starting MCAP:</strong> $20K–$30K</p>
                  <p className="text-orange-100"><strong>Distribution:</strong> All tokens added to LP</p>
                  <p className="text-orange-100"><strong>Anti-sniper:</strong> Buy fees start at 99%, dropping 1% per minute until reaching 10%</p>
                  <p className="text-lg font-bold mt-4">$RONKESTR TGE: TBA soon</p>
                </div>
              </div>

              {/* North Star Message */}
              <div className="text-center bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl p-6 border-2 border-orange-300 dark:border-orange-700">
                <p className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-200">
                  $RONKE and $RONKESTR form the <span className="text-orange-600 dark:text-orange-400">north star assets</span> of the perpetual NFT economy on Ronin.
                </p>
              </div>

              {/* CTA */}
              <div className="text-center mt-8">
                <a
                  href="https://roninstrategy.fun/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-gradient-to-r from-orange-600 to-amber-600 text-white py-3 sm:py-4 px-6 sm:px-8 rounded-xl font-semibold hover:from-orange-700 hover:to-amber-700 transition-all duration-200 text-base sm:text-lg shadow-lg"
                >
                  Learn More at RoninStrategy.fun
                </a>
              </div>
            </div>
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
