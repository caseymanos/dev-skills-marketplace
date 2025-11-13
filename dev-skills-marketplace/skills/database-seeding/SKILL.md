---
name: database-seeding
description: Generate and manage database seed data for development and testing. Use when developers need realistic test data, database migrations with initial data, or automated seeding for local environments. Supports PostgreSQL, MySQL, SQLite with Faker-based data generation and relationship management.
---

# Database Seeding

Automate creation of realistic test data for development databases. This skill generates seed scripts, manages data relationships, and integrates with migration systems.

## Core Workflows

### 1. Generate Seed Data Factory

Create a data factory system for generating realistic test data:

```typescript
// Generate: scripts/seed-factory.ts

import { faker } from '@faker-js/faker';
import { Pool } from 'pg';

interface SeedConfig {
  users: number;
  posts: number;
  comments: number;
}

export class SeedFactory {
  constructor(private pool: Pool) {}

  async generateUsers(count: number) {
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push({
        email: faker.internet.email(),
        name: faker.person.fullName(),
        username: faker.internet.userName(),
        avatar: faker.image.avatar(),
        bio: faker.lorem.paragraph(),
        created_at: faker.date.past(),
      });
    }
    return users;
  }

  async generatePosts(userIds: string[], count: number) {
    const posts = [];
    for (let i = 0; i < count; i++) {
      posts.push({
        user_id: faker.helpers.arrayElement(userIds),
        title: faker.lorem.sentence(),
        content: faker.lorem.paragraphs(3),
        published: faker.datatype.boolean(),
        created_at: faker.date.past(),
      });
    }
    return posts;
  }

  async seed(config: SeedConfig) {
    console.log('🌱 Starting database seeding...');
    
    // Clear existing data
    await this.pool.query('TRUNCATE users, posts, comments CASCADE');
    
    // Seed users
    const users = await this.generateUsers(config.users);
    const userInserts = await Promise.all(
      users.map(u => this.pool.query(
        'INSERT INTO users (email, name, username, avatar, bio, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [u.email, u.name, u.username, u.avatar, u.bio, u.created_at]
      ))
    );
    const userIds = userInserts.map(r => r.rows[0].id);
    console.log(`✅ Created ${userIds.length} users`);
    
    // Seed posts
    const posts = await this.generatePosts(userIds, config.posts);
    const postInserts = await Promise.all(
      posts.map(p => this.pool.query(
        'INSERT INTO posts (user_id, title, content, published, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [p.user_id, p.title, p.content, p.published, p.created_at]
      ))
    );
    console.log(`✅ Created ${postInserts.length} posts`);
    
    console.log('🎉 Seeding complete!');
  }
}

### 2. Create Seed Runner Script

Generate the main seeding script that can be run via npm/make:

```typescript
// Generate: scripts/seed.ts

import { Pool } from 'pg';
import { SeedFactory } from './seed-factory';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const factory = new SeedFactory(pool);
    
    // Read config from environment or use defaults
    const config = {
      users: parseInt(process.env.SEED_USERS || '50'),
      posts: parseInt(process.env.SEED_POSTS || '200'),
      comments: parseInt(process.env.SEED_COMMENTS || '500'),
    };

    await factory.seed(config);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
```

### 3. SQL-Based Seeding (Alternative)

For simpler cases or non-TypeScript projects:

```sql
-- Generate: scripts/seed.sql

-- Clear existing data
TRUNCATE users, posts, comments CASCADE;

-- Insert users
INSERT INTO users (email, name, username, created_at) VALUES
  ('alice@example.com', 'Alice Johnson', 'alice_j', NOW() - INTERVAL '90 days'),
  ('bob@example.com', 'Bob Smith', 'bob_smith', NOW() - INTERVAL '60 days'),
  ('carol@example.com', 'Carol White', 'carol_w', NOW() - INTERVAL '30 days');

-- Insert posts (referencing user IDs)
INSERT INTO posts (user_id, title, content, published, created_at)
SELECT 
  u.id,
  'Sample Post ' || generate_series,
  'This is sample content for post ' || generate_series,
  TRUE,
  NOW() - (generate_series || ' days')::INTERVAL
FROM users u, generate_series(1, 10);

-- Insert comments
INSERT INTO comments (post_id, user_id, content, created_at)
SELECT 
  p.id,
  u.id,
  'Sample comment ' || generate_series,
  p.created_at + (generate_series || ' hours')::INTERVAL
FROM posts p
CROSS JOIN users u
CROSS JOIN generate_series(1, 3)
WHERE random() < 0.5  -- Random subset of combinations
LIMIT 100;
```

### 4. Integration with Migrations

Add seeding to migration workflow:

```typescript
// Generate: scripts/migrate-and-seed.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function migrateAndSeed() {
  try {
    console.log('📊 Running migrations...');
    await execAsync('npm run migrate');
    console.log('✅ Migrations complete');

    if (process.env.SEED_DATABASE === 'true') {
      console.log('🌱 Running seeds...');
      await execAsync('npm run seed');
      console.log('✅ Seeding complete');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

migrateAndSeed();
```

### 5. Snapshot-Based Seeding

For complex scenarios, use database snapshots:

```bash
# Generate: scripts/create-snapshot.sh

#!/bin/bash
set -e

echo "📸 Creating database snapshot..."

# Export current database
pg_dump -U $DB_USER -d $DB_NAME \
  --data-only \
  --inserts \
  --no-owner \
  --no-privileges \
  > ./data/snapshots/seed-$(date +%Y%m%d-%H%M%S).sql

echo "✅ Snapshot created"
```

```bash
# Generate: scripts/restore-snapshot.sh

#!/bin/bash
set -e

SNAPSHOT=${1:-./data/snapshots/seed-latest.sql}

echo "📥 Restoring snapshot: $SNAPSHOT"

# Clear and restore
psql -U $DB_USER -d $DB_NAME -c "TRUNCATE TABLE users, posts, comments CASCADE"
psql -U $DB_USER -d $DB_NAME < $SNAPSHOT

echo "✅ Snapshot restored"
```

## Configuration Patterns

### Environment Variables

```bash
# .env
SEED_DATABASE=true
SEED_USERS=100
SEED_POSTS=500
SEED_COMMENTS=2000
SEED_DATA_PATH=./data/seed
```

### JSON Configuration

```json
// Generate: config/seed.json
{
  "models": {
    "users": {
      "count": 50,
      "attributes": {
        "email": "internet.email",
        "name": "person.fullName",
        "username": "internet.userName",
        "avatar": "image.avatar"
      }
    },
    "posts": {
      "count": 200,
      "attributes": {
        "user_id": "relation:users",
        "title": "lorem.sentence",
        "content": "lorem.paragraphs:3",
        "published": "datatype.boolean"
      }
    }
  }
}
```

## Advanced Features

### 1. Relationship Management

```typescript
// Handle complex relationships automatically
class RelationshipManager {
  private cache: Map<string, string[]> = new Map();

  async getRelatedIds(model: string, count?: number): Promise<string[]> {
    if (!this.cache.has(model)) {
      const ids = await this.fetchIds(model);
      this.cache.set(model, ids);
    }
    
    const ids = this.cache.get(model)!;
    return count 
      ? faker.helpers.arrayElements(ids, count)
      : [faker.helpers.arrayElement(ids)];
  }
}
```

### 2. Deterministic Seeds

```typescript
// Reproducible random data for testing
faker.seed(12345);  // Same seed = same data
```

### 3. Performance Optimization

```typescript
// Batch inserts for better performance
async function batchInsert(data: any[], tableName: string, pool: Pool) {
  const chunkSize = 1000;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const values = chunk.map((item, idx) => 
      `(${Object.values(item).map((_, j) => `$${idx * Object.keys(item).length + j + 1}`).join(', ')})`
    ).join(', ');
    
    const query = `INSERT INTO ${tableName} (${Object.keys(chunk[0]).join(', ')}) VALUES ${values}`;
    const flatValues = chunk.flatMap(item => Object.values(item));
    
    await pool.query(query, flatValues);
  }
}
```

## Package.json Scripts

Add these to package.json:

```json
{
  "scripts": {
    "seed": "ts-node scripts/seed.ts",
    "seed:reset": "npm run migrate:reset && npm run seed",
    "seed:snapshot": "./scripts/create-snapshot.sh",
    "seed:restore": "./scripts/restore-snapshot.sh"
  }
}
```

## Makefile Integration

```makefile
.PHONY: db-seed db-seed-reset seed-snapshot

db-seed: ## Seed database with test data
	@echo "🌱 Seeding database..."
	@docker-compose exec -T api npm run seed

db-seed-reset: db-reset db-seed ## Reset and seed database
	@echo "✅ Database reset and seeded"

seed-snapshot: ## Create database snapshot
	@docker-compose exec -T api ./scripts/create-snapshot.sh
```

## Best Practices

1. **Use Faker for realistic data** - Better than lorem ipsum
2. **Respect relationships** - Maintain referential integrity
3. **Make it fast** - Use batch inserts for large datasets
4. **Make it reproducible** - Use seed values for deterministic data
5. **Separate by environment** - Different data volumes for dev/test/staging
6. **Version snapshots** - Keep snapshots in git (if small) or artifact storage

## Integration with zero-to-running

When used together with zero-to-running skill:
1. Seeding runs automatically on first `make dev`
2. `make db-seed` available for manual seeding
3. Environment variables control seeding behavior
4. Snapshots stored in version control for consistency
