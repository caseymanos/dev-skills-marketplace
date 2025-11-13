# Developer Setup Guide

Welcome to the Zero-to-Running Developer Environment! This guide will help you get your local development environment up and running in minutes.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Daily Workflow](#daily-workflow)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)

## Prerequisites

Before you begin, ensure you have the following installed:

### Required
- **Docker Desktop 24+** (macOS/Windows) or **Docker Engine + Docker Compose** (Linux)
  - [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Git** - Version control
  - [Download Git](https://git-scm.com/downloads)
- **Make** - Build automation (usually pre-installed on macOS/Linux)
  - Windows users: Install via [Chocolatey](https://chocolatey.org/) or use Git Bash

### Optional (for local development without Docker)
- **Node.js 20+** with npm
- **PostgreSQL 15+**
- **Redis 7+**

### Verification

Check your installations:
```bash
docker --version          # Should be 24.0+
docker-compose --version  # Should be 2.0+
git --version
make --version
```

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-name>
```

### 2. Configure Environment

Copy the example environment file and customize if needed:

```bash
cp .env.example .env
```

**Note:** The default configuration works out of the box. Only modify if you have port conflicts.

### 3. Start the Environment

```bash
make dev
```

This single command will:
- ✅ Check prerequisites
- ✅ Validate ports are available
- ✅ Start all services (PostgreSQL, Redis, API, Frontend)
- ✅ Run health checks
- ✅ Display access URLs

**First-time setup typically takes 2-5 minutes** while Docker downloads images and builds containers.

### 4. Access Your Application

Once the environment is ready, access your services:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | React application |
| API | http://localhost:8000 | Backend API |
| API Docs | http://localhost:8000/docs | OpenAPI documentation |
| PostgreSQL | localhost:5432 | Database (use with DB client) |
| Redis | localhost:6379 | Cache (use with Redis client) |

## Configuration

### Environment Variables

All configuration is managed through the `.env` file:

```bash
# Change ports if needed
FRONTEND_PORT=3000
API_PORT=8000
POSTGRES_PORT=5432
REDIS_PORT=6379

# Database credentials (development only)
DB_NAME=dev_db
DB_USER=dev_user
DB_PASSWORD=dev_password_change_in_production

# Feature flags
ENABLE_HOT_RELOAD=true
ENABLE_DEBUG_MODE=true
LOG_LEVEL=debug
```

### Service Configuration

Individual services can be configured through:
- **API**: `backend/.env` (service-specific settings)
- **Frontend**: `frontend/.env.local` (build-time variables)

## Daily Workflow

### Starting Your Day

```bash
# Start the environment
make dev

# Check service health
make health
```

### Development Commands

```bash
# View logs from all services
make logs

# View logs from specific service
make logs-api
make logs-frontend
make logs-db

# Run tests
make test

# Run linters
make lint

# Format code
make format
```

### Database Operations

```bash
# Run migrations
make db-migrate

# Seed test data
make db-seed

# Reset database (drop, migrate, seed)
make db-reset

# Access database shell
make shell-db
```

### Debugging

```bash
# Access container shell
make shell-api       # Backend API
make shell-frontend  # Frontend

# View container stats
make stats

# Check running containers
make ps
```

### Ending Your Day

```bash
# Stop the environment (preserves data)
make dev-down

# OR reset everything (cleans volumes)
make dev-reset
```

## Troubleshooting

### Common Issues

#### Port Already in Use

**Symptom:** Error message about port conflicts

**Solution:**
```bash
# Find what's using the port (example: port 3000)
lsof -i :3000

# Kill the process
kill <PID>

# OR change the port in .env
FRONTEND_PORT=3001
```

#### Docker Daemon Not Running

**Symptom:** "Cannot connect to Docker daemon"

**Solution:**
- **macOS/Windows:** Open Docker Desktop
- **Linux:** `sudo systemctl start docker`

#### Services Won't Start

**Symptom:** Containers exit immediately

**Solution:**
```bash
# Check logs for errors
docker-compose logs api

# Rebuild containers
docker-compose build --no-cache
make dev
```

#### Database Connection Issues

**Symptom:** API can't connect to database

**Solution:**
```bash
# Reset database
make dev-down
make dev

# If persistent, clean everything
make clean
make dev
```

#### Out of Date Dependencies

**Symptom:** "Module not found" errors

**Solution:**
```bash
# Reinstall dependencies
make install

# If persistent, rebuild containers
docker-compose build --no-cache api frontend
```

#### Hot Reload Not Working

**Symptom:** Code changes not reflected

**Solution:**
1. Verify volume mounts in `docker-compose.yml`
2. Check `ENABLE_HOT_RELOAD=true` in `.env`
3. For macOS: Ensure "Use new Virtualization framework" is enabled in Docker Desktop settings

### Getting Help

1. **Check logs:** `make logs`
2. **Review health:** `make health`
3. **Search issues:** Check the repository's issue tracker
4. **Ask the team:** Post in the development Slack channel

## Advanced Usage

### Multiple Environment Profiles

Create profile-specific environment files:

```bash
# Development (default)
.env

# Testing
.env.test

# Load specific profile
cp .env.test .env
make dev
```

### Custom Docker Compose

Override services locally without modifying version-controlled files:

```bash
# Create docker-compose.override.yml
version: '3.8'
services:
  api:
    environment:
      - CUSTOM_VAR=value
```

### Database Snapshots

```bash
# Create snapshot
docker-compose exec postgres pg_dump -U dev_user dev_db > snapshot.sql

# Restore snapshot
docker-compose exec -T postgres psql -U dev_user dev_db < snapshot.sql
```

### Performance Tuning

For faster startup times:

1. **Prune unused Docker resources:**
   ```bash
   docker system prune -a
   ```

2. **Use Docker layer caching:**
   - Ensure `Dockerfile.dev` copies dependencies before source code

3. **Allocate more resources to Docker Desktop:**
   - Settings → Resources → Increase CPU/Memory

### SSL/HTTPS (Optional)

To enable HTTPS for local development:

1. Generate self-signed certificates:
   ```bash
   ./scripts/generate-certs.sh
   ```

2. Update `docker-compose.yml` to mount certificates

3. Configure nginx to use SSL

## Best Practices

1. **Always use `make dev`** - Don't run `docker-compose up` directly
2. **Keep `.env` up to date** - Pull latest `.env.example` after git pull
3. **Run health checks** - Verify services before starting work
4. **Clean regularly** - Run `make clean` weekly to free disk space
5. **Update dependencies** - Run `make install` after pulling changes

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│     API     │
│   (React)   │     │   (Node)    │
└─────────────┘     └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────▼─────┐ ┌────▼────┐
              │ PostgreSQL│ │  Redis  │
              └───────────┘ └─────────┘
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Project Architecture](./docs/ARCHITECTURE.md)
- [API Documentation](http://localhost:8000/docs)

---

**Questions?** Contact the development team or open an issue in the repository.
