# Dev Skills Plugin - Quick Start

## Installation (3 steps)

1. **Add marketplace:**
   ```shell
   /plugin marketplace add /path/to/dev-skills-marketplace
   ```

2. **Install plugin:**
   ```shell
   /plugin install dev-skills-plugin@dev-skills-marketplace
   ```

3. **Restart Claude Code**

## What's Inside

6 developer skills that Claude uses automatically:

| Skill | Purpose |
|-------|---------|
| **dev-environment-wizard** | Interactive setup wizard - coordinates other skills |
| **zero-to-running** | React/Node/PostgreSQL/Redis/K8s single-command setup |
| **git-hooks** | Pre-commit linting, testing, formatting automation |
| **local-ssl** | HTTPS certificates for local development |
| **env-manager** | Switch between dev/test/staging/prod profiles |
| **database-seeding** | Generate realistic test data with Faker |

## Try It

Ask Claude:
- "Set up a new dev environment for React + Node"
- "Add pre-commit hooks for ESLint"
- "Enable HTTPS locally"
- "Create seed data for a user database"
- "Set up environment profiles"

Skills activate automatically based on your request.

## Files

- Extract: `tar -xzf dev-skills-plugin.tar.gz`
- Location after extraction: `dev-skills-marketplace/`
- Total size: ~37KB compressed, ~139KB uncompressed

## Structure

```
dev-skills-marketplace/
├── .claude-plugin/marketplace.json
├── dev-skills-plugin/
│   ├── .claude-plugin/plugin.json
│   ├── skills/
│   │   ├── dev-environment-wizard/
│   │   ├── zero-to-running/
│   │   ├── git-hooks/
│   │   ├── local-ssl/
│   │   ├── env-manager/
│   │   └── database-seeding/
│   └── README.md
├── INSTALL.md (detailed guide)
└── QUICK_START.md (this file)
```

## Team Setup

Add to repo's `.claude/settings.json`:

```json
{
  "plugin_marketplaces": [
    {"name": "team-dev", "source": "/shared/dev-skills-marketplace"}
  ],
  "plugins": [
    {"name": "dev-skills-plugin", "marketplace": "team-dev", "enabled": true}
  ]
}
```

Team members trust the repo → auto-installs for everyone.
