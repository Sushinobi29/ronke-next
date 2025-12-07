// Blockchain utility functions for Ronin network
const RONIN_RPC_URL = 'https://api.roninchain.com/rpc';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dead';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

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
    
    // Fetch burned amount from both dead address and zero address
    const paddedDeadAddress = DEAD_ADDRESS.slice(2).padStart(64, '0');
    const paddedZeroAddress = ZERO_ADDRESS.slice(2).padStart(64, '0');

    // Fetch balance of dead address
    const deadBalanceResponse = await fetch(RONIN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: contractAddress, data: '0x70a08231' + paddedDeadAddress }, 'latest'],
        id: 2
      })
    });

    // Fetch balance of zero address
    const zeroBalanceResponse = await fetch(RONIN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: contractAddress, data: '0x70a08231' + paddedZeroAddress }, 'latest'],
        id: 3
      })
    });

    let deadBalance = '0x0';
    let zeroBalance = '0x0';

    if (deadBalanceResponse.ok) {
      const deadData = await deadBalanceResponse.json();
      console.log('Dead address balance:', deadData);
      if (!deadData.error) deadBalance = deadData.result || '0x0';
    }

    if (zeroBalanceResponse.ok) {
      const zeroData = await zeroBalanceResponse.json();
      console.log('Zero address balance:', zeroData);
      if (!zeroData.error) zeroBalance = zeroData.result || '0x0';
    }

    // Sum both burn addresses
    const deadAmount = BigInt(deadBalance);
    const zeroAmount = BigInt(zeroBalance);
    const totalBurned = deadAmount + zeroAmount;

    return {
      totalSupply: totalSupplyData.result || '0x0',
      burnedAmount: '0x' + totalBurned.toString(16)
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