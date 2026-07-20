# Security Documentation — Onramp BOB→USDT

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Threat Model](#threat-model)
3. [Smart Contract Security](#smart-contract-security)
4. [Backend Security](#backend-security)
5. [Frontend Security](#frontend-security)
6. [Emergency Procedures](#emergency-procedures)
7. [Key Management](#key-management)
8. [Monitoring & Alerts](#monitoring-alerts)

---

## Architecture Overview

```
User (Browser)
    ↓ HTTPS
Frontend (Next.js)
    ↓ API calls + x-api-key
Backend (Node.js + Express)
    ↓ Ethers.js
Polygon Smart Contract (EscrowMaster)
    ↓ SafeERC20
USDT Token
```

**Trust boundaries:**
- Frontend ↔ Backend: API key authentication
- Backend ↔ Contract: OPERATOR private key signs EIP-712
- Contract ↔ USDT: Standard ERC-20 approvals
- OpenBCB ↔ Backend: HMAC webhook signature

---

## Threat Model

### Actors
| Actor | Access | Incentive |
|-------|--------|-----------|
| User | Frontend only | Buy USDT at fair rate |
| LP | Frontend + Contract (LP_ADMIN) | Earn spread on trades |
| OPERATOR | Backend + Contract | Earn platform fee |
| ARBITER | Contract (pause/unpause) | Resolve disputes |
| Admin | Backend + Contract | System administration |
| Attacker | Any | Steal funds, grief users |

### Assets
- USDT in EscrowMaster contract
- OPERATOR private key
- User payment data
- Pricing data

---

## Smart Contract Security

### Controls Implemented

| Control | Implementation | Status |
|---------|---------------|--------|
| Reentrancy | `nonReentrant` on all state-changing functions | ✅ |
| Access Control | `AccessControlEnumerable` with 3 roles | ✅ |
| Idempotency | `userOpId` mapping prevents double-trade | ✅ |
| Signature Replay | `_signatureUsed` mapping | ✅ |
| Integer Overflow | Solidity 0.8.x built-in checks | ✅ |
| Safe Transfers | `SafeERC20` for all USDT operations | ✅ |
| Emergency Stop | `Pausable` with ARBITER role | ✅ |
| Time-lock | 24h delay on LP withdrawals | ✅ |
| Daily Limits | Per-LP configurable limits | ✅ |

### Residual Risks

#### R1: OPERATOR Compromise
**Impact:** CRITICAL — Can sign releases for any trade
**Mitigation:**
- Use hardware wallet or MPC for OPERATOR key
- Monitor all release transactions
- Implement rate limiting on releases
- Have ARBITER ready to pause immediately

**Detection:**
- Alert if release rate > X per hour
- Alert if release amount > threshold
- Alert if new LP is added

#### R2: ARBITER Compromise
**Impact:** HIGH — Can pause/unpause contract
**Mitigation:**
- Use multi-sig wallet for ARBITER
- Time-lock on unpause (future enhancement)

#### R3: LP Griefing
**Impact:** LOW — LP cannot steal funds, only delay
**Mitigation:**
- 24h time-lock prevents instant withdrawal
- Trades expire and return funds to LP

#### R4: Front-Running
**Impact:** MEDIUM — MEV bots could sandwich trades
**Mitigation:**
- Quote expires in 120 seconds
- Trade amount is fixed at quote time
- Consider commit-reveal in future version

### Gas Optimization Report

| Function | Gas (est.) | Notes |
|----------|-----------|-------|
| `depositUSDT` | ~55,000 | Includes SafeERC20 transfer |
| `withdrawLP` | ~45,000 | Includes SafeERC20 transfer |
| `lockTrade` | ~180,000 | Includes LP lookup + trade creation |
| `release` | ~120,000 | Includes signature verification |
| `expireTrade` | ~40,000 | Simple state change |
| `getLockedBalance` | ~5,000 + 500/trade | O(1) with tracking mapping |

---

## Backend Security

### Authentication
- API key in `x-api-key` header for all endpoints
- HMAC signature verification for webhooks
- Rate limiting per IP (60 req/min general, 10 req/min for QR)

### Data Validation
- Zod schemas for all inputs
- SQL injection prevented by Prisma ORM
- No raw SQL queries

### Secrets Management
- Private keys in environment variables only
- Never logged or exposed in API responses
- Use secret manager in production (AWS Secrets Manager, Vault)

### Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 60/min | Per IP |
| Quote | 30/min | Per IP |
| QR Generate | 10/min | Per IP |
| Webhook | 100/min | Per IP |

---

## Frontend Security

### Input Validation
- Client-side validation before API calls
- Server-side validation (defense in depth)
- Amount limits: min 1 USDT, max 100,000 USDT

### Wallet Security
- RainbowKit handles wallet connection
- No private keys stored in frontend
- Verify chain ID matches Polygon

### Display Security
- Always show contract address for verification
- Display USDT amount clearly
- Show rate breakdown before confirmation

---

## Emergency Procedures

### Emergency Pause
1. ARBITER calls `pause()` on contract
2. All deposits, locks, releases, withdrawals stop
3. Existing trades remain locked (funds safe)
4. Investigate issue
5. ARBITER calls `unpause()` when resolved

**Commands:**
```bash
# Pause (via Etherscan or custom script)
cast send $ESCROW_ADDRESS "pause()" --private-key $ARBITER_KEY

# Unpause
cast send $ESCROW_ADDRESS "unpause()" --private-key $ARBITER_KEY
```

### Key Rotation (OPERATOR)
1. Generate new OPERATOR key pair
2. Deploy new EscrowMaster with new OPERATOR
3. Migrate LPs and pending trades
4. Pause old contract
5. Verify new contract works

### Fund Recovery
- USDT can only be withdrawn by LPs (after time-lock)
- Admin can rescue accidentally sent ETH via `rescueETH()`
- No admin backdoor to withdraw USDT (by design)

---

## Key Management

### OPERATOR Key
- **Purpose:** Signs EIP-712 release messages
- **Storage:** Hardware wallet or HSM in production
- **Rotation:** Quarterly or after any suspected compromise
- **Backup:** Encrypted backup in secure location

### ARBITER Key
- **Purpose:** Pause/unpause contract in emergencies
- **Storage:** Multi-sig wallet (Gnosis Safe recommended)
- **Access:** Multiple trusted parties

### Admin Key
- **Purpose:** Deploy contract, set treasury, rescue ETH
- **Storage:** Hardware wallet
- **Post-deploy:** Transfer DEFAULT_ADMIN to multi-sig

### Deployer Key
- **Purpose:** One-time deployment only
- **Post-deploy:** Can be rotated or destroyed

---

## Monitoring Checklist

### On-Chain
- [ ] Contract balance (USDT)
- [ ] Number of locked trades
- [ ] LP deposits/withdrawals
- [ ] Release transactions

### Backend
- [ ] API response times
- [ ] Error rates
- [ ] Webhook delivery success
- [ ] Quote generation rate

### Business
- [ ] Daily trading volume
- [ ] Active LPs
- [ ] Average trade size
- [ ] P2P rate spread

---

## Audit Log

| Date | Change | Auditor |
|------|--------|---------|
| 2025-01-15 | Initial security review | Onramp Team |
| 2025-01-15 | Added LP_ADMIN_ROLE to depositUSDT | Onramp Team |
| 2025-01-15 | Restricted expireTrade to OPERATOR | Onramp Team |
| 2025-01-15 | Added idempotency to webhook | Onramp Team |
