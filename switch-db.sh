#!/bin/bash
# Switch between SQLite (local dev) and PostgreSQL (Docker/production)
# Usage: ./switch-db.sh [sqlite|postgres]

MODE=${1:-sqlite}
BACKEND_DIR="/run/media/ernesto/Unidad D/Studio/Onramp/backend"

cd "$BACKEND_DIR"

if [ "$MODE" = "sqlite" ]; then
    echo "Switching to SQLite..."
    cp prisma/schema.sqlite.prisma prisma/schema.prisma
    sed -i 's|DATABASE_URL=postgresql://.*|DATABASE_URL=file:./dev.db|' .env
    npx prisma generate
    npx prisma migrate dev --name init
    echo "Done! SQLite database ready at backend/dev.db"

elif [ "$MODE" = "postgres" ]; then
    echo "Switching to PostgreSQL..."
    cat > prisma/schema.prisma << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
EOF
    # Keep the rest of schema from the original
    echo "Now restore your PostgreSQL schema and run:"
    echo "  npx prisma migrate dev"
else
    echo "Usage: $0 [sqlite|postgres]"
fi
