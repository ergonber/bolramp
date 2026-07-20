#!/bin/bash
# =============================================================================
# ONRAMP Setup Script — Polygon Amoy Testnet
# =============================================================================
set -e

PROJECT_DIR="/run/media/ernesto/Unidad D/Studio/Onramp"

echo "========================================="
echo "  ONRAMP BOB→USDT — Setup Testnet"
echo "========================================="

# 1. Backend dependencies
echo ""
echo "[1/4] Installing backend dependencies..."
cd "$PROJECT_DIR/backend"
npm install

# 2. Frontend dependencies
echo ""
echo "[2/4] Installing frontend dependencies..."
cd "$PROJECT_DIR/frontend"
npm install

# 3. Prisma migrate
echo ""
echo "[3/4] Running Prisma migrations..."
cd "$PROJECT_DIR/backend"
npx prisma generate
npx prisma migrate dev --name init

# 4. Done
echo ""
echo "[4/4] Setup complete!"
echo ""
echo "========================================="
echo "  NEXT STEPS — You need to provide:"
echo "========================================="
echo ""
echo "  1. OPERATOR_PRIVATE_KEY  — Your wallet private key"
echo "  2. OPENBCB_API_KEY       — From https://openbcb.io"
echo "  3. OPENBCB_WEBHOOK_SECRET — From OpenBCB dashboard"
echo "  4. WalletConnect Project ID — From https://cloud.walletconnect.com"
echo ""
echo "  Edit: backend/.env"
echo "  Edit: frontend/.env.local"
echo ""
echo "========================================="
echo "  TO START"
echo "========================================="
echo ""
echo "  Terminal 1 (DB):    docker-compose up -d postgres redis"
echo "  Terminal 2 (API):   cd backend && npm run dev"
echo "  Terminal 3 (Web):   cd frontend && npm run dev"
echo ""
echo "  Open: http://localhost:3000"
echo ""
