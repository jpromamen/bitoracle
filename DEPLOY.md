# BitOracle — Deployment Guide
## First Prediction Market on Bitcoin L1 · OPNet Week 3

---

## Step 1 — Setup (run in CMD)

```
cd C:\Users\MSI\example-contracts

rem Clean install with new packages
del package-lock.json
rmdir /s /q node_modules
npm uninstall assemblyscript

rem Install updated OPNet packages
npx npm-check-updates -u && npm i @btc-vision/btc-runtime@rc @btc-vision/as-bignum@latest @btc-vision/assemblyscript @btc-vision/opnet-transform@latest @assemblyscript/loader@latest --prefer-online
```

---

## Step 2 — Add Contract Files

Copy `PredictionMarket.ts` and `index.ts` into:
```
C:\Users\MSI\example-contracts\src\prediction\
```

---

## Step 3 — Update asconfig.json

Add this target to your `asconfig.json`:

```json
{
  "targets": {
    "release": {
      "outFile": "build/PredictionMarket.wasm",
      "optimizeLevel": 3,
      "shrinkLevel": 2,
      "converge": false,
      "noAssert": false
    }
  },
  "options": {
    "exportRuntime": false,
    "runtime": "stub",
    "use": "abort=",
    "transform": "@btc-vision/opnet-transform"
  }
}
```

---

## Step 4 — Build

```
npm run build:prediction
```

Should produce: `build/PredictionMarket.wasm`

---

## Step 5 — Deploy to Testnet

Open OP_WALLET → go to testnet → deploy contract:
- Upload: `build/PredictionMarket.wasm`
- No constructor args needed

**Save the contract address!**

---

## Step 6 — Update Frontend

In `index.html`, replace `CONTRACT_ADDRESS` with your deployed address.

---

## Step 7 — Deploy Frontend

```
git add .
git commit -m "BitOracle: First prediction market on Bitcoin L1 - Week 3"
git push
```

Vercel auto-deploys. Done!

---

## Contract Methods

| Method | Description |
|--------|-------------|
| `createMarket(titleHash, deadlineBlocks, category)` | Create a new prediction market |
| `betYes(marketId, tokenAddress, amount)` | Bet YES on a market |
| `betNo(marketId, tokenAddress, amount)` | Bet NO on a market |
| `resolve(marketId, outcome)` | Resolve: 1=YES wins, 2=NO wins, 3=Cancel |
| `claim(marketId, tokenAddress)` | Claim winnings after resolution |
| `getMarket(marketId)` | View market data |
| `getUserPosition(user, marketId)` | View user's bets |
| `getMarketCount()` | Total markets created |

---

*BitOracle · The first prediction market on Bitcoin L1 · #opnetvibecode*
