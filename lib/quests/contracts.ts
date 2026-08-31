/**
 * Ronkeverse on-chain quest registry.
 *
 * Every address here was read out of the game's own published front-end bundle
 * and then verified against Ronin mainnet: code present at the address, and the
 * event signature keccak-matched against a log the contract actually emitted.
 * Selectors are hard-coded so nothing needs a keccak implementation at runtime.
 *
 * Chain: Ronin mainnet (2020). Never point any of this at Saigon — both the
 * casino and Age of Ronke ship a parallel testnet config in their bundles.
 */

/**
 * Ronin RPC endpoints, tried in order.
 *
 * The public node is the committed default because it needs no arrangement
 * with anyone. It is also stingy: ~30 requests a second, a sustained quota
 * behind that, and eth_getLogs capped at 200 blocks — a whole day of logs is
 * 144 requests per contract.
 *
 * Set RONIN_RPC_URL (comma-separated for several) to put something better in
 * front. A Conduit endpoint measured 45 req/s with no failures and served
 * 50,000-block ranges, which turns that same day into one request. Kept in an
 * env var rather than committed: an endpoint belongs to whoever pays for it.
 */
export const RONIN_RPCS: string[] = (process.env.RONIN_RPC_URL ?? "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean)
  .concat("https://api.roninchain.com/rpc");

export const RONIN_RPC = RONIN_RPCS[0];
export const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11";

/** Tokens and collections the quests read balances from. */
export const TOKENS = {
  RONKE: "0xf988f63bf26c3ed3fbf39922149e3e7b1e5c27cb",
  RONKESTR: "0x404533a09bf281199ce6b0ef60b7eff7123ff8dc",
  RICE: "0x9049ca10dd4cba0248226b4581443201f8f225c6",
  WRON: "0xe514d9deb7966c8be0ca922de8a064264ea6bcd4",
} as const;

export const COLLECTIONS = {
  /** Ronkeverse — the monkes themselves. */
  ronkeverse: "0x810b6d1374ac7ba0e83612e7d49f49a13f1de019",
  /** PewPewBarracks (PPB) — Age of Ronke barracks, also the Fortune Spin prize pool. */
  barracks: "0xccf604511c5d2b5c3fd61adfba3950d0d2890862",
  /** PewPew (PEWPEW) — Age of Ronke trophies. */
  trophies: "0xb7873833e7ac43c921af736f2e3988ba26a39512",
} as const;

/** Ronke Casino — coinflip settles per play, mines runs one table per token. */
export const CASINO = {
  coinflip: "0x744b467ce265dbc5078b43036271aec378821b2d",
  nftCoinflip: "0x22e8ecccbc419cda1a6b2c6fca72ee2cb239f506",
  vrfCoordinator: "0x16a62a921e7fec5bf867ff5c805b662db757b778",
} as const;

export const MINES_TABLES = [
  { key: "RON", label: "RON", address: "0xb6abe8cd26f255245782a609089f8094885715fe", decimals: 18 },
  { key: "RONKE", label: "RONKE", address: "0xa9b7d87df126ae0b80b90ded3d481209e20eb3bf", decimals: 18 },
  { key: "RICE", label: "RICE", address: "0x2846307caac69141520a7eb281bd4b9210e57b2f", decimals: 18 },
  { key: "RONKESTR", label: "RONKESTR", address: "0xb60f456ade104656829344d9a8e7e319d197a1ff", decimals: 18 },
] as const;

/**
 * Katana pairs, used to price what a wallet acquired in RON. Reading reserves
 * is one call per pool and needs no log scanning, which is what makes a
 * spend-based quest affordable on the public node.
 *
 * The token ordering is NOT the same in both pools — hard-coded per pool
 * rather than inferred, because getting it backwards silently inverts a price.
 */
export const POOLS = {
  ronke: {
    address: "0x75ae353997242927c701d4d6c2722ebef43fd2d3",
    wronIsToken0: true,
  },
  ronkestr: {
    address: "0x87b0acb34aa54cb51451050be73e9e31921154c2",
    wronIsToken0: false,
  },
} as const;

/** Ronke Vote — v3 is the live contract; the older generations still hold RON. */
export const VOTE = {
  current: "0xccdddadf9308c697889b473cce83dd9dbf56e0d4",
  superseded: [
    "0xe40d7c37462aa3d4d63f55067c1f860355d998fe",
    "0xbb3e9b8237d7158fc576cc78b48323149d76d070",
    "0x14e630c957d96babdaee8ca92fef90773167a4c2",
  ],
} as const;

/** Age of Ronke — every play emits at the v2 play contract. */
export const AGE_OF_RONKE = {
  play: "0x33b93f6eb104d32c516a1eea9bd6f704cc9601ae",
  /** An EOA, not a contract — play fees land here as plain RONKE transfers. */
  treasury: "0xff0a2d76e6156bc1c0c689fe4029f6f1a566e92e",
  /** topic0 of the play event. Its ABI is unpublished; the topic is authoritative. */
  playTopic: "0x8f81770bb1772fcb8f438b882033de596292cd1187c4e658fc3c5ba705a3168e",
} as const;

/** Fortune Spin — the gacha. A beacon proxy holding the RON people spin with. */
export const FORTUNE_SPIN = {
  pack: "0x7962c19767f10df016f1f7154b5fe286e502e023",
  beacon: "0xdba2a3ce6cf8ad6a4105d6129cf2c698d87f8f88",
  /** Spin requested: topic2 = player, topic3 = number of spins. */
  requestTopic: "0xa065705e483686a4eab1a31b0c93e97c04f173b1fdfc0163565348876f99bf01",
  /** Spin settled: topic2 = player, topic3 = total RON paid. Prizes are barracks NFTs. */
  settleTopic: "0x725806488015fa34739de3a0f351e02e41fe6b5d4577cbe4c1836c30b8eded7b",
  url: "https://marketplace.roninchain.com/fortune-spin?packAddress=0x7962c19767f10df016f1f7154b5fe286e502e023",
} as const;

/**
 * Function selectors, precomputed. Grouped by what they answer so the call
 * sites read as questions rather than as hashes.
 */
export const SELECTORS = {
  balanceOf: "0x70a08231",
  totalSupply: "0x18160ddd",
  // Ronke Casino
  playHistory: "0xff68e848", // -> (played, won)
  winStreak: "0x6ee5572b",
  gameCounter: "0x2e0be39a",
  games: "0x117a5b90", // (id) -> (id, player, bet, status, payout, seed, ...)
  // Ronke Vote
  stats: "0xd80528ae", // -> (season, votes, players, pool, uint256[4])
  getTop20: "0x1b67ffdd",
  getPlayerVotes: "0xbb58a167", // -> (total, uint256[4])
  activeCitizenCount: "0x6c793b0f",
  maxCitizensFor: "0xe4d73089",
  citizenEndowment: "0xbc86afbb",
  // Katana pair
  getReserves: "0x0902f1ac", // -> (reserve0, reserve1, blockTimestampLast)
  // Multicall3
  aggregate3: "0x82ad56cb",
} as const;

/** Mines game status codes, from the contract's own enum. */
export const MINES_STATUS = { OPEN: 0, CASHED_OUT: 1, LOST: 2 } as const;

export const EXPLORER = "https://app.roninchain.com";
