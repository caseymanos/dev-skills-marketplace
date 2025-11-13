# Developer Skills Plugin

Complete developer environment setup and automation toolkit with 6 essential skills for modern development workflows.

## What's Included

This plugin provides 6 powerful development skills that Claude can automatically use:

1. **dev-environment-wizard** - Interactive setup wizard for development environments
2. **zero-to-running** - Automate local dev environment setup for multi-service applications
3. **git-hooks** - Automate code quality checks with Git hooks
4. **local-ssl** - Enable HTTPS for local development with trusted SSL certificates
5. **env-manager** - Manage multiple development environment profiles
6. **database-seeding** - Generate and manage database seed data

## Installation

### Quick Install

1. Add this directory as a marketplace:
```shell
/plugin marketplace add /path/to/dev-skills-plugin-marketplace
```

2. Install the plugin:
```shell
/plugin install dev-skills-plugin@local-dev
```

3. Restart Claude Code to activate the skills

### Team Installation

Add to your repository's `.claude/settings.json`:

```json
{
  "plugin_marketplaces": [
    {
      "name": "local-dev",
      "source": "/path/to/dev-skills-plugin-marketplace"
    }
  ],
  "plugins": [
    {
      "name": "dev-skills-plugin",
      "marketplace": "local-dev",
      "enabled": true
    }
  ]
}
```

## Usage

Once installed, Claude will automatically use these skills when relevant to your development tasks:

- **Setting up new projects**: Ask Claude to set up a development environment
- **Configuring Git hooks**: Request pre-commit linting or testing setup
- **Adding HTTPS locally**: Ask to enable SSL for local development
- **Managing environments**: Request environment profile switching
- **Database setup**: Ask for realistic test data generation

## Skills Overview

### dev-environment-wizard
Interactive wizard that asks discovery questions about tech stack, services, and preferences, then coordinates other skills to generate customized environments.

**Triggers**: "set up", "create", "initialize" + "development environment"

### zero-to-running
Single-command setup for multi-service apps with frontend (React/TypeScript/Tailwind), backend (Node/TypeScript), PostgreSQL, Redis, and Kubernetes.

**Triggers**: "quick setup", "local dev environment", "docker-compose", "kubernetes orchestration"

### git-hooks
Automates pre-commit linting, pre-push testing, commit message validation, and code formatting. Supports Husky, lint-staged, ESLint, Prettier.

**Triggers**: "git hooks", "pre-commit", "linting", "code formatting automation"

### local-ssl
Sets up HTTPS for local development with trusted SSL certificates using mkcert or OpenSSL. Handles automatic certificate trust configuration.

**Triggers**: "local SSL", "HTTPS locally", "SSL certificates", "test SSL features"

### env-manager
Switch between dev/test/staging/prod environments, validate configuration, manage secrets, ensure environment parity.

**Triggers**: "environment profiles", "switch environments", "manage secrets", "env variables"

### database-seeding
Generate realistic test data with Faker, handle database migrations with initial data, support PostgreSQL, MySQL, SQLite with relationship management.

**Triggers**: "seed data", "test data", "database fixtures", "realistic data generation"

## Version

1.0.0

## Author

Casey

## License

MIT
