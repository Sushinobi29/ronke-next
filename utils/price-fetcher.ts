export async function fetchNFTPrices(tokenIds: string[]): Promise<Record<string, any>> {
    const query = `query RonkeversePriceData {
      ${tokenIds.map((id, index) => `
        token${index}: erc721Token(
          tokenAddress: "0x810b6d1374ac7ba0e83612e7d49f49a13f1de019"
          tokenId: "${id}"
        ) {
          minPrice
          order {
            basePrice
            currentPrice
          }
          highestOffer {
            currentPrice
            basePrice
            suggestedPrice
          }
        }
      `).join('\n')}
    }`;
  
    try {
      const response = await fetch('https://api-gateway.skymavis.com/graphql/mavis-marketplace', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-API-Key': process.env.NEXT_PUBLIC_RONIN_API_KEY || '', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RONIN_API_KEY}`},
        body: JSON.stringify({query}),
      });

      console.log(response)
      
      const {data} = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching prices:', error);
      return {};
    }
  }