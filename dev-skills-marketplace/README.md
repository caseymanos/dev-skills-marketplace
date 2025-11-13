# Dev Skills Plugin for Claude

A comprehensive Claude skill plugin that provides 5 essential development automation skills for setting up and managing development environments.

## 🚀 Skills Included

### 1. **zero-to-running** - Environment Setup
- Generates complete development environments with Docker Compose
- Creates React + Node.js + PostgreSQL + Redis stacks
- Includes health checks, hot reload, and development tools
- One-command startup: `make dev`

### 2. **database-seeding** - Test Data Generation
- Creates realistic test data with Faker.js
- Supports multiple data models and relationships
- Configurable data volumes (demo, large, custom)
- Database statistics and analytics

### 3. **git-hooks** - Code Quality Automation
- Pre-commit linting and formatting with ESLint + Prettier
- Pre-push testing and build validation
- Commit message standards enforcement
- Works with React and Node.js projects

### 4. **local-ssl** - Local HTTPS Development
- Sets up trusted SSL certificates for local development
- Perfect for OAuth, payments, and service worker testing
- Automatic nginx configuration
- Works with custom domains

### 5. **env-manager** - Environment Profile Management
- Multiple environment profiles (dev, test, staging)
- Environment variable validation and switching
- Template-based environment setup
- Easy configuration management

## 📦 Installation

### Option 1: Direct Download
1. **Download this repository:**
   ```bash
   git clone https://github.com/caseymanos/dev-skills-marketplace.git
   cd dev-skills-marketplace
   ```

2. **Load as Claude Plugin:**
   - In Claude Code, add this directory as a plugin source
   - The plugin will be automatically detected and loaded

### Option 2: Manual Installation
1. Copy the entire `dev-skills-marketplace` folder to your Claude plugins directory
2. Restart Claude Code
3. The skills will be available automatically

## 🎯 Quick Start

Once installed, Claude will automatically use these skills when you ask for:

- **"Set up a development environment"** → Triggers zero-to-running
- **"Generate test data for my database"** → Triggers database-seeding
- **"Set up Git hooks for code quality"** → Triggers git-hooks
- **"Enable HTTPS locally"** → Triggers local-ssl
- **"Manage environment profiles"** → Triggers env-manager

## 📋 Requirements

- Docker & Docker Compose
- Node.js 18+
- Git
- Claude Code or Claude Desktop

## 🔧 Features

- **Zero Configuration**: Works out of the box
- **Production Ready**: Follows best practices
- **Hot Reload**: Automatic code refresh
- **Health Monitoring**: Built-in health checks
- **TypeScript Support**: Full type safety
- **Comprehensive Docs**: Detailed documentation for each skill

## 📚 Documentation

Each skill includes comprehensive documentation:
- `skills/*/SKILL.md` - Main skill documentation
- `skills/*/README.md` - Setup instructions
- `skills/*/assets/` - Configuration templates
- `skills/*/scripts/` - Automation scripts

## 🎯 Example Usage

```bash
# Claude will automatically detect and use these skills:

# Set up a React + Node.js + PostgreSQL environment
"Please set up a development environment for my React and Node.js app"

# Generate realistic test data
"Can you create some test data for my user database?"

# Set up code quality automation
"I want to set up pre-commit hooks for linting and formatting"

# Enable local HTTPS
"I need HTTPS for local development to test OAuth"

# Switch environments
"Help me switch from development to staging environment"
```

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

MIT License - feel free to use in personal and commercial projects.

---

**Made with ❤️ for developers who want to focus on code, not configuration**