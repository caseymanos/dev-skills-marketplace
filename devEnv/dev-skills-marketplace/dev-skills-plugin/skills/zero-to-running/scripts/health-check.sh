#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo -e "${BLUE}🔍 Checking service health...${NC}\n"

exit_code=0

# Check PostgreSQL
if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h localhost -p ${POSTGRES_PORT:-5432} -U ${DB_USER:-dev_user} > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
    else
        echo -e "${RED}❌ PostgreSQL is not responding${NC}"
        exit_code=1
    fi
else
    if docker-compose exec -T postgres pg_isready -U ${DB_USER:-dev_user} > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
    else
        echo -e "${RED}❌ PostgreSQL is not responding${NC}"
        exit_code=1
    fi
fi

# Check Redis
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -h localhost -p ${REDIS_PORT:-6379} ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis is ready${NC}"
    else
        echo -e "${RED}❌ Redis is not responding${NC}"
        exit_code=1
    fi
else
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis is ready${NC}"
    else
        echo -e "${RED}❌ Redis is not responding${NC}"
        exit_code=1
    fi
fi

# Check API
if curl -f -s http://localhost:${API_PORT:-8000}/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API is ready${NC}"
else
    echo -e "${RED}❌ API is not responding${NC}"
    exit_code=1
fi

# Check Frontend
if curl -f -s http://localhost:${FRONTEND_PORT:-3000} > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is ready${NC}"
else
    echo -e "${RED}❌ Frontend is not responding${NC}"
    exit_code=1
fi

if [ $exit_code -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All services are healthy!${NC}\n"
else
    echo -e "\n${RED}⚠️  Some services are not healthy${NC}"
    echo -e "${BLUE}ℹ️  Run 'docker-compose logs' to see error details${NC}\n"
fi

exit $exit_code
