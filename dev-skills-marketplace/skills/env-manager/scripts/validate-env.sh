#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENV_FILE="${1:-.env}"

echo -e "${BLUE}🔍 Validating environment: $ENV_FILE${NC}\n"

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ Environment file not found: $ENV_FILE${NC}"
  exit 1
fi

ERRORS=0
WARNINGS=0

# Required variables
REQUIRED_VARS=(
  "NODE_ENV"
  "FRONTEND_PORT"
  "API_PORT"
  "DB_NAME"
  "DB_USER"
  "DB_PASSWORD"
)

echo -e "${BLUE}Checking required variables...${NC}"
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^${var}=" "$ENV_FILE"; then
    echo -e "${RED}❌ Missing: $var${NC}"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}✅ Found: $var${NC}"
  fi
done

# Check for insecure values in production
if grep -q "^NODE_ENV=production" "$ENV_FILE"; then
  echo -e "\n${YELLOW}⚠️  Production environment detected, checking for insecure values...${NC}"
  
  INSECURE_PATTERNS=("dev_password" "dev_secret" "change_in_production" "example")
  
  for pattern in "${INSECURE_PATTERNS[@]}"; do
    if grep -qi "$pattern" "$ENV_FILE"; then
      echo -e "${YELLOW}⚠️  Warning: Found '$pattern' in production config${NC}"
      WARNINGS=$((WARNINGS + 1))
    fi
  done
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Validation passed!${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
  fi
  exit 0
else
  echo -e "${RED}❌ Validation failed with $ERRORS error(s)${NC}"
  exit 1
fi
