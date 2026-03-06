# CLAUDE.md - OPNet Development Context

## What is OPNet
Bitcoin L1 consensus layer for trustless smart contracts. NOT a sidechain, NOT an L2, NOT a metaprotocol. Smart contracts written in AssemblyScript, compiled to WebAssembly, executed deterministically on Bitcoin.

## Critical Rules

### Package Versions (DO NOT GUESS)
```json
{
  "@btc-vision/btc-runtime": "1.11.0-rc.4",
  "@btc-vision/transaction": "1.8.0-beta.10",
  "@btc-vision/bitcoin": "7.0.0-alpha.11",
  "@btc-vision/walletconnect": "1.1.0-beta.10",
  "opnet": "1.8.1-beta.13",
  "assemblyscript": "0.27.36"
}
```

### Smart Contracts (AssemblyScript)
- Extend `OP_NET` (or `OP_20` for tokens, `OP_721` for NFTs) from `@btc-vision/btc-runtime`
- **SafeMath** for ALL u256 operations. No raw +, -, *, /
- **No while loops** -- bounded `for` loops only
- **No iterating all map keys** -- store aggregates separately
- **Storage pointers must be unique** -- collision = data corruption. Use `Blockchain.nextPointer` 
- Constructor runs every interaction -- use `onDeployment()` for one-time init
- Method selectors are **SHA256** first 4 bytes, NOT EVM Keccak256. Use `encodeSelector('methodName')`
- OP20 uses `increaseAllowance()` / `decreaseAllowance()`, NOT `approve()`
- `StoredU256` constructor: `(pointer, EMPTY_POINTER)` -- second param is Uint8Array, not u256.Zero
- `ABIDataTypes` is globally available via decorators, NOT an importable member
- u64 literal overflow: use `u256.fromString()` for big numbers, not `u256.fromU64()`
- `super.onDeployment()` MUST be called first in your onDeployment

### Contract Compilation
```bash
npx asc src/index.ts --config asconfig.json
```
Output: `build/<ContractName>.wasm` + `abis/<ContractName>.abi.json`

### asconfig.json Template
```json
{
  "targets": {
    "release": {
      "outFile": "build/MyContract.wasm",
      "textFile": "build/MyContract.wat",
      "sourceMap": false,
      "optimizeLevel": 3,
      "shrinkLevel": 2,
      "converge": false,
      "noAssert": false,
      "runtime": "stub",
      "exportRuntime": true,
      "transform": ["@btc-vision/btc-runtime/assembly/transform"]
    }
  },
  "options": {
    "bindings": "esm",
    "lib": ["node_modules/@btc-vision/btc-runtime/assembly"]
  }
}
```

### Frontend (Vite + React + TypeScript)
- ALWAYS use `@btc-vision/walletconnect` for wallet connection (OPWallet)
- ALWAYS use `opnet` package for contract interaction via `getContract()`
- `getContract<T>(address, ABI, provider, network, sender)` -- 5 params
- **signer = null, mldsaSigner = null** in `sendTransaction()` on frontend -- wallet extension signs
- Create your OWN `JSONRpcProvider` for RPC queries. NEVER use walletconnect's provider for reads.
- NEVER import `Address` or `ABIDataTypes` from `@btc-vision/bitcoin` on frontend -- not in browser bundle. Import from `opnet` or `@btc-vision/transaction`
- ALWAYS simulate before sending: `const sim = await contract.method(args)` then `sim.sendTransaction()`
- IPFS deployment: `base: './'` in vite.config.ts, use `HashRouter` not `BrowserRouter`
- Fix walletconnect popup CSS (position:fixed, centered overlay, z-index:99999)

### Backend (Node.js + TypeScript)
- **hyper-express ONLY** -- Express/Fastify/Koa are FORBIDDEN
- signer = wallet.keypair, mldsaSigner = wallet.mldsaKeypair in sendTransaction

### RPC Endpoints
- Regtest: `https://regtest.opnet.org`
- Mainnet: `https://mainnet.opnet.org`

### Library Rules
- NEVER use `bitcoinjs-lib` -- use `@btc-vision/bitcoin` (fork)
- NEVER use `ecpair` -- use `@btc-vision/ecpair`
- NEVER use `tiny-secp256k1` -- use `@noble/curves`
- NEVER use mempool.space API or blockstream API for wallet/chain data -- use `opnet` package

### Contract Interaction Pattern
```typescript
import { getContract, IOP20Contract, OP_20_ABI, JSONRpcProvider } from 'opnet';
import { networks } from '@btc-vision/bitcoin';

const provider = new JSONRpcProvider('https://regtest.opnet.org', networks.regtest);
const contract = getContract<IOP20Contract>(address, OP_20_ABI, provider, networks.regtest, sender);

// Always simulate first
const sim = await contract.transfer(to, amount);
if ('error' in sim) throw new Error(sim.error);

// Frontend: null signers (wallet extension signs)
await sim.sendTransaction({ signer: null, mldsaSigner: null, refundTo: userAddress });
```

### NativeSwap (BTC-to-OP20 DEX)
- Virtual reserves -- no LP tokens
- Two-phase commit: reserve locks price, execute sends BTC
- CSV timelocks MANDATORY on all swap recipient addresses
- Reserve and execute MUST be different blocks

### MotoSwap (OP20-to-OP20 DEX)
- Traditional AMM with LP tokens
- Router handles multi-hop swaps
- Factory creates pools

### Address Rules
- `Address.fromString(mldsaHash, tweakedPubkey)` -- BOTH params required
- First param: 32-byte HASH of ML-DSA public key (0x-prefixed)
- Second param: Bitcoin tweaked public key (33 bytes compressed, 0x-prefixed)
- NEVER pass bc1q/bc1p strings to Address.fromString
- NEVER use P2WDA under any circumstances

### CEI Pattern (Checks-Effects-Interactions)
Always: validate inputs -> update state -> make external calls. Never call external contracts before updating your own state.

## Session Efficiency
- Keep tasks focused. One contract per session.
- Read specific files, don't dump entire directories.
- Say "do it" not "explain then do it."
- If compilation fails, paste only the error lines, not the full log.
