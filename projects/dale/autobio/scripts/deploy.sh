#!/bin/bash

# Autobiography Builder - Production Deployment Script
# Run this after setup.sh has been executed

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "🚀 Autobiography Builder - Production Deployment"
echo "================================================="
echo ""

# Check for placeholders in config
echo "🔍 Checking configuration..."
PLACEHOLDER_FOUND=false
for toml in apps/api/wrangler.toml workers/parse/wrangler.toml workers/analyze/wrangler.toml workers/write/wrangler.toml workers/build/wrangler.toml; do
    if [ -f "$toml" ] && grep -q "placeholder-will-be-replaced-after-creation" "$toml"; then
        echo "❌ $toml still has placeholders!"
        PLACEHOLDER_FOUND=true
    fi
done

if [ "$PLACEHOLDER_FOUND" = true ]; then
    echo ""
    echo "Please run ./scripts/setup.sh first to configure infrastructure."
    exit 1
fi
echo "✅ All configuration files ready"
echo ""

# Check Cloudflare login
echo "🔐 Checking Cloudflare login..."
if ! wrangler whoami &> /dev/null; then
    echo "Please log in to Cloudflare:"
    wrangler login
fi
echo "✅ Logged in to Cloudflare"
echo ""

# Apply remote database migrations
echo "📊 Applying database migrations..."
cd apps/api
wrangler d1 migrations apply autobiography-db --remote
cd "$PROJECT_ROOT"
echo "✅ Migrations applied"
echo ""

# Check and set secrets
echo "🔑 Checking secrets..."
echo ""
echo "You'll need to set these secrets if not already done:"
echo "  - JWT_SECRET for autobiography-api"
echo "  - CLAUDE_API_KEY for autobiography-api, autobiography-analyze-worker, autobiography-write-worker"
echo ""

read -p "Do you want to set secrets now? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Setting JWT_SECRET for API..."
    wrangler secret put JWT_SECRET --name autobiography-api
    
    echo ""
    echo "Setting CLAUDE_API_KEY for API..."
    wrangler secret put CLAUDE_API_KEY --name autobiography-api
    
    echo ""
    echo "Setting CLAUDE_API_KEY for analyze worker..."
    wrangler secret put CLAUDE_API_KEY --name autobiography-analyze-worker
    
    echo ""
    echo "Setting CLAUDE_API_KEY for write worker..."
    wrangler secret put CLAUDE_API_KEY --name autobiography-write-worker
    
    echo ""
    echo "✅ Secrets configured"
fi
echo ""

# Deploy workers in order (API first since it exports Durable Object)
echo "🚀 Deploying workers..."
echo ""

echo "1/5 Deploying API worker (includes Durable Object)..."
cd apps/api
pnpm run deploy 2>/dev/null || wrangler deploy
cd "$PROJECT_ROOT"
echo "✅ API worker deployed"
echo ""

echo "2/5 Deploying parse worker..."
cd workers/parse
pnpm run deploy 2>/dev/null || wrangler deploy
cd "$PROJECT_ROOT"
echo "✅ Parse worker deployed"
echo ""

echo "3/5 Deploying analyze worker..."
cd workers/analyze
pnpm run deploy 2>/dev/null || wrangler deploy
cd "$PROJECT_ROOT"
echo "✅ Analyze worker deployed"
echo ""

echo "4/5 Deploying write worker..."
cd workers/write
pnpm run deploy 2>/dev/null || wrangler deploy
cd "$PROJECT_ROOT"
echo "✅ Write worker deployed"
echo ""

echo "5/5 Deploying build worker..."
cd workers/build
pnpm run deploy 2>/dev/null || wrangler deploy
cd "$PROJECT_ROOT"
echo "✅ Build worker deployed"
echo ""

# Deploy frontend
echo "🌐 Deploying frontend..."
cd apps/web
pnpm run build
# Note: Frontend deployment depends on your setup (Cloudflare Pages, Vercel, etc.)
# Uncomment the appropriate line:
# wrangler pages deploy .next --project-name autobiography-web
# npx vercel --prod
echo "⚠️  Frontend build complete. Deploy manually or configure CI/CD."
cd "$PROJECT_ROOT"
echo ""

echo "================================================="
echo "✅ Deployment complete!"
echo ""
echo "Your API is available at:"
echo "  https://autobiography-api.<your-subdomain>.workers.dev"
echo ""
echo "To deploy the frontend to Cloudflare Pages:"
echo "  cd apps/web"
echo "  wrangler pages deploy .next --project-name autobiography-web"
echo ""
