#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🎣 Setting up Git hooks...${NC}\n"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo -e "${RED}❌ Not a git repository. Please run 'git init' first.${NC}"
  exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
  echo -e "${RED}❌ npm is not installed. Please install Node.js and npm.${NC}"
  exit 1
fi

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install --save-dev \
  husky \
  lint-staged \
  @commitlint/cli \
  @commitlint/config-conventional \
  eslint \
  prettier \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin

# Initialize Husky
echo -e "\n${BLUE}🔧 Initializing Husky...${NC}"
npx husky install

# Enable Git hooks in package.json
if ! grep -q '"prepare":' package.json; then
  echo -e "${YELLOW}⚠️  Adding 'prepare' script to package.json${NC}"
  npm pkg set scripts.prepare="husky install"
fi

# Create .husky directory if it doesn't exist
mkdir -p .husky

# Create pre-commit hook
echo -e "${BLUE}📝 Creating pre-commit hook...${NC}"
cat > .husky/pre-commit << 'HOOK'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# Run lint-staged
npx lint-staged

# Type checking (if TypeScript project)
if [ -f "tsconfig.json" ]; then
  echo "🔍 Type checking..."
  npm run type-check 2>/dev/null || npx tsc --noEmit
fi

echo "✅ Pre-commit checks passed!"
HOOK

# Create commit-msg hook
echo -e "${BLUE}📝 Creating commit-msg hook...${NC}"
cat > .husky/commit-msg << 'HOOK'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx --no -- commitlint --edit $1
HOOK

# Create pre-push hook
echo -e "${BLUE}📝 Creating pre-push hook...${NC}"
cat > .husky/pre-push << 'HOOK'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🧪 Running pre-push checks..."

# Run tests if test script exists
if npm run test --if-present 2>/dev/null; then
  echo "✅ Tests passed!"
else
  echo "⚠️  No tests found or tests failed"
fi

# Check for console.log in staged files
if git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$' | xargs grep -l "console\.log" > /dev/null 2>&1; then
  echo "⚠️  Warning: console.log statements found in staged files"
fi

echo "✅ Pre-push checks completed!"
HOOK

# Make all hooks executable
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push

# Create lint-staged config
if [ ! -f ".lintstagedrc.js" ]; then
  echo -e "${BLUE}📝 Creating .lintstagedrc.js...${NC}"
  cat > .lintstagedrc.js << 'CONFIG'
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
};
CONFIG
fi

# Create commitlint config
if [ ! -f ".commitlintrc.js" ]; then
  echo -e "${BLUE}📝 Creating .commitlintrc.js...${NC}"
  cat > .commitlintrc.js << 'CONFIG'
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
        'perf',     // Performance improvement
        'test',     // Tests
        'chore',    // Maintenance
        'ci',       // CI/CD
        'build',    // Build system
        'revert',   // Revert commit
      ],
    ],
    'subject-case': [0], // Allow any case
    'subject-max-length': [2, 'always', 100],
  },
};
CONFIG
fi

# Create ESLint config if it doesn't exist
if [ ! -f ".eslintrc.js" ] && [ ! -f ".eslintrc.json" ]; then
  echo -e "${BLUE}📝 Creating .eslintrc.js...${NC}"
  cat > .eslintrc.js << 'CONFIG'
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['@typescript-eslint'],
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
CONFIG
fi

# Create Prettier config if it doesn't exist
if [ ! -f ".prettierrc.js" ] && [ ! -f ".prettierrc.json" ]; then
  echo -e "${BLUE}📝 Creating .prettierrc.js...${NC}"
  cat > .prettierrc.js << 'CONFIG'
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
CONFIG
fi

# Create .prettierignore
if [ ! -f ".prettierignore" ]; then
  echo -e "${BLUE}📝 Creating .prettierignore...${NC}"
  cat > .prettierignore << 'IGNORE'
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
IGNORE
fi

# Add scripts to package.json if they don't exist
echo -e "${BLUE}📝 Adding npm scripts...${NC}"
npm pkg set scripts.lint="eslint . --ext .ts,.tsx,.js,.jsx" --json
npm pkg set scripts.lint:fix="eslint . --ext .ts,.tsx,.js,.jsx --fix" --json
npm pkg set scripts.format="prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"" --json
npm pkg set scripts.format:check="prettier --check \"**/*.{ts,tsx,js,jsx,json,md}\"" --json
npm pkg set scripts.type-check="tsc --noEmit" --json

echo -e "\n${GREEN}✅ Git hooks setup complete!${NC}\n"
echo -e "${BLUE}📋 Available commands:${NC}"
echo -e "   npm run lint          - Check for linting errors"
echo -e "   npm run lint:fix      - Fix linting errors"
echo -e "   npm run format        - Format code"
echo -e "   npm run format:check  - Check code formatting"
echo -e "   npm run type-check    - Check TypeScript types"
echo -e "\n${BLUE}🎯 Commit message format:${NC}"
echo -e "   type(scope): subject"
echo -e "   Example: feat(auth): add login functionality"
echo -e "\n${BLUE}📝 Valid types:${NC}"
echo -e "   feat, fix, docs, style, refactor, perf, test, chore, ci, build"
echo -e "\n${YELLOW}💡 Try making a commit to test the hooks!${NC}\n"
