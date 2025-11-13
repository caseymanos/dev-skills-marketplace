#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please copy .env.example to .env and configure it"
    exit 1
fi

echo -e "${BLUE}🚀 Starting Zero-to-Running Developer Environment${NC}\n"

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

command -v docker >/dev/null 2>&1 || { echo -e "${RED}❌ Docker is required but not installed${NC}"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}❌ Docker Compose is required but not installed${NC}"; exit 1; }

echo -e "${GREEN}✅ Prerequisites check passed${NC}\n"

# Check for port conflicts
echo -e "${BLUE}🔍 Checking for port conflicts...${NC}"

check_port() {
    port=$1
    name=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}⚠️  Port $port ($name) is already in use${NC}"
        echo "   To resolve: kill $(lsof -ti:$port) or change $name in .env"
        exit 1
    fi
}

check_port ${FRONTEND_PORT:-3000} "FRONTEND_PORT"
check_port ${API_PORT:-8000} "API_PORT"
check_port ${POSTGRES_PORT:-5432} "POSTGRES_PORT"
check_port ${REDIS_PORT:-6379} "REDIS_PORT"

echo -e "${GREEN}✅ No port conflicts detected${NC}\n"

# Start services
echo -e "${BLUE}🐳 Starting Docker services...${NC}"
docker-compose up -d

# Wait for services to be healthy
echo -e "\n${BLUE}⏳ Waiting for services to be healthy...${NC}"

max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker-compose ps | grep -q "unhealthy"; then
        echo -e "${YELLOW}⏳ Services still starting... (attempt $((attempt+1))/$max_attempts)${NC}"
        sleep 2
        attempt=$((attempt+1))
    else
        break
    fi
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}❌ Services failed to become healthy${NC}"
    echo "Run 'docker-compose logs' to see errors"
    exit 1
fi

# Run health checks
echo -e "\n${BLUE}🏥 Running health checks...${NC}"
./scripts/health-check.sh

# Display access information
echo -e "\n${GREEN}✅ Development environment is ready!${NC}\n"
echo -e "${BLUE}📍 Access your services:${NC}"
echo -e "   Frontend:  http://localhost:${FRONTEND_PORT:-3000}"
echo -e "   API:       http://localhost:${API_PORT:-8000}"
echo -e "   API Docs:  http://localhost:${API_PORT:-8000}/docs"
echo -e "   PostgreSQL: localhost:${POSTGRES_PORT:-5432}"
echo -e "   Redis:     localhost:${REDIS_PORT:-6379}"
echo -e "\n${BLUE}📝 Useful commands:${NC}"
echo -e "   View logs:        docker-compose logs -f"
echo -e "   Stop services:    make dev-down"
echo -e "   Reset environment: make dev-reset"
echo -e "   Run tests:        make test\n"
