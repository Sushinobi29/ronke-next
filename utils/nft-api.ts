interface NFTAPIParams {
    page: number;
    limit: number;
    sortBy?: string;
    search?: string;
    showCommunity?: boolean;
  }
  
  export function buildNFTsEndpoint(params: NFTAPIParams): string {
    const base = '/api/nfts?';
    const query = new URLSearchParams({
      page: params.page.toString(),
      limit: params.limit.toString(),
      ...(params.sortBy && { sortBy: params.sortBy }),
      ...(params.search && { search: params.search }),
      ...(params.showCommunity !== undefined && { 
        showCommunity: params.showCommunity.toString() 
      })
    });
    return base + query.toString();
  }
  
  export async function fetchNFTs(params: NFTAPIParams) {
    const endpoint = buildNFTsEndpoint(params);
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error('Failed to fetch NFTs');
    return response.json();
  }