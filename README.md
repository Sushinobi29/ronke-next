**Ronkeverse - NFT Explorer**  
**Discover and explore the Ronkeverse**

---

### 🚀 Overview

This project is a Next.js-powered NFT exploration platform that enables users to browse, filter, and sort digital assets for the ronkeverse based on rarity, ID, and relevance. Built for performance and usability, it integrates real-time search and pagination.

---

### ✨ Features

- **Dynamic Grid Display**: Responsive NFT grid with lazy loading.
- **Advanced Filtering**:
  - Sort by rarity (ascending/descending)
  - Sort by NFT ID (ascending/descending)
  - Filter community vs. non-community assets
- **Relevance Search**: Search NFTs by name, traits, or partial ID matches.
- **State Management**: Zustand for global state (filters, pagination, search).
- **Performance**: Server-side rendering (SSR), API caching, and optimized asset loading.

---

### 🛠️ Technologies

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **State Management**: Zustand
- **Icons**: Lucide React
- **Data**: Local JSON-based NFT metadata and statistics
- **Tools**: pnpm, ESLint, Prettier

---

### 📥 Installation

1. **Prerequisites**:

   - Node.js v18+
   - pnpm (`npm install -g pnpm`)

2. **Setup**:

   ```bash
   # Clone the repository
   git clone https://github.com/Clstialdev/ronke-next.git
   cd ronke-next

   # Install dependencies
   pnpm install

   # Set up environment variables (create .env.local)
   cp .env.example .env.local

   # Start the development server
   pnpm dev
   ```

---

### ⚙️ Configuration

Add the following to `.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api/nfts
```

---

### 📂 Project Structure

```bash
├── app/                   # App Router routes
├── components/            # Reusable UI components (SearchBar, Sort, NFTGrid)
├── stores/                # Zustand state management
├── hooks/                 # Custom hooks
├── utils/                 # Utilities (NFT data loader, API helpers)
├── data/                  # NFT metadata JSON files
├── public/                # Static assets
└── shared/types/          # TypeScript type definitions
```

---

### 🧩 Scripts

| Command               | Description                        |
| --------------------- | ---------------------------------- |
| `pnpm dev`            | Start development server           |
| `pnpm build`          | Create optimized production build  |
| `pnpm start`          | Run production build               |
| `pnpm lint`           | Run ESLint for code quality checks |
| `pnpm generate-stats` | Generate statistics and rankings   |

---

### 🌐 API Endpoints

- **GET `/api/nfts`**: Fetch paginated NFT data.  
  **Query Parameters**:
  ```ts
  {
    page?: number;     // Pagination page (default: 1)
    limit?: number;    // Items per page (default: 80)
    sortBy?: string;   // "rarity-desc", "id-asc", etc.
    search?: string;   // Search query
    showCommunity?: boolean; // Filter community NFTs
  }
  ```

---

### 🧠 State Management

Global store (Zustand) manages:

- **Sorting**: `sortBy`
- **Search**: `searchQuery`
- **Pagination**: `currentPage`, `hasMore`
- **Filters**: `showCommunity`

**Example Usage**:

```typescript
const { sortBy, setSortBy } = useStore((state) => ({
  sortBy: state.sortBy,
  setSortBy: state.setSortBy,
}));
```

---

### 🖼️ Data Sources

1. **nft-statistics.json**: Contains rarity scores and rankings.
2. **data/{id}.json**: Individual NFT metadata (name, attributes, image).

---

### 🤝 Contributing

1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
4. Open a pull request with a detailed description.

---

### 📄 License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0) license.
You are free to:

    Share: Copy and redistribute the material in any medium or format.

    Adapt: Remix, transform, and build upon the material.

Under the following terms:

    Attribution: You must give appropriate credit, provide a link to the license, and indicate if changes were made.

    NonCommercial: You may not use the material for commercial purposes.

Full License Details:

For the full legal text of the license, visit Creative Commons BY-NC 4.0.

---

**Disclaimer**: This project is a demo and not affiliated with any official NFT collection. I do not own any Ronke NFTs, nor am I an investor in any NFT collection. This project is purely for educational and demonstration purposes.
