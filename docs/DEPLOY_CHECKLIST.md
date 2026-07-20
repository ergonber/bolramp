# Deploy Checklist — Polygon Mainnet

## Pre-Deploy

### Smart Contract
- [ ] All 70 tests pass: `forge test -vv`
- [ ] Contract compiles without errors: `forge build`
- [ ] Slither analysis passes (no high/medium issues)
- [ ] Gas optimization reviewed
- [ ] Code reviewed by 2+ developers
- [ ] External audit completed (if available)

### Infrastructure
- [ ] PostgreSQL database provisioned
- [ ] Redis instance provisioned
- [ ] Backend server provisioned
- [ ] Frontend deployed (Vercel/Railway)
- [ ] SSL certificates configured
- [ ] DNS configured

### Keys & Secrets
- [ ] OPERATOR key generated (hardware wallet)
- [ ] ARBITER key generated (multi-sig)
- [ ] Treasury address set (multi-sig)
- [ ] All keys backed up securely
- [ ] No keys in version control

### Configuration
- [ ] .env.production created
- [ ] DATABASE_URL set
- [ ] POLYGON_RPC_URL set (paid provider)
- [ ] OPENBCB_API_KEY set
- [ ] API_KEY set (strong random string)
- [ ] CORS_ORIGINS set to production domain

## Deploy

### 1. Deploy Contract
```bash
# Set environment variables
export DEPLOYER_PRIVATE_KEY=<deployer_key>
export USDT_ADDRESS=0xc2132D05D31c914a87C6611C10748AEb04B58e8F
export TREASURY_ADDRESS=<treasury_multi-sig>
export OPERATOR_ADDRESS=<operator_address>
export ARBITER_ADDRESS=<arbiter_multi-sig>

# Deploy
cd onramp-contracts
forge script script/DeployEscrow.s.sol \
  --rpc-url polygon \
  --broadcast \
  --verify
```

### 2. Verify on Polygonscan
```bash
# If verification failed during deploy
forge verify-contract <CONTRACT_ADDRESS> EscrowMaster \
  --chain-id 137 \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address)" $USDT_ADDRESS $TREASURY_ADDRESS $OPERATOR_ADDRESS $ARBITER_ADDRESS)
```

### 3. Configure Contract
```bash
# Transfer DEFAULT_ADMIN to multi-sig (IMPORTANT!)
cast send <CONTRACT_ADDRESS> \
  "renounceRole(bytes32,address)" \
  $(cast keccak "DEFAULT_ADMIN") \
  <MULTI_SIG_ADDRESS> \
  --private-key $OPERATOR_PRIVATE_KEY

# Verify admin renounced
cast call <CONTRACT_ADDRESS> "hasRole(bytes32,address)" \
  $(cast keccak "DEFAULT_ADMIN") \
  <OPERATOR_ADDRESS>
# Should return: false
```

### 4. Deploy Backend
```bash
# Run migrations
cd backend
npx prisma migrate deploy

# Start server
node dist/index.js
```

### 5. Deploy Frontend
```bash
cd frontend
npm run build
# Deploy to Vercel/Railway
```

## Post-Deploy

### Verification
- [ ] Contract visible on Polygonscan
- [ ] Contract verified on Polygonscan
- [ ] Health check endpoint returns 200
- [ ] Quote endpoint returns valid data
- [ ] QR generation works
- [ ] Test trade completes end-to-end
- [ ] Webhook receives confirmation
- [ ] USDT arrives in test wallet

### Monitoring
- [ ] Sentry configured for backend errors
- [ ] Contract events monitored
- [ ] Alert for balance < threshold
- [ ] Alert for failed webhooks
- [ ] Dashboard for trade volume

### Documentation
- [ ] API documentation updated
- [ ] Contract address documented
- [ ] Emergency contacts documented
- [ ] Runbook created

## Rollback Plan

If critical issue found post-deploy:

1. **Immediate:** ARBITER pauses contract
2. **Assess:** Check if funds are at risk
3. **Communicate:** Notify affected users
4. **Fix:** Patch and re-deploy
5. **Resume:** Unpause when safe
