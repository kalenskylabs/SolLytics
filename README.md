# Sollytics

A comprehensive Solana analytics platform powered by AI that provides deep insights into wallet behavior, transaction patterns, and blockchain activity.

## Features

### 🔍 Wallet Analysis
- **Reputability Scoring**: AI-powered wallet reputation analysis using XAI
- **Transaction History**: Detailed transaction tracking and analysis
- **Token Portfolio**: Complete overview of token holdings and balances
- **NFT Summary**: NFT collection analysis and valuation

### 📊 Analytics Dashboard
- **Balance Charts**: Visual representation of wallet balance over time
- **Transaction Graphs**: Interactive transaction flow visualization
- **Activity Patterns**: Behavioral analysis and pattern recognition
- **Feature Importance**: ML-driven feature analysis for reputation scoring

### 🌐 Network Analysis
- **Developer Network Mapping**: Visualize connections between developers and contracts
- **Deployer Network Analysis**: Track contract deployment patterns
- **Fund Flow Analysis**: Follow money trails and funding sources
- **Bubble Maps**: Interactive network visualizations

### 🛠️ Developer Tools
- **Contract Address Checker**: Verify and analyze smart contracts
- **API Integration**: RESTful API for programmatic access
- **Real-time Data**: Live Solana network data via Helius

### 💰 Market Data
- **Solana Price Widget**: Real-time SOL price tracking
- **Price Charts**: Historical price data and trends
- **Market Analytics**: Comprehensive market insights

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Charts**: Recharts, D3.js
- **Blockchain**: Solana Web3.js, Helius API
- **AI**: XAI (Grok) for intelligent analysis
- **Wallet**: Solana Wallet Adapter

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Helius API key
- XAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kalenskylabs/sollytics.git
cd sollytics
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Add your API keys to `.env.local`:
```
HELIUS_RPC_URL=your_helius_rpc_url_here
XAI_API_KEY=your_xai_api_key_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `HELIUS_RPC_URL` | Helius RPC endpoint for Solana data | Yes |
| `XAI_API_KEY` | XAI API key for AI-powered analysis | Yes |

## API Endpoints

### Wallet Analysis
- `GET /api/reputability-score` - Get wallet reputability score
- `GET /api/check-ca` - Check contract address details

### Network Analysis  
- `GET /api/deployer-network` - Get deployer network data
- `GET /api/developer-network` - Get developer network connections
- `GET /api/fund-sources` - Analyze funding sources
- `GET /api/fund-flow-analysis` - Track fund flows

### Market Data
- `GET /api/solana-price` - Get current SOL price
- `GET /api/solana-chart` - Get historical price data

## Usage

### Wallet Analysis
1. Connect your Solana wallet using the wallet adapter
2. Enter a wallet address in the search bar
3. View comprehensive analytics including:
   - Reputability score and explanation
   - Transaction history and patterns
   - Token portfolio breakdown
   - NFT holdings summary

### Network Exploration
1. Navigate to the Developer Tools section
2. Explore network visualizations:
   - Developer bubble maps
   - Deployer network graphs
   - Fund source analysis
3. Use interactive filters to focus on specific patterns

### Contract Verification
1. Use the "Check CA" feature
2. Enter a contract address
3. View detailed contract analysis and risk assessment

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Message us on Twitter [@Sollytics](https://twitter.com/sollyticsdotfun)

---

Built with ❤️ by the SolLytics team.

