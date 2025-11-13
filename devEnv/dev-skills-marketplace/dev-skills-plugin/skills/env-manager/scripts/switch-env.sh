#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo -e "${RED}❌ Usage: ./scripts/switch-env.sh [dev|test|staging|prod]${NC}"
  exit 1
fi

# Map short names to full names
case $ENVIRONMENT in
  dev|development)
    ENV_FILE=".env.development"
    ;;
  test|testing)
    ENV_FILE=".env.test"
    ;;
  stage|staging)
    ENV_FILE=".env.staging"
    ;;
  prod|production)
    ENV_FILE=".env.production"
    ;;
  *)
    echo -e "${RED}❌ Unknown environment: $ENVIRONMENT${NC}"
    echo "Valid options: dev, test, staging, prod"
    exit 1
    ;;
esac

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ Environment file not found: $ENV_FILE${NC}"
  exit 1
fi

# Backup current .env if it exists
if [ -f ".env" ]; then
  cp .env .env.backup
  echo -e "${YELLOW}📦 Backed up current .env to .env.backup${NC}"
fi

# Copy environment file
cp "$ENV_FILE" .env
echo -e "${GREEN}✅ Switched to $ENVIRONMENT environment${NC}"

# Show key configuration
echo -e "\n${BLUE}📋 Active configuration:${NC}"
grep -E "^[A-Z_]+=.*" .env | head -10

echo -e "\n${YELLOW}💡 Restart your services for changes to take effect:${NC}"
echo -e "   ${BLUE}make dev-reset${NC}"
