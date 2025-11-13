---
name: git-hooks
description: Automate code quality checks with Git hooks. Use when setting up pre-commit linting, pre-push testing, commit message validation, or automated code formatting. Supports Husky, lint-staged, ESLint, Prettier, and custom hooks for any project.
---

# Git Hooks

Automate code quality enforcement through Git hooks. This skill sets up pre-commit linting, pre-push testing, commit message validation, and automated formatting.

## Core Workflows

### 1. Install Husky for Hook Management

Generate package.json scripts and setup:

```json
{
  "scripts": {
    "prepare": "husky install",
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "test": "jest",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "husky": "^8.0.0",
    "lint-staged": "^15.0.0",
    "@commitlint/cli": "^18.0.0",
    "@commitlint/config-conventional": "^18.0.0"
  }
}
```

### 2. Pre-Commit Hook (Linting & Formatting)

```bash
# Generate: .husky/pre-commit

#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# Run lint-staged
npx lint-staged

# Type checking
echo "🔍 Type checking..."
npm run type-check

echo "✅ Pre-commit checks passed!"
```

### 3. Lint-Staged Configuration

```javascript
// Generate: .lintstagedrc.js

module.exports = {
  // TypeScript/JavaScript files
  '*.{ts,tsx,js,jsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  
  // JSON, Markdown, YAML files
  '*.{json,md,yaml,yml}': [
    'prettier --write',
  ],
  
  // CSS/SCSS files
  '*.{css,scss}': [
    'prettier --write',
  ],
  
  // Run tests for changed files
  '*.{ts,tsx}': [
    'jest --bail --findRelatedTests',
  ],
};
```

### 4. Pre-Push Hook (Testing)

```bash
# Generate: .husky/pre-push

#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🧪 Running pre-push checks..."

# Run all tests
npm run test

# Check for console.log statements
if git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$' | xargs grep -n "console\.log" > /dev/null; then
  echo "❌ Found console.log statements. Please remove them before pushing."
  exit 1
fi

echo "✅ Pre-push checks passed!"
```

### 5. Commit Message Validation

```bash
# Generate: .husky/commit-msg

#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Use commitlint
npx --no -- commitlint --edit $1
```

```javascript
// Generate: .commitlintrc.js

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation
        'style',    // Formatting
        'refactor', // Code refactoring
        'perf',     // Performance
        'test',     // Tests
        'chore',    // Maintenance
        'ci',       // CI/CD
        'build',    // Build system
      ],
    ],
    'subject-case': [0], // Allow any case
    'subject-max-length': [2, 'always', 100],
  },
};
```

### 6. ESLint Configuration

```javascript
// Generate: .eslintrc.js

module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier', // Disable ESLint rules that conflict with Prettier
  ],
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/prop-types': 'off', // Using TypeScript
  },
};
```

### 7. Prettier Configuration

```javascript
// Generate: .prettierrc.js

module.exports = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'avoid',
  endOfLine: 'lf',
};
```

```
# Generate: .prettierignore

node_modules
dist
build
coverage
.next
.cache
*.min.js
*.min.css
package-lock.json
yarn.lock
pnpm-lock.yaml
```

## Advanced Hooks

### Branch Protection

```bash
# Generate: .husky/pre-commit (enhanced)

#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Prevent commits to main/master
branch="$(git rev-parse --abbrev-ref HEAD)"

if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "❌ Direct commits to $branch are not allowed."
  echo "   Create a feature branch instead:"
  echo "   git checkout -b feature/your-feature-name"
  exit 1
fi

# Standard checks
npx lint-staged
npm run type-check
```

### Security Scanning

```bash
# Generate: .husky/pre-push (enhanced with security)

#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔐 Running security checks..."

# Check for secrets
if command -v gitleaks &> /dev/null; then
  gitleaks detect --source . --verbose
else
  echo "⚠️  gitleaks not installed, skipping secret scanning"
fi

# Check for vulnerable dependencies
npm audit --audit-level=moderate

# Run tests
npm run test

echo "✅ All checks passed!"
```

### Large File Prevention

```bash
# Generate: .husky/pre-commit (add to existing)

# Prevent large files from being committed
max_size=5242880 # 5MB in bytes

for file in $(git diff --cached --name-only); do
  if [ -f "$file" ]; then
    file_size=$(wc -c < "$file")
    if [ "$file_size" -gt "$max_size" ]; then
      echo "❌ File $file is too large ($file_size bytes > $max_size bytes)"
      echo "   Consider using Git LFS for large files"
      exit 1
    fi
  fi
done
```

### Dependency Check

```bash
# Generate: .husky/post-merge

#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Check if package.json changed
if git diff --name-only HEAD@{1} HEAD | grep -q "package.json"; then
  echo "📦 package.json changed, running npm install..."
  npm install
fi
```

## Setup Script

```bash
# Generate: scripts/setup-hooks.sh

#!/bin/bash
set -e

echo "🎣 Setting up Git hooks..."

# Install Husky
npm install --save-dev husky lint-staged @commitlint/cli @commitlint/config-conventional

# Initialize Husky
npx husky install

# Create hooks directory
mkdir -p .husky

# Create pre-commit hook
cat > .husky/pre-commit << 'HOOK'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."
npx lint-staged
npm run type-check
echo "✅ Pre-commit checks passed!"
HOOK

# Create commit-msg hook
cat > .husky/commit-msg << 'HOOK'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx --no -- commitlint --edit $1
HOOK

# Create pre-push hook
cat > .husky/pre-push << 'HOOK'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🧪 Running tests..."
npm run test
echo "✅ Tests passed!"
HOOK

# Make hooks executable
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push

# Create config files if they don't exist
if [ ! -f ".lintstagedrc.js" ]; then
  echo "Creating .lintstagedrc.js..."
  cat > .lintstagedrc.js << 'CONFIG'
module.exports = {
  '*.{ts,tsx,js,jsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yaml,yml}': ['prettier --write'],
};
CONFIG
fi

if [ ! -f ".commitlintrc.js" ]; then
  echo "Creating .commitlintrc.js..."
  cat > .commitlintrc.js << 'CONFIG'
module.exports = {
  extends: ['@commitlint/config-conventional'],
};
CONFIG
fi

echo "✅ Git hooks setup complete!"
echo ""
echo "Try making a commit to test the hooks:"
echo "  git add ."
echo "  git commit -m 'feat: test commit'"

## Configuration Profiles

### Minimal (Quick Start)

```json
// package.json
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": "eslint --fix",
    "*.{json,md}": "prettier --write"
  }
}
```

### Standard (Recommended)

Includes linting, formatting, type-checking, and commit validation.

### Strict (Maximum Quality)

Adds testing, security scanning, and branch protection.

## Integration with zero-to-running

When both skills are active:
1. Hooks are set up automatically during `make dev`
2. `make lint` and `make format` available in Makefile
3. CI/CD configuration matches local hooks
4. Team documentation includes commit conventions

## Bypassing Hooks (Emergency)

```bash
# Skip pre-commit (use sparingly!)
git commit --no-verify -m "emergency fix"

# Skip pre-push
git push --no-verify
```

## Troubleshooting

**Hooks not running:**
```bash
# Reinstall hooks
rm -rf .husky
npm run prepare
```

**Permission errors:**
```bash
# Make hooks executable
chmod +x .husky/*
```

**Hooks too slow:**
```bash
# Use lint-staged to only check changed files
# Already configured in examples above
```

## Best Practices

1. **Start simple** - Add hooks gradually
2. **Keep hooks fast** - Use lint-staged for incremental checks
3. **Document conventions** - Add CONTRIBUTING.md with commit format
4. **Make it optional** - Allow `--no-verify` for emergencies
5. **Align with CI** - Match local hooks to CI checks
6. **Test hooks** - Verify hooks work before sharing with team
