# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Create production build
- `npm run start` - Run production server
- `npm run lint` - Run ESLint checks
- `npm run generate-stats` - Generate NFT statistics using ts-node

## Architecture Overview

This is a Next.js 15 (App Router) NFT explorer application that displays and filters NFT collections. The architecture follows these key patterns:

### Data Flow
- **Static Data**: NFT metadata stored in individual JSON files (`data/{id}.json`) and aggregated statistics in `nft-statistics.json`
- **API Layer**: Custom API endpoint at `/api/nfts/route.ts` that processes filtering, searching, and sorting
- **State Management**: Zustand store (`stores/general-state.tsx`) with persistence for UI state
- **Data Loading**: Utility functions in `utils/nft-loader.ts` handle data fetching with caching

### Key Components Structure
- **Layout**: `app/layout.tsx` - Root layout with ThemeProvider and font configuration
- **Main Page**: `app/page.tsx` - Server-side data fetching and component composition
- **Core Components**: 
  - `components/nft-grid.tsx` - Main NFT display grid with infinite scroll
  - `components/controls.tsx` - Search, sort, and filter controls
  - `components/header.tsx` - Navigation header

### State Management Pattern
Uses Zustand with persistence for:
- Sort preferences (`sortBy`)
- Search queries (`searchQuery`) 
- Filter states (`showCommunity`, `onlyListed`)
- Pagination state (`currentPage`, `hasMore`)

### Data Processing
- **Filtering**: Community vs non-community NFTs based on "Community 1/1" trait
- **Sorting**: By rarity score, ID (ascending/descending), or relevance for search
- **Search**: Relevance scoring based on exact ID matches, name matches, and attribute matches
- **Caching**: In-memory caching with 320-second TTL for API responses

### TypeScript Configuration
- Uses `@/*` path mapping for clean imports
- Strict mode enabled
- Configured for Next.js App Router with bundler module resolution

### Styling
- Tailwind CSS for styling
- Dark theme support via next-themes
- Radix UI components for accessible UI elements
- Custom CSS variables in `app/globals.css`

## File Organization Patterns

- `components/` - Reusable React components
- `app/` - Next.js App Router pages and API routes
- `hooks/` - Custom React hooks for data fetching and throttling
- `utils/` - Utility functions for data processing
- `stores/` - Zustand state management
- `shared/types/` - TypeScript type definitions
- `lib/` - Shared utility functions (Tailwind class merging)
- `data/` - Static NFT metadata JSON files
- `scripts/` - Build-time data generation scripts

## Important Implementation Details

- **Price Integration**: Components include price fetching from external APIs with caching
- **Performance**: Uses server-side rendering, caching, and infinite scroll for large datasets
- **Image Optimization**: Next.js Image component with configured remote patterns for NFT images
- **TypeScript**: Strict typing throughout with custom interfaces for NFT metadata and statistics