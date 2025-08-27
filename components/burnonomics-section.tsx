'use client';

import { useEffect, useState } from "react";
import { fetchTokenData, formatTokenAmount } from "@/lib/blockchain";

interface TokenData {
  symbol: string;
  name: string;
  totalSupply: number;
  burnedAmount: number;
  burnPercentage: number;
  contractAddress: string;
}

export default function BurnonomicsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [tokenData, setTokenData] = useState<TokenData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    const section = document.getElementById('burnonomics');
    if (section) {
      observer.observe(section);
    }

    return () => {
      if (section) {
        observer.unobserve(section);
      }
    };
  }, []);

  // Fetch blockchain data
  useEffect(() => {
    const fetchAllTokenData = async () => {
      setIsLoading(true);
      try {
        const tokens = [
          {
            symbol: 'RONKE',
            name: 'Ronke Token',
            contractAddress: '0xf988F63Bf26c3Ed3fBf39922149E3E7B1e5c27Cb',
            decimals: 18
          },
          {
            symbol: 'RICE',
            name: 'Ronke Rice Farmer Token',
            contractAddress: '0x9049ca10dd4cba0248226b4581443201f8f225c6',
            decimals: 18
          }
        ];

        const tokenDataPromises = tokens.map(async (token) => {
          try {
            const blockchainData = await fetchTokenData(token.contractAddress);
            console.log(`${token.symbol} blockchain data:`, blockchainData);
            
            const totalSupply = formatTokenAmount(blockchainData.totalSupply, token.decimals);
            const burnedAmount = formatTokenAmount(blockchainData.burnedAmount, token.decimals);
            const burnPercentage = totalSupply > 0 ? (burnedAmount / totalSupply) * 100 : 0;

            console.log(`${token.symbol} processed:`, {
              totalSupply,
              burnedAmount,
              burnPercentage
            });

            return {
              symbol: token.symbol,
              name: token.name,
              totalSupply: Math.round(totalSupply),
              burnedAmount: Math.round(burnedAmount),
              burnPercentage: Math.round(burnPercentage * 100) / 100, // Round to 2 decimal places
              contractAddress: token.contractAddress
            };
          } catch (error) {
            console.error(`Error fetching data for ${token.symbol}:`, error);
            // If blockchain call fails, still return structure but with 0 values so we can see what failed
            return {
              symbol: token.symbol,
              name: token.name,
              totalSupply: 0,
              burnedAmount: 0,
              burnPercentage: 0,
              contractAddress: token.contractAddress
            };
          }
        });

        const results = await Promise.all(tokenDataPromises);
        setTokenData(results);
      } catch (error) {
        console.error('Error fetching token data:', error);
        // If everything fails, show empty data so we can debug
        setTokenData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllTokenData();
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <section id="burnonomics" className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className={`text-center mb-16 transition-all duration-1000 ease-out ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <h2 className="text-5xl md:text-7xl font-extralight text-gray-900 mb-4">
            BURN<span className="text-red-600 font-thin">ONOMICS</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Deflationary tokenomics through <span className="text-red-600 font-medium">casino buybacks</span>, 
            <span className="text-red-600 font-medium"> RRF burns</span>, and 
            <span className="text-red-600 font-medium"> community incentives</span> - 
            increasing scarcity across the Ronkeverse ecosystem.
          </p>
        </div>

        {/* Explanation Section */}
        <div className={`mb-16 transition-all duration-1000 ease-out delay-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <div className="bg-white rounded-3xl shadow-2xl p-8 lg:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <div className="text-center">
                <div className="text-4xl mb-4">🎰</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Casino Revenue Burns</h3>
                <p className="text-gray-600 leading-relaxed">
                  A percentage of casino profits are automatically used to buy back and burn tokens, 
                  directly reducing circulating supply with every game played.
                </p>
              </div>

              <div className="text-center">
                <div className="text-4xl mb-4">🌾</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">RRF Farming Burns</h3>
                <p className="text-gray-600 leading-relaxed">
                  Ronke Rice Farmer operations include systematic token burns as part of the 
                  yield farming mechanics, creating deflationary pressure.
                </p>
              </div>

            

            </div>
          </div>
        </div>

        {/* Token Burn Progress */}
        <div className={`space-y-8 transition-all duration-1000 ease-out delay-500 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading blockchain data...</p>
            </div>
          ) : (
            tokenData.map((token, index) => (
              <div key={token.symbol} className={`transition-all duration-1000 ease-out delay-${700 + index * 200}`}>
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden hover:shadow-3xl transition-shadow duration-500">
                  <div className="p-8 lg:p-12">
                    
                    {/* Token Header */}
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-3xl font-bold text-gray-900">${token.symbol}</h3>
                        <p className="text-gray-600">{token.name}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-red-600">{token.burnPercentage}%</div>
                        <div className="text-sm text-gray-500">Burned</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-6">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Burned: {formatNumber(token.burnedAmount)} {token.symbol}</span>
                        <span>Total Supply: {formatNumber(token.totalSupply)} {token.symbol}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-2000 ease-out"
                          style={{ 
                            width: isVisible ? `${token.burnPercentage}%` : '0%',
                            transitionDelay: `${800 + index * 200}ms`
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <div className="text-sm text-gray-500 mb-1">Circulating Supply</div>
                        <div className="text-lg font-bold text-gray-900">
                          {formatNumber(token.totalSupply - token.burnedAmount)} {token.symbol}
                        </div>
                      </div>
                      
                      <div className="bg-red-50 rounded-xl p-4">
                        <div className="text-sm text-gray-500 mb-1">Burned Forever</div>
                        <div className="text-lg font-bold text-red-600">
                          {formatNumber(token.burnedAmount)} {token.symbol}
                        </div>
                      </div>
                      
                      <div className="bg-orange-50 rounded-xl p-4">
                        <div className="text-sm text-gray-500 mb-1">Deflation Rate</div>
                        <div className="text-lg font-bold text-orange-600">
                          {token.burnPercentage}% Burned
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            ))
          )}

        </div>

        {/* Call to Action */}
        <div className={`text-center mt-16 transition-all duration-1000 ease-out delay-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <p className="text-lg text-gray-600 mb-8">
            Every transaction in the Ronkeverse contributes to the deflationary pressure
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="https://games.ronkeverse.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors duration-200 font-semibold text-lg shadow-lg"
            >
              🎰 Play & Burn
            </a>
            <a 
              href="https://ronkericefarmer.com/"
              className="px-8 py-4 border-2 border-red-600 text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-all duration-200 font-semibold text-lg"
            >
              🌾 Farm & Burn
            </a>
          </div>
        </div>

      </div>
    </section>
  );
} 