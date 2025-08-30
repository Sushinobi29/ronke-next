'use client';

import { useEffect, useState } from "react";

export default function CasinoSection() {
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

    const section = document.getElementById('ronke-casino');
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
    <section id="ronke-casino" className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 dark:from-black dark:via-gray-900 dark:to-black py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className={`text-center mb-16 transition-all duration-1000 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <h2 className="text-5xl md:text-7xl font-extralight text-gray-900 dark:text-gray-100 mb-4">
            RONKE <span className="text-purple-600 font-thin">CASINO</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Enter the high-stakes world of blockchain gaming where <span className="text-purple-600 font-medium">tokens and NFTs</span> are your chips, 
            and fortune favors the bold.
          </p>
        </div>

        {/* Games Section */}
        <div className="space-y-16 mb-20">
          
          {/* Coinflip Game Card - Image Left, Text Right */}
          <div className={`transition-all duration-1000 ease-out delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden hover:shadow-3xl transition-shadow duration-500">
              <div className="flex flex-col lg:flex-row">
                {/* Live Game Section */}
                <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-8 bg-gray-50 dark:bg-gray-700">
                  <div className="w-full max-w-2xl h-96 lg:h-[500px] rounded-xl shadow-lg overflow-hidden border-2 border-orange-200">
                    <iframe
                      src="https://games.ronkeverse.com/"
                      width="100%"
                      height="100%"
                      className="border-0 rounded-xl"
                      title="Ronke Coinflip - Live Game"
                      allow="fullscreen"
                    />
                  </div>
                </div>
                
                {/* Content Section */}
                <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100">Coinflip</h3>
                    <div className="bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-medium">
                      50/50 Odds
                    </div>
                  </div>
                  
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-8">
                    The ultimate test of luck. Bet your <span className="font-semibold text-purple-600">$RONKE tokens</span> or 
                    <span className="font-semibold text-purple-600"> Ronkeverse NFTs</span> on heads or tails. 
                    Win and <span className="font-bold text-green-600">double your bet</span>, lose and walk away empty-handed.
                  </p>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-300"><strong>Simple:</strong> Just pick heads or tails</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-300"><strong>Fair:</strong> Provably fair 50/50 odds</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-300"><strong>Instant:</strong> Win or lose in seconds</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-300"><strong>High Stakes:</strong> Bet tokens or NFTs</span>
                    </div>
                  </div>

                  <button className="bg-gradient-to-r from-orange-500 to-red-600 text-white py-4 px-8 rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 transition-all duration-200 text-lg">
                    Play Coinflip
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mines Game Card - Text Left, Image Right */}
          <div className={`transition-all duration-1000 ease-out delay-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden hover:shadow-3xl transition-shadow duration-500">
              <div className="flex flex-col lg:flex-row">
                {/* Content Section */}
                <div className="lg:w-1/2 p-8 lg:p-12 flex flex-col justify-center order-2 lg:order-1">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100">Mines</h3>
                    <div className="bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm font-medium">
                      High Risk
                    </div>
                  </div>
                  
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-8">
                    Navigate the treacherous minefield where <span className="font-semibold text-red-600">one mine lurks in each row</span>. 
                    Climb higher for bigger multipliers, but one wrong step and you lose everything. 
                    Cash out anytime to secure your winnings.
                  </p>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-300"><strong>Strategy:</strong> Risk vs reward decisions</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-300"><strong>Multipliers:</strong> Higher rows = bigger rewards</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-300"><strong>Cash Out:</strong> Secure winnings anytime</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-300"><strong>One Mine:</strong> Per row increases tension</span>
                    </div>
                  </div>

                  <button className="bg-gradient-to-r from-gray-700 to-black text-white py-4 px-8 rounded-xl font-semibold hover:from-gray-800 hover:to-gray-900 transition-all duration-200 text-lg">
                    Enter Minefield
                  </button>
                </div>

                {/* Live Game Section */}
                <div className="lg:w-1/2 order-1 lg:order-2 flex items-center justify-center p-6 lg:p-8 bg-gray-50 dark:bg-gray-700">
                  <div className="w-full max-w-2xl h-96 lg:h-[500px] rounded-xl shadow-lg overflow-hidden border-2 border-red-200">
                    <iframe
                      src="https://games.ronkeverse.com/mines"
                      width="100%"
                      height="100%"
                      className="border-0 rounded-xl"
                      title="Ronke Mines - Live Game"
                      allow="fullscreen"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seasonal Rewards & Live Leaderboard Section */}
        <div className={`transition-all duration-1000 ease-out delay-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <div className="bg-[#27B9FC] rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-8 lg:p-12 text-white">
              <div className="flex items-center mb-8">
                <div className="text-4xl mr-4">🏆</div>
                <h3 className="text-3xl lg:text-4xl font-bold">Leaderboard Competition</h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Left Column - Description */}
                <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl p-6 shadow-xl h-full border border-white/30 dark:border-gray-600/30">
                                      <p className="text-lg lg:text-xl leading-relaxed mb-6 text-gray-700 dark:text-gray-300">
                    Every <span className="font-bold text-[#27B9FC]">2 weeks</span>, the casino resets and a new season begins. 
                    Compete across 4 categories and secure your place among the elite.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-[#27B9FC]/20 dark:border-gray-600/30">
                      <h4 className="text-lg font-semibold mb-2 text-[#27B9FC] dark:text-blue-400">🤑 Highest Winnings</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-100">Total profit earned across all games</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-[#27B9FC]/20 dark:border-gray-600/30">
                      <h4 className="text-lg font-semibold mb-2 text-[#27B9FC] dark:text-blue-400">🚀 Most Flips</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-100">Total number of coinflips played</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-[#27B9FC]/20 dark:border-gray-600/30">
                      <h4 className="text-lg font-semibold mb-2 text-[#27B9FC] dark:text-blue-400">🔥 Highest Volume</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-100">Total amount wagered across games</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-[#27B9FC]/20 dark:border-gray-600/30">
                      <h4 className="text-lg font-semibold mb-2 text-[#27B9FC] dark:text-blue-400">🤡 Most Ronke</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-100">Biggest losses (honorable mention!)</p>
                    </div>
                  </div>

                  <div className="mt-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-[#27B9FC]/20 dark:border-gray-600/30">
                    <h4 className="text-lg font-semibold mb-2 text-[#27B9FC] dark:text-blue-400">🎁 How to Win</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-100">
                      Top 100 players in each category automatically qualify for the raffle. 
                      Prizes awarded every 2 weeks including exclusive NFTs and bonus tokens!
                    </p>
                  </div>
                </div>

                {/* Right Column - Live Leaderboard */}
                <div>
                  <div className="bg-white/95 dark:bg-gray-800/95 rounded-2xl p-6 shadow-xl h-full border border-white/30 dark:border-gray-600/30">
                    <h4 className="text-xl font-bold mb-4 text-center text-[#27B9FC]">🎮 Live Leaderboard</h4>
                    <div className="relative h-96 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl overflow-hidden shadow-inner border-2 border-[#27B9FC]/20">
                      <iframe
                        src="https://games.ronkeverse.com/leaderboard"
                        width="100%"
                        height="100%"
                        className="border-0 rounded-xl"
                        title="Ronke Casino Live Leaderboard"
                        allow="fullscreen"
                      />
                    </div>
                    <p className="text-xs text-gray-600 text-center mt-2">
                      Live data from games.ronkeverse.com
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className={`text-center mt-16 transition-all duration-1000 ease-out delay-900 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <p className="text-lg text-gray-600 mb-8">
            Ready to test your luck and strategy in the Ronkeverse Casino?
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="https://games.ronkeverse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors duration-200 font-semibold text-lg shadow-lg"
            >
              🎰 Enter Casino
            </a>
           
          </div>
        </div>

      </div>
    </section>
  );
} 