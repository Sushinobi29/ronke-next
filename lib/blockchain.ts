// Blockchain utility functions for Ronin network
const RONIN_RPC_URL = 'https://api.roninchain.com/rpc';
const NULL_ADDRESS = '0x000000000000000000000000000000000000dead';

interface TokenInfo {
  totalSupply: string;
  burnedAmount: string;
}

export async function fetchTokenData(contractAddress: string): Promise<TokenInfo> {
  try {
    console.log(`Fetching data for contract: ${contractAddress}`);
    
    // Fetch total supply
    const totalSupplyResponse = await fetch(RONIN_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: '0x18160ddd' // totalSupply() function selector
        }, 'latest'],
        id: 1
      })
    });

    if (!totalSupplyResponse.ok) {
      throw new Error(`HTTP error! status: ${totalSupplyResponse.status}`);
    }

    const totalSupplyData = await totalSupplyResponse.json();
    console.log('Total supply response:', totalSupplyData);
    
    // Check if there's an error in the response
    if (totalSupplyData.error) {
      throw new Error(`RPC error: ${totalSupplyData.error.message}`);
    }
    
    // Fetch burned amount (balance of dead address)
    // Properly construct balanceOf function call data
    const paddedDeadAddress = NULL_ADDRESS.slice(2).padStart(64, '0'); // Remove 0x and pad to 64 chars
    const balanceOfData = '0x70a08231' + paddedDeadAddress; // balanceOf function selector + padded address
    
    const burnedAmountResponse = await fetch(RONIN_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
          to: contractAddress,
          data: balanceOfData
        }, 'latest'],
        id: 2
      })
    });

    if (!burnedAmountResponse.ok) {
      console.warn('Burned amount fetch failed, using 0');
      return {
        totalSupply: totalSupplyData.result || '0x0',
        burnedAmount: '0x0'
      };
    }

    const burnedAmountData = await burnedAmountResponse.json();
    console.log('Burned amount response:', burnedAmountData);

    // If burned amount call failed, just use 0 but keep the total supply
    const burnedAmount = (burnedAmountData.error) ? '0x0' : (burnedAmountData.result || '0x0');
    
    return {
      totalSupply: totalSupplyData.result || '0x0',
      burnedAmount: burnedAmount
    };
  } catch (error) {
    console.error('Error fetching token data:', error);
    throw error;
  }
}

export function hexToNumber(hexString: string): number {
  // Handle large numbers that might overflow JavaScript's number precision
  return parseInt(hexString, 16);
}

export function formatTokenAmount(hexAmount: string, decimals: number = 18): number {
  try {
    // Remove '0x' prefix if present
    const cleanHex = hexAmount.startsWith('0x') ? hexAmount.slice(2) : hexAmount;
    
    // Convert hex to BigInt to handle large numbers
    const amount = BigInt('0x' + cleanHex);
    const divisor = BigInt(10 ** decimals);
    
    // Convert to number (may lose precision for very large numbers)
    return Number(amount / divisor);
  } catch (error) {
    console.error('Error parsing hex amount:', hexAmount, error);
    return 0;
  }
} 