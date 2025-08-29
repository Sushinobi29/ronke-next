'use client';

import { useEffect, useState } from "react";

export default function StakingSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [daysLeft, setDaysLeft] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    const section = document.getElementById('ronke-staking');
    if (section) {
      observer.observe(section);
    }

    return () => {
      if (section) {
        observer.unobserve(section);
      }
    };
  }, []);

  useEffect(() => {
    // Start date: August 29, 2025 (today)
    const startDate = new Date('2025-08-29');
    // End date: 69 days from start date (November 6, 2025)
    const endDate = new Date(startDate.getTime() + (69 * 24 * 60 * 60 * 1000));
    
    const timer = setInterval(() => {
      const now = new Date();
      const distance = endDate.getTime() - now.getTime();
      
      if (distance > 0) {
        const days = Math.ceil(distance / (1000 * 60 * 60 * 24));
        setDaysLeft(days);
        
        // Calculate progress: days passed out of total 69 days
        const totalDays = 69;
        const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const progressPercentage = Math.max(0, Math.min(100, (daysPassed / totalDays) * 100));
        setProgress(progressPercentage);
      } else {
        setDaysLeft(0);
        setProgress(100);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section id="ronke-staking" className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-black dark:via-gray-900 dark:to-black py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className={`text-center mb-16 transition-all duration-1000 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <h2 className="text-5xl md:text-7xl font-extralight text-gray-900 dark:text-gray-100 mb-4">
            RONKE <span className="text-emerald-600 font-thin">STAKING</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Stake your <span className="text-emerald-600 font-medium">Ronke NFTs</span> and 
            <span className="text-emerald-600 font-medium"> $RONKE tokens</span> during the remainder of the 
            <span className="font-bold text-emerald-700"> 69-day season</span> to earn 
            <span className="text-yellow-600 font-bold"> $RICE rewards</span> and additional bonus points.
          </p>
        </div>

        {/* Main Staking Card */}
        <div className={`transition-all duration-1000 ease-out delay-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden mb-16">
            <div className="flex flex-col lg:flex-row">
              
              {/* Left Side - Season Info */}
              <div className="lg:w-1/2 p-8 lg:p-12 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <div className="mb-8">
                  <h3 className="text-3xl lg:text-4xl font-bold mb-4">69-Day Season</h3>
                  <p className="text-emerald-100 text-lg leading-relaxed">
                    The longer you commit your assets, the greater the potential rewards delivered in true RONKE fashion.
                  </p>
                </div>

                {/* Season Countdown */}
                <div className="bg-white/10 rounded-2xl p-6 mb-6 backdrop-blur-sm">
                  <h4 className="text-xl font-semibold mb-6 flex items-center">
                    <span className="text-2xl mr-3">⏰</span>
                    Season Countdown
                  </h4>
                  
                  {/* Days Left Display */}
                  <div className="text-center mb-6">
                    <div className="bg-white/20 rounded-2xl p-6">
                      <div className="font-bold text-6xl text-yellow-300 mb-2">{daysLeft}</div>
                      <div className="text-emerald-100 text-xl font-medium">Days Left</div>
                    </div>
                  </div>
                  
                  {/* Simple Progress Bar */}
                  <div className="w-full bg-white/20 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-3 rounded-full transition-all duration-1000 ease-out" 
                      style={{width: `${progress}%`}}
                    ></div>
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-emerald-100 text-sm">Day {Math.floor(progress * 69 / 100) + 1} of 69</span>
                  </div>
                </div>

                {/* Requirements */}
                <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                  <h4 className="text-xl font-semibold mb-4 flex items-center">
                    <span className="text-2xl mr-3">✅</span>
                    Check List
                  </h4>
                  <p className="text-emerald-100 leading-relaxed">
                    To participate, ensure that you hold a minimum of{' '}
                    <span className="font-bold text-yellow-300">69,000 $RONKE tokens</span> as well as{' '}
                    <span className="font-bold text-yellow-300">at least one RONKE NFT</span>.
                  </p>
                </div>
              </div>

              {/* Right Side - Rewards & Features */}
              <div className="lg:w-1/2 p-8 lg:p-12">
                <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8">
                  Earn <span className="text-yellow-600">$RICE</span> Rewards
                </h3>

                {/* Reward Pool */}
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 mb-8 border border-yellow-200">
                  <h4 className="text-2xl font-bold text-yellow-700 mb-4 flex items-center">
                    <span className="text-3xl mr-3">🍚</span>
                    1,250,000 $RICE Pool
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-gray-700">
                          <span className="font-bold text-yellow-700">840,000 $RICE</span> distributed linearly across 69 days to all stakers
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-gray-700">
                          <span className="font-bold text-yellow-700">440,000 $RICE</span> reserved for participants who commit to a full 69-day lock-up
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Jeet Jail Warning */}
                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-6 mb-8 border border-red-200">
                  <h4 className="text-xl font-bold text-red-700 mb-3 flex items-center">
                    <span className="text-2xl mr-3">🔒</span>
                    Jeet Jail
                  </h4>
                  <p className="text-gray-700">
                    Early unstake triggers a <span className="font-bold text-red-600">14-day cooldown</span> where you cannot stake again.
                  </p>
                </div>

                                 {/* Action Buttons */}
                 <div className="space-y-4">
                   <a 
                     href="https://stake.ronkeverse.com"
                     target="_blank"
                     rel="noopener noreferrer"
                     className="block w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 px-8 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 text-lg text-center"
                   >
                     🥩 Start Staking
                   </a>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Features */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 transition-all duration-1000 ease-out delay-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          
          {/* Feature 1 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <div className="text-4xl mb-4">💎</div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Stake NFTs & Tokens</h4>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Combine your RONKE NFTs and $RONKE tokens for maximum earning potential during the 69-day season.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <div className="text-4xl mb-4">⚡</div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Bonus Points</h4>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Earn additional bonus points on top of your $RICE rewards for extra benefits in the ecosystem.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <div className="text-4xl mb-4">🚀</div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">Long-term Rewards</h4>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              The longer you commit, the greater your rewards. Full 69-day lock-up participants get exclusive bonuses.
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className={`text-center mt-16 transition-all duration-1000 ease-out delay-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <p className="text-lg text-gray-600 mb-8">
            Ready to stake your RONKE assets and earn $RICE rewards?
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="https://stake.ronkeverse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors duration-200 font-semibold text-lg shadow-lg"
            >
              🥩 Start Staking Now
            </a>
          </div>
        </div>

      </div>
    </section>
  );
} 