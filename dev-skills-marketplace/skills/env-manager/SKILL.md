---
name: env-manager
description: Manage multiple development environment profiles (dev/test/staging/prod). Use when developers need to switch between environments, validate configuration, manage secrets, or ensure environment parity. Supports profile switching, variable validation, secret encryption, and environment-specific configurations.
---

# Environment Manager

Streamline management of multiple environment profiles with automated switching, validation, and secret handling.

## Core Workflows

### 1. Environment Profile Structure

```bash
# Directory structure
.env.development    # Development environment
.env.test          # Test environment
.env.staging       # Staging environment
.env.production    # Production environment (never committed)
.env.example       # Template with all variables
.env               # Current active environment (gitignored)
```

### 2. Profile Switcher Script

```bash
# Generate: scripts/switch-env.sh

#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo -e "${RED}❌ Usage: ./scripts/switch-env.sh [dev|test|staging|prod]${NC}"
  exit 1
fi

# Map short names to full names
case $ENVIRONMENT in
  dev|development)
    ENV_FILE=".env.development"
    ;;
  test|testing)
    ENV_FILE=".env.test"
    ;;
  stage|staging)
    ENV_FILE=".env.staging"
    ;;
  prod|production)
    ENV_FILE=".env.production"
    ;;
  *)
    echo -e "${RED}❌ Unknown environment: $ENVIRONMENT${NC}"
    echo "Valid options: dev, test, staging, prod"
    exit 1
    ;;
esac

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ Environment file not found: $ENV_FILE${NC}"
  exit 1
fi

# Backup current .env if it exists
if [ -f ".env" ]; then
  cp .env .env.backup
  echo -e "${YELLOW}📦 Backed up current .env to .env.backup${NC}"
fi

# Copy environment file
cp "$ENV_FILE" .env
echo -e "${GREEN}✅ Switched to $ENVIRONMENT environment${NC}"

# Show key differences
echo -e "\n${BLUE}📋 Active configuration:${NC}"
grep -E "^[A-Z_]+=.*" .env | head -10

# Validate environment
./scripts/validate-env.sh

echo -e "\n${YELLOW}💡 Restart your services for changes to take effect:${NC}"
echo -e "   ${BLUE}make dev-reset${NC}"

### 3. Environment Validator

```typescript
// Generate: scripts/validate-env.ts

import fs from 'fs';
import path from 'path';

interface ValidationRule {
  key: string;
  required: boolean;
  type?: 'string' | 'number' | 'boolean' | 'url' | 'email';
  pattern?: RegExp;
  enum?: string[];
}

const VALIDATION_RULES: ValidationRule[] = [
  // Service Ports
  { key: 'FRONTEND_PORT', required: true, type: 'number' },
  { key: 'API_PORT', required: true, type: 'number' },
  { key: 'POSTGRES_PORT', required: true, type: 'number' },
  { key: 'REDIS_PORT', required: true, type: 'number' },
  
  // Database
  { key: 'DB_NAME', required: true, type: 'string' },
  { key: 'DB_USER', required: true, type: 'string' },
  { key: 'DB_PASSWORD', required: true, type: 'string' },
  { key: 'DATABASE_URL', required: false, type: 'url' },
  
  // Environment
  { key: 'NODE_ENV', required: true, enum: ['development', 'test', 'staging', 'production'] },
  { key: 'LOG_LEVEL', required: false, enum: ['error', 'warn', 'info', 'debug'] },
  
  // URLs
  { key: 'VITE_API_URL', required: true, type: 'url' },
];

function loadEnv(envPath: string = '.env'): Record<string, string> {
  const env: Record<string, string> = {};
  
  if (!fs.existsSync(envPath)) {
    throw new Error(`Environment file not found: ${envPath}`);
  }
  
  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }
  
  return env;
}

function validateValue(key: string, value: string, rule: ValidationRule): string[] {
  const errors: string[] = [];
  
  // Type validation
  if (rule.type === 'number' && isNaN(Number(value))) {
    errors.push(`${key} must be a number`);
  }
  
  if (rule.type === 'boolean' && !['true', 'false'].includes(value.toLowerCase())) {
    errors.push(`${key} must be true or false`);
  }
  
  if (rule.type === 'url') {
    try {
      new URL(value);
    } catch {
      errors.push(`${key} must be a valid URL`);
    }
  }
  
  if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push(`${key} must be a valid email`);
  }
  
  // Pattern validation
  if (rule.pattern && !rule.pattern.test(value)) {
    errors.push(`${key} does not match required pattern`);
  }
  
  // Enum validation
  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(`${key} must be one of: ${rule.enum.join(', ')}`);
  }
  
  return errors;
}

function validateEnvironment(envPath: string = '.env'): void {
  console.log('🔍 Validating environment configuration...\n');
  
  try {
    const env = loadEnv(envPath);
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required variables
    for (const rule of VALIDATION_RULES) {
      const value = env[rule.key];
      
      if (rule.required && !value) {
        errors.push(`Missing required variable: ${rule.key}`);
      } else if (value) {
        const validationErrors = validateValue(rule.key, value, rule);
        errors.push(...validationErrors);
      }
    }
    
    // Check for insecure defaults in production
    if (env.NODE_ENV === 'production') {
      const insecureVars = [
        'dev_password',
        'dev_secret',
        'change_in_production',
        'localhost',
      ];
      
      for (const [key, value] of Object.entries(env)) {
        for (const insecure of insecureVars) {
          if (value.toLowerCase().includes(insecure)) {
            warnings.push(`${key} contains insecure value for production: ${value}`);
          }
        }
      }
    }
    
    // Display results
    if (errors.length === 0) {
      console.log('✅ Environment validation passed!');
      
      if (warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        warnings.forEach(w => console.log(`   • ${w}`));
      }
      
      process.exit(0);
    } else {
      console.log('❌ Environment validation failed!\n');
      console.log('Errors:');
      errors.forEach(e => console.log(`   • ${e}`));
      
      if (warnings.length > 0) {
        console.log('\nWarnings:');
        warnings.forEach(w => console.log(`   • ${w}`));
      }
      
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  const envPath = process.argv[2] || '.env';
  validateEnvironment(envPath);
}

export { validateEnvironment, loadEnv };
```

### 4. Secret Encryption Helper

```typescript
// Generate: scripts/encrypt-secrets.ts

import crypto from 'crypto';
import fs from 'fs';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

class SecretManager {
  private key: Buffer;
  
  constructor(masterPassword: string) {
    // Derive key from master password
    this.key = crypto.scryptSync(masterPassword, 'salt', KEY_LENGTH);
  }
  
  encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Return: iv:tag:encrypted
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }
  
  decrypt(encrypted: string): string {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    
    const [ivHex, tagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  encryptFile(inputPath: string, outputPath: string): void {
    const content = fs.readFileSync(inputPath, 'utf-8');
    const lines = content.split('\n');
    const encrypted: string[] = [];
    
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=');
          const encryptedValue = this.encrypt(value);
          encrypted.push(`${key}=${encryptedValue}`);
        } else {
          encrypted.push(line);
        }
      } else {
        encrypted.push(line);
      }
    }
    
    fs.writeFileSync(outputPath, encrypted.join('\n'));
  }
  
  decryptFile(inputPath: string, outputPath: string): void {
    const content = fs.readFileSync(inputPath, 'utf-8');
    const lines = content.split('\n');
    const decrypted: string[] = [];
    
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const encryptedValue = valueParts.join('=');
          try {
            const value = this.decrypt(encryptedValue);
            decrypted.push(`${key}=${value}`);
          } catch {
            // Not encrypted, keep as-is
            decrypted.push(line);
          }
        } else {
          decrypted.push(line);
        }
      } else {
        decrypted.push(line);
      }
    }
    
    fs.writeFileSync(outputPath, decrypted.join('\n'));
  }
}

// CLI usage
if (require.main === module) {
  const [,, command, inputFile, outputFile] = process.argv;
  const password = process.env.MASTER_PASSWORD;
  
  if (!password) {
    console.error('❌ Set MASTER_PASSWORD environment variable');
    process.exit(1);
  }
  
  if (!command || !inputFile) {
    console.error('Usage: MASTER_PASSWORD=xxx ts-node encrypt-secrets.ts [encrypt|decrypt] <input> <output>');
    process.exit(1);
  }
  
  const manager = new SecretManager(password);
  
  try {
    if (command === 'encrypt') {
      manager.encryptFile(inputFile, outputFile || `${inputFile}.encrypted`);
      console.log('✅ Secrets encrypted');
    } else if (command === 'decrypt') {
      manager.decryptFile(inputFile, outputFile || `${inputFile}.decrypted`);
      console.log('✅ Secrets decrypted');
    } else {
      console.error('Unknown command:', command);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

export { SecretManager };
```

### 5. Environment Comparison

```bash
# Generate: scripts/compare-envs.sh

#!/bin/bash

ENV1=${1:-.env.development}
ENV2=${2:-.env.production}

echo "📊 Comparing $ENV1 vs $ENV2"
echo ""

# Get all unique keys
KEYS=$(cat "$ENV1" "$ENV2" | grep -E "^[A-Z_]+" | cut -d'=' -f1 | sort | uniq)

echo "Key                          | $ENV1 | $ENV2"
echo "--------------------------------------------------------"

for key in $KEYS; do
  val1=$(grep "^$key=" "$ENV1" 2>/dev/null | cut -d'=' -f2-)
  val2=$(grep "^$key=" "$ENV2" 2>/dev/null | cut -d'=' -f2-)
  
  if [ "$val1" = "$val2" ]; then
    status="✓"
  elif [ -z "$val1" ]; then
    status="Missing in $ENV1"
  elif [ -z "$val2" ]; then
    status="Missing in $ENV2"
  else
    status="Different"
  fi
  
  printf "%-28s | %-10s | %s\n" "$key" "${val1:0:10}" "${val2:0:10}"
done
```

### 6. Environment Templates

```bash
# Generate: .env.development

# Development Environment Configuration
NODE_ENV=development
LOG_LEVEL=debug

# Service Ports
FRONTEND_PORT=3000
API_PORT=8000
POSTGRES_PORT=5432
REDIS_PORT=6379

# Database
DB_NAME=dev_db
DB_USER=dev_user
DB_PASSWORD=dev_password
DATABASE_URL=postgres://dev_user:dev_password@localhost:5432/dev_db

# Redis
REDIS_URL=redis://localhost:6379

# URLs
VITE_API_URL=http://localhost:8000

# Feature Flags
ENABLE_DEBUG=true
ENABLE_HOT_RELOAD=true
ENABLE_SOURCE_MAPS=true

# Development Settings
SEED_DATABASE=true
```

```bash
# Generate: .env.test

# Test Environment Configuration
NODE_ENV=test
LOG_LEVEL=error

# Service Ports
FRONTEND_PORT=3001
API_PORT=8001
POSTGRES_PORT=5433
REDIS_PORT=6380

# Database
DB_NAME=test_db
DB_USER=test_user
DB_PASSWORD=test_password
DATABASE_URL=postgres://test_user:test_password@localhost:5433/test_db

# Redis
REDIS_URL=redis://localhost:6380

# URLs
VITE_API_URL=http://localhost:8001

# Feature Flags
ENABLE_DEBUG=false
ENABLE_HOT_RELOAD=false
ENABLE_SOURCE_MAPS=true

# Test Settings
SEED_DATABASE=true
TEST_TIMEOUT=5000
```

## Makefile Integration

```makefile
.PHONY: env-switch env-validate env-compare

env-switch: ## Switch environment profile
	@./scripts/switch-env.sh $(ENV)

env-validate: ## Validate current environment
	@npm run env:validate

env-compare: ## Compare two environment files
	@./scripts/compare-envs.sh $(ENV1) $(ENV2)

# Example usage:
# make env-switch ENV=prod
# make env-compare ENV1=.env.development ENV2=.env.staging
```

## Best Practices

1. **Never commit production secrets** - Use secret management services
2. **Validate on startup** - Catch config errors early
3. **Use environment-specific defaults** - Reduce configuration burden
4. **Document all variables** - Maintain .env.example
5. **Encrypt sensitive configs** - For sharing in teams
6. **Test environment parity** - Minimize dev/prod differences

## Integration with zero-to-running

When both skills are active:
1. Environment switching integrated into dev workflow
2. Validation runs before services start
3. Environment templates provided automatically
4. Makefile targets for easy switching

## Troubleshooting

**Variables not loading:**
```bash
# Check file format
cat -A .env | head

# Validate syntax
./scripts/validate-env.sh
```

**Permission errors:**
```bash
chmod 600 .env
chmod 600 .env.*
```
