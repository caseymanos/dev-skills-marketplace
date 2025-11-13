# React + Node.js + PostgreSQL + Redis Development Environment

A complete, production-ready development environment with hot reload, health monitoring, database seeding, and automated code quality checks.

## 🚀 Quick Start

```bash
# Clone and set up
git clone <your-repo-url>
cd react-node-postgres-redis

# Copy environment configuration
cp .env.example .env

# Start all services (one command!)
make dev
```

**Access your applications:**
- Frontend: http://localhost:3000
- API: http://localhost:5001
- API Health: http://localhost:5001/health

## 📋 Features

### 🏗️ **Core Infrastructure**
- **React Frontend** (Vite, TypeScript, Tailwind CSS)
- **Node.js API** (Express, TypeScript, ES6 Modules)
- **PostgreSQL Database** (with health checks)
- **Redis Cache** (with persistence)
- **Docker Compose** orchestration

### 🔧 **Development Tools**
- **Hot Reload** - Both frontend and backend auto-restart
- **Health Monitoring** - Comprehensive health checks for all services
- **Database Seeding** - Realistic test data generation
- **Code Quality** - Automated linting and formatting
- **Git Hooks** - Pre-commit and pre-push automation

### 📊 **Database Features**
- **Realistic Test Data** - Users, posts, relationships with Faker.js
- **Configurable Volumes** - Demo, large, or custom datasets
- **Database Statistics** - Analytics and performance insights
- **Migration Ready** - Database initialization scripts

### 🛡️ **Code Quality**
- **ESLint + Prettier** - Consistent code formatting
- **Husky + lint-staged** - Automated Git hooks
- **Pre-commit** - Linting and formatting
- **Pre-push** - Type checking and testing
- **Commit Standards** - Conventional commit enforcement

## 🎯 Services

| Service | Port | Description | Health Check |
|---------|------|-------------|--------------|
| Frontend | 3000 | React + Vite + TypeScript | `http://localhost:3000` |
| API | 5001 | Node.js + Express + TypeScript | `http://localhost:5001/health` |
| PostgreSQL | 5432 | Primary Database | `pg_isready` |
| Redis | 6379 | Cache & Session Store | `redis-cli ping` |

## 🛠️ Available Commands

```bash
# Core Development
make dev          # Start all services
make down         # Stop all services
make health       # Check service health
make logs         # View all logs
make clean        # Complete cleanup

# Development Tools
make shell-db     # Open PostgreSQL shell
make shell-redis  # Open Redis CLI
make shell-api    # Access API container
make shell-frontend # Access frontend container

# Database
make db-seed      # Generate test data
make db-seed-demo # Quick demo data
make db-seed-large # Large dataset for testing
make db-stats     # View database statistics

# Logs & Debugging
make logs-api     # API logs only
make logs-frontend # Frontend logs only
make logs-db      # Database logs only
make logs-redis   # Redis logs only

# Build & Test
make build        # Build production images
make test         # Run all tests
make lint         # Run linting
make format       # Format code
```

## 📁 Project Structure

```
react-node-postgres-redis/
├── frontend/                 # React + Vite application
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── Dockerfile.dev
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── index.js         # API entry point
│   │   ├── seeds/           # Database seeding
│   │   └── config/          # Configuration files
│   ├── package.json
│   └── Dockerfile.dev
├── scripts/                  # Automation scripts
│   ├── dev-up.sh           # Startup script
│   ├── dev-down.sh         # Teardown script
│   └── health-check.sh     # Health monitoring
├── docker-compose.yml        # Service orchestration
├── Makefile                  # Command aliases
├── .env.example             # Environment template
└── README.md               # This file
```

## 🔧 Environment Configuration

Copy `.env.example` to `.env` and customize:

```bash
# Service Ports
FRONTEND_PORT=3000
API_PORT=5001
POSTGRES_PORT=5432
REDIS_PORT=6379

# Database Configuration
DB_NAME=dev_db
DB_USER=dev_user
DB_PASSWORD=your_secure_password

# Application Settings
NODE_ENV=development
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000

# Feature Flags
ENABLE_HOT_RELOAD=true
ENABLE_DEBUG_MODE=true
ENABLE_SOURCE_MAPS=true
```

## 📊 Database Seeding

Generate realistic test data for development and testing:

```bash
# Quick demo data (20 users, sample posts)
cd backend
npm run seed:demo

# Large dataset (1000+ users for stress testing)
npm run seed:large

# Custom parameters
npm run seed:custom 500 3 15  # 500 users, 3-15 posts per user

# View statistics
npm run seed:stats
```

**Seed Data Features:**
- **5 User Types**: Admin, Moderator, Premium, Regular, Inactive
- **16 Post Categories**: Technology, Business, Lifestyle, etc.
- **Realistic Content**: Generated with Faker.js
- **Proper Relationships**: Users → Posts with foreign keys
- **Temporal Distribution**: Posts spread over realistic timelines

## 🎨 Frontend Development

The React frontend includes:

- **Vite** for fast development and building
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Development Dashboard** showing service status
- **API Integration** with proper error handling
- **Hot Module Replacement** for instant updates

**Development Commands:**
```bash
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## ⚙️ Backend Development

The Node.js API includes:

- **Express.js** with modern ES6 modules
- **TypeScript** configuration
- **Health Check endpoints**
- **CORS** configuration
- **Error handling** middleware
- **Database connection** with pooling
- **Redis integration** for caching

**Development Commands:**
```bash
cd backend
npm run dev      # Start with hot reload
npm run build    # Compile TypeScript
npm run start    # Start production server
npm run test     # Run tests
npm run seed     # Generate test data
```

## 🔒 Code Quality & Git Hooks

### Pre-commit Hooks
- **Prettier formatting** - Auto-format all files
- **ESLint linting** - Check code quality
- **Type checking** - Validate TypeScript types

### Pre-push Hooks
- **Build validation** - Ensure applications build
- **Test execution** - Run test suites
- **Type checking** - Full type validation

### Setup Git Hooks
```bash
# One-time setup
npm install
npm run prepare    # Install Git hooks
```

## 🐳 Docker Configuration

**Development Dockerfiles:**
- **Hot reload** enabled with volume mounts
- **Debug ports** exposed (9229 for Node.js)
- **Health checks** for all services
- **Non-root users** for security
- **Optimized layer caching**

**Service Dependencies:**
- API waits for PostgreSQL and Redis to be healthy
- Frontend waits for API to be available
- Automatic service startup order

## 🔍 Health Monitoring

Comprehensive health checks for all services:

```bash
# Check all services
make health

# Individual service checks
curl http://localhost:3000           # Frontend
curl http://localhost:5001/health    # API
docker exec dev-postgres pg_isready   # PostgreSQL
docker exec dev-redis redis-cli ping  # Redis
```

## 🚨 Troubleshooting

### Common Issues

**Port Conflicts:**
```bash
# Change ports in .env
API_PORT=5002
FRONTEND_PORT=3001
```

**Container Won't Start:**
```bash
# Check logs
make logs-api
make logs-frontend

# Rebuild containers
make clean
make dev
```

**Database Connection Issues:**
```bash
# Reset database volumes
docker-compose down -v
make dev
```

**Permission Issues:**
```bash
# Fix volume permissions
sudo chown -R $USER:$USER .
```

### Getting Help

1. Check the logs: `make logs`
2. Verify configuration: `cat .env`
3. Check service health: `make health`
4. Review documentation: `DEVELOPER_SETUP.md`

## 📚 Documentation

- **[DEVELOPER_SETUP.md](./DEVELOPER_SETUP.md)** - Detailed setup guide
- **[GIT_HOOKS_SETUP.md](./GIT_HOOKS_SETUP.md)** - Code quality setup
- **[backend/README_SEEDING.md](./backend/README_SEEDING.md)** - Database seeding details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting: `make test && make lint`
5. Commit with conventional messages
6. Push and create a pull request

## 📄 License

MIT License - feel free to use for personal and commercial projects.

---

**Made with ❤️ for rapid full-stack development**