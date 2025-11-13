#!/usr/bin/env ts-node

import { Pool } from 'pg';
import { SeedFactory } from './seed-factory';

async function main() {
  // Create connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://dev_user:dev_password@localhost:5432/dev_db',
  });

  try {
    const factory = new SeedFactory(pool);
    
    // Read config from environment or use defaults
    const config = {
      users: parseInt(process.env.SEED_USERS || '50'),
      posts: parseInt(process.env.SEED_POSTS || '200'),
      comments: parseInt(process.env.SEED_COMMENTS || '500'),
      seed: process.env.SEED_DETERMINISTIC 
        ? parseInt(process.env.SEED_DETERMINISTIC) 
        : undefined,
    };

    const results = await factory.seed(config);
    
    console.log('\n📊 Summary:');
    console.log(`   Users:    ${results.users}`);
    console.log(`   Posts:    ${results.posts}`);
    console.log(`   Comments: ${results.comments}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main };
