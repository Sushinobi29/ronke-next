import { Attribute, NFTMetadata } from "../shared/types/Metadata";
import fs from "fs";
import path from "path";

interface TraitStats {
  count: number;
  rarity: number;
}

interface AttributeStats {
  [traitType: string]: {
    [value: string]: TraitStats;
  };
}

interface NFTRarity {
  id: number;
  name: string;
  rarityScore: number;
  attributes: Attribute[];
}

class NFTStatsGenerator {
  private metadata: NFTMetadata[] = [];
  private attributeStats: AttributeStats = {};
  private nftRarities: NFTRarity[] = [];
  private totalNFTs: number = 0;

  async loadMetadata() {
    const dataDir = path.join(process.cwd(), "data");
    const files = fs.readdirSync(dataDir);

    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = path.join(dataDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        this.metadata.push(data);
      }
    }
    this.totalNFTs = this.metadata.length;
    console.log(`Loaded ${this.totalNFTs} NFTs`);
  }

  calculateTraitStats() {
    // Initialize attribute stats
    this.metadata.forEach((nft) => {
      nft.attributes.forEach((attr) => {
        if (!this.attributeStats[attr.trait_type]) {
          this.attributeStats[attr.trait_type] = {};
        }
        if (!this.attributeStats[attr.trait_type][attr.value]) {
          this.attributeStats[attr.trait_type][attr.value] = {
            count: 0,
            rarity: 0,
          };
        }
        this.attributeStats[attr.trait_type][attr.value].count++;
      });
    });

    // Calculate rarity for each trait value
    Object.keys(this.attributeStats).forEach((traitType) => {
      Object.keys(this.attributeStats[traitType]).forEach((value) => {
        const count = this.attributeStats[traitType][value].count;
        this.attributeStats[traitType][value].rarity = count / this.totalNFTs;
      });
    });
  }

  calculateNFTRarities() {
    this.nftRarities = this.metadata.map((nft) => {
      const rarityScore = this.calculateRarityScore(nft.attributes);
      const id = parseInt(nft.name.split("#")[1]);
      return {
        id,
        name: nft.name,
        rarityScore,
        attributes: nft.attributes,
      };
    });

    // Sort NFTs by rarity score (descending)
    this.nftRarities.sort((a, b) => b.rarityScore - a.rarityScore);
  }

  private calculateRarityScore(attributes: Attribute[]): number {
    let score = 0;
    
    // Check for special 1/1 trait first
    const isSpecial1of1 = attributes.some(
      attr => attr.trait_type === "Special" && attr.value === "1/1"
    );
    
    // Calculate base rarity score
    score = attributes.reduce((sum, attr) => {
      const traitRarity = this.attributeStats[attr.trait_type][attr.value].rarity;
      return sum + 1 / traitRarity;
    }, 0);

    // Apply multiplier for special 1/1 NFTs
    // You can adjust the multiplier (2.5) to make special NFTs more or less rare
    if (isSpecial1of1) {
      score *= 3.5;
    }

    return score;
  }

  generateStatistics() {
    const statistics = {
      totalNFTs: this.totalNFTs,
      traitDistribution: this.attributeStats,
      nftRankings: this.nftRarities.map((nft, index) => ({
        rank: index + 1,
        id: nft.id,
        name: nft.name,
        rarityScore: nft.rarityScore,
      })),
      traitCounts: Object.keys(this.attributeStats).reduce((acc, traitType) => {
        acc[traitType] = Object.keys(this.attributeStats[traitType]).length;
        return acc;
      }, {} as { [key: string]: number }),
    };

    // Write statistics to file
    fs.writeFileSync(
      path.join(process.cwd(), "nft-statistics.json"),
      JSON.stringify(statistics, null, 2)
    );

    console.log("Statistics generated successfully!");
  }

  async generate() {
    await this.loadMetadata();
    this.calculateTraitStats();
    this.calculateNFTRarities();
    this.generateStatistics();
  }
}

// Run the generator
const generator = new NFTStatsGenerator();
generator.generate().catch(console.error);
