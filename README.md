# BitOracle — Bitcoin L1 Prediction Market

> The first prediction market on Bitcoin Layer 1, powered by OPNet smart contracts.

🌐 **Live:** Coming March 7, 2026  
📦 **Contract:** TBD after deployment  
🔗 **Network:** OPNet Testnet  
🏆 **Submitted:** vibecode.finance Week 3 — The Breakthrough  

---

## What is BitOracle?

BitOracle is the first trustless prediction market built natively on Bitcoin Layer 1 using OPNet's WASM smart contract infrastructure. No bridges, no wrapped tokens, no custodians — just Bitcoin.

Users can create markets on anything (crypto prices, sports, politics), bet YES or NO using OP_20 tokens, and automatically claim winnings when markets resolve — all enforced on-chain.

---

## Features

- **Create Markets** — Deploy prediction markets on any topic on Bitcoin L1
- **Bet YES / NO** — Place bets with OP_20 tokens, odds update in real time
- **Auto Payout** — Winners claim their share of the losing pool trustlessly
- **Cancellation / Refund** — Full refund if market is cancelled
- **Live Probability Bars** — Real-time odds based on pool sizes
- **Opie AI Assistant** — Voice-controlled AI guide powered by Groq (Llama 3.3 70B)
- **Market Categories** — Crypto, Sports, Politics, Other
- **Portfolio Tracker** — Track positions, P&L, and claim winnings
- **Leaderboard** — Top predictors on Bitcoin L1
- **News Sidebar** — Live BTC ticker + OPNet news feed
- **Glassmorphism UI** — Deep purple palette, frosted glass, glow effects
- **Mobile Responsive** — Works on all screen sizes

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | AssemblyScript + OPNet WASM Runtime |
| Frontend | Vanilla HTML/CSS/JS |
| AI Assistant | Groq API (Llama 3.3 70B) via Vercel Edge Function |
| Hosting | Vercel |
| Wallet | OP_WALLET |
| Fonts | DM Sans + Inter + JetBrains Mono |

---

## Smart Contract

**Contract Address:** TBD after deployment on March 7

### Methods

| Method | Description |
|--------|-------------|
| `createMarket(titleHash, deadlineBlocks, category)` | Deploy a new prediction market |
| `betYes(marketId, tokenAddress, amount)` | Bet YES on a market |
| `betNo(marketId, tokenAddress, amount)` | Bet NO on a market |
| `resolve(marketId, outcome)` | Resolve: 1=YES wins, 2=NO wins, 3=Cancel |
| `claim(marketId, tokenAddress)` | Claim winnings after resolution |
| `getMarket(marketId)` | View market data |
| `getUserPosition(user, marketId)` | View user's bets |
| `getMarketCount()` | Total markets created |

### How Payouts Work

```
Total Pool = YES Pool + NO Pool
Protocol Fee = 2% of each bet

If YES wins:
  Payout = (Your YES Bet / Total YES Pool) × Total Pool

If NO wins:
  Payout = (Your NO Bet / Total NO Pool) × Total Pool

If Cancelled:
  Full refund of your bet
```

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/jpromamen/bitoracle.git
cd bitoracle

# Open in browser
open index.html
```

To run with Opie AI working, deploy to Vercel (the `/api/chat` proxy requires a serverless environment).

---

## Building the Contract

```bash
# Install dependencies (after OPNet package upgrade)
npm uninstall assemblyscript
npm i @btc-vision/btc-runtime@rc @btc-vision/as-bignum@latest @btc-vision/assemblyscript @btc-vision/opnet-transform@latest @assemblyscript/loader@latest --prefer-online

# Build
npm run build
```

Requires Node.js 18+ and the OPNet toolchain.

---

## Project Structure

```
bitoracle/
├── index.html            # Full frontend (single file)
├── api/
│   └── chat.js           # Vercel Edge Function — Groq proxy
├── src/
│   └── prediction/
│       ├── PredictionMarket.ts
│       └── index.ts
├── package.json
└── README.md
```

---

## Contest

Built for the **vibecode.finance Week 3 — The Breakthrough** challenge.  
Theme: *Everything that ran on ETH and SOL — now on Bitcoin.*  
Tag: `#opnetvibecode`  
Category: DeFi / Prediction Market  

---

## License

MIT

---

*Built on Bitcoin Layer 1 · Powered by OPNet · #opnetvibecode*
