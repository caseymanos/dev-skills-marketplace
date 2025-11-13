#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛑 Stopping development environment...${NC}\n"

# Stop and remove containers, networks, and volumes
docker-compose down -v

echo -e "\n${GREEN}✅ Environment stopped and cleaned up${NC}"
echo -e "${BLUE}ℹ️  All containers, networks, and volumes have been removed${NC}\n"
