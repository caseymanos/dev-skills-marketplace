# Dev Skills Plugin - Installation Guide

## Quick Start

1. **Add the marketplace to Claude Code:**
```shell
/plugin marketplace add /home/claude/dev-skills-marketplace
```

2. **Install the plugin:**
```shell
/plugin install dev-skills-plugin@dev-skills-marketplace
```

3. **Restart Claude Code** to activate the skills

4. **Verify installation:**
```shell
/help
```
The 6 developer skills are now available and Claude will use them automatically.

## What You Get

✅ **dev-environment-wizard** - Interactive dev environment setup
✅ **zero-to-running** - Multi-service app automation  
✅ **git-hooks** - Automated code quality checks
✅ **local-ssl** - HTTPS for local development
✅ **env-manager** - Environment profile management
✅ **database-seeding** - Test data generation

## Testing the Plugin

Try these prompts to see the skills in action:

- "Set up a new development environment for a React + Node app"
- "Add pre-commit hooks for ESLint and Prettier"
- "Enable HTTPS for my local development server"
- "Create database seed data for a user management system"
- "Set up environment profiles for dev, staging, and production"

## Team Distribution

To share this plugin with your team:

1. **Move to shared location** (network drive, Git repo, etc.)
2. **Update team's repository** `.claude/settings.json`:

```json
{
  "plugin_marketplaces": [
    {
      "name": "team-dev-tools",
      "source": "/shared/path/dev-skills-marketplace"
    }
  ],
  "plugins": [
    {
      "name": "dev-skills-plugin",
      "marketplace": "team-dev-tools",
      "enabled": true
    }
  ]
}
```

3. **Team members trust the repo folder** - plugins install automatically

## Troubleshooting

**Skills not activating?**
- Ensure you restarted Claude Code after installation
- Check plugin is enabled: `/plugin` → "Manage Plugins"

**Need to update?**
```shell
/plugin uninstall dev-skills-plugin@dev-skills-marketplace
/plugin install dev-skills-plugin@dev-skills-marketplace
```

## Location

Plugin files: `/home/claude/dev-skills-marketplace/dev-skills-plugin/`

## Support

For issues or questions, check the individual skill documentation in the `skills/` directory.
