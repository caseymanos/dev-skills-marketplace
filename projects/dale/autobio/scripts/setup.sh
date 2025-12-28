#!/bin/bash

# Autobiography Builder - Setup Script
# This script sets up the Cloudflare infrastructure

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Navigate to project root (one level up from scripts/)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "Working directory: $PROJECT_ROOT"

echo "🚀 Autobiography Builder - Setup Script"
echo "========================================"
echo ""

# Detect OS for sed compatibility
if [[ "$OSTYPE" == "darwin"* ]]; then
    SED_INPLACE="sed -i ''"
else
    SED_INPLACE="sed -i"
fi

# Helper function for sed replacement
replace_in_file() {
    local search="$1"
    local replace="$2"
    local file="$3"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|$search|$replace|g" "$file"
    else
        sed -i "s|$search|$replace|g" "$file"
    fi
}

# Check for required tools
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is required but not installed."
        exit 1
    fi
}

echo "Checking prerequisites..."
check_command node
check_command pnpm
check_command wrangler

echo "✅ All prerequisites installed"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Login to Cloudflare (if not already)
echo ""
echo "🔐 Checking Cloudflare login..."
if ! wrangler whoami &> /dev/null; then
    echo "Please log in to Cloudflare:"
    wrangler login
fi
echo "✅ Logged in to Cloudflare"
echo ""

# Create D1 Database
echo "📊 Creating D1 database..."
DB_ID=""
DB_OUTPUT=$(wrangler d1 create autobiography-db 2>&1 || true)
if echo "$DB_OUTPUT" | grep -q "already exists"; then
    echo "Database already exists, fetching ID..."
    DB_ID=$(wrangler d1 list --json 2>/dev/null | grep -A2 '"name": "autobiography-db"' | grep '"uuid"' | awk -F'"' '{print $4}' || true)
    if [ -z "$DB_ID" ]; then
        # Try alternative parsing
        DB_ID=$(wrangler d1 list 2>/dev/null | grep "autobiography-db" | awk '{print $1}' || true)
    fi
else
    echo "$DB_OUTPUT"
    # Extract database ID from creation output
    DB_ID=$(echo "$DB_OUTPUT" | grep -E "database_id.*=|uuid" | head -1 | awk -F'[="]' '{for(i=1;i<=NF;i++) if(length($i)==36) print $i}' | head -1)
fi

if [ -n "$DB_ID" ]; then
    echo "✅ Database ID: $DB_ID"
    # Update ALL wrangler.toml files with database ID
    for toml in apps/api/wrangler.toml workers/parse/wrangler.toml workers/analyze/wrangler.toml workers/write/wrangler.toml workers/build/wrangler.toml; do
        if [ -f "$toml" ]; then
            # Only replace the D1 database_id placeholder
            if grep -q 'database_id = "placeholder-will-be-replaced-after-creation"' "$toml"; then
                replace_in_file 'database_id = "placeholder-will-be-replaced-after-creation"' "database_id = \"$DB_ID\"" "$toml"
                echo "   Updated $toml with D1 database ID"
            fi
        fi
    done
else
    echo "⚠️  Could not extract database ID. You may need to update wrangler.toml manually."
fi
echo ""

# Create R2 Bucket
echo "🗄️ Creating R2 bucket..."
R2_OUTPUT=$(wrangler r2 bucket create autobiography-files 2>&1 || true)
if echo "$R2_OUTPUT" | grep -q "already exists"; then
    echo "✅ R2 bucket already exists"
else
    echo "✅ Created R2 bucket: autobiography-files"
fi
echo ""

# Create KV Namespace
echo "💾 Creating KV namespace..."
KV_ID=""
KV_OUTPUT=$(wrangler kv namespace create CACHE 2>&1 || true)
if echo "$KV_OUTPUT" | grep -q "already exists"; then
    echo "KV namespace already exists, fetching ID..."
    # Try to get existing KV namespace ID
    KV_ID=$(wrangler kv namespace list --json 2>/dev/null | grep -B2 '"title": "autobiography-api-CACHE"' | grep '"id"' | awk -F'"' '{print $4}' || true)
else
    echo "$KV_OUTPUT"
    # Extract KV ID from creation output
    KV_ID=$(echo "$KV_OUTPUT" | grep -oE '[a-f0-9]{32}' | head -1)
fi

if [ -n "$KV_ID" ]; then
    echo "✅ KV Namespace ID: $KV_ID"
    # Update api wrangler.toml with KV ID (only api uses KV)
    if [ -f "apps/api/wrangler.toml" ]; then
        # The KV placeholder is the second occurrence, need to be careful
        # First check if there's still a placeholder for KV
        if grep -q 'id = "placeholder-will-be-replaced-after-creation"' "apps/api/wrangler.toml"; then
            replace_in_file 'id = "placeholder-will-be-replaced-after-creation"' "id = \"$KV_ID\"" "apps/api/wrangler.toml"
            echo "   Updated apps/api/wrangler.toml with KV namespace ID"
        fi
    fi
else
    echo "⚠️  Could not extract KV namespace ID. You may need to update wrangler.toml manually."
fi
echo ""

# Create Queues
echo "📬 Creating queues..."
for queue in autobiography-parse autobiography-analyze autobiography-write autobiography-build autobiography-dlq; do
    QUEUE_OUTPUT=$(wrangler queues create $queue 2>&1 || true)
    if echo "$QUEUE_OUTPUT" | grep -q "already exists"; then
        echo "   ✅ Queue $queue already exists"
    else
        echo "   ✅ Created queue: $queue"
    fi
done
echo ""

# Verify wrangler.toml files no longer have placeholders
echo "🔍 Verifying configuration..."
PLACEHOLDER_COUNT=0
for toml in apps/api/wrangler.toml workers/parse/wrangler.toml workers/analyze/wrangler.toml workers/write/wrangler.toml workers/build/wrangler.toml; do
    if [ -f "$toml" ] && grep -q "placeholder-will-be-replaced-after-creation" "$toml"; then
        echo "   ⚠️  $toml still has placeholders"
        PLACEHOLDER_COUNT=$((PLACEHOLDER_COUNT + 1))
    else
        echo "   ✅ $toml configured"
    fi
done
echo ""

if [ $PLACEHOLDER_COUNT -gt 0 ]; then
    echo "⚠️  Some files still have placeholders. Please update them manually."
    echo "   Run: wrangler d1 list    # to get database ID"
    echo "   Run: wrangler kv:namespace list   # to get KV namespace ID"
    echo ""
fi

# Generate environment file if it doesn't exist
if [ ! -f "apps/api/.dev.vars" ]; then
    echo "📝 Creating .dev.vars file..."
    JWT_SECRET=$(openssl rand -base64 32)
    cat > apps/api/.dev.vars << EOF
JWT_SECRET=$JWT_SECRET
CLAUDE_API_KEY=your-claude-api-key-here
EOF
    echo "✅ Created apps/api/.dev.vars with generated JWT_SECRET"
    echo "⚠️  Please add your CLAUDE_API_KEY to apps/api/.dev.vars"
else
    echo "📝 .dev.vars already exists, skipping..."
fi
echo ""

echo "========================================"
echo "✅ Infrastructure setup complete!"
echo ""
echo "Next steps for LOCAL development:"
echo "  1. Add your CLAUDE_API_KEY to apps/api/.dev.vars"
echo "  2. Run database migrations locally:"
echo "     cd apps/api && wrangler d1 migrations apply autobiography-db --local"
echo "  3. Start dev servers: pnpm dev"
echo ""
echo "For PRODUCTION deployment:"
echo "  1. Apply remote migrations:"
echo "     cd apps/api && wrangler d1 migrations apply autobiography-db --remote"
echo "  2. Set secrets:"
echo "     wrangler secret put JWT_SECRET --name autobiography-api"
echo "     wrangler secret put CLAUDE_API_KEY --name autobiography-api"
echo "     wrangler secret put CLAUDE_API_KEY --name autobiography-analyze-worker"
echo "     wrangler secret put CLAUDE_API_KEY --name autobiography-write-worker"
echo "  3. Deploy all workers:"
echo "     pnpm deploy"
echo ""
