import { faker } from '@faker-js/faker';
import { Pool } from 'pg';

export interface SeedConfig {
  users?: number;
  posts?: number;
  comments?: number;
  seed?: number;  // For deterministic data
}

export interface ModelConfig {
  [key: string]: {
    count: number;
    generator: (deps?: any) => any;
  };
}

export class SeedFactory {
  constructor(private pool: Pool, private config: SeedConfig = {}) {
    // Set deterministic seed if provided
    if (config.seed) {
      faker.seed(config.seed);
    }
  }

  /**
   * Generate realistic users
   */
  async generateUsers(count: number) {
    const users = [];
    const usedEmails = new Set<string>();
    
    for (let i = 0; i < count; i++) {
      let email = faker.internet.email();
      
      // Ensure unique emails
      while (usedEmails.has(email)) {
        email = faker.internet.email();
      }
      usedEmails.add(email);
      
      users.push({
        email,
        name: faker.person.fullName(),
        username: faker.internet.userName(),
        avatar: faker.image.avatar(),
        bio: faker.lorem.paragraph(),
        location: faker.location.city(),
        website: faker.internet.url(),
        created_at: faker.date.past({ years: 2 }),
        updated_at: new Date(),
      });
    }
    return users;
  }

  /**
   * Generate posts with realistic content
   */
  async generatePosts(userIds: string[], count: number) {
    const posts = [];
    
    for (let i = 0; i < count; i++) {
      const createdAt = faker.date.past({ years: 1 });
      const published = faker.datatype.boolean({ probability: 0.7 });
      
      posts.push({
        user_id: faker.helpers.arrayElement(userIds),
        title: faker.lorem.sentence({ min: 3, max: 10 }),
        slug: faker.helpers.slugify(faker.lorem.words(5)),
        content: faker.lorem.paragraphs(faker.number.int({ min: 2, max: 8 })),
        excerpt: faker.lorem.paragraph(),
        published,
        published_at: published ? createdAt : null,
        view_count: faker.number.int({ min: 0, max: 10000 }),
        like_count: faker.number.int({ min: 0, max: 500 }),
        created_at: createdAt,
        updated_at: faker.date.between({ from: createdAt, to: new Date() }),
      });
    }
    return posts;
  }

  /**
   * Generate comments on posts
   */
  async generateComments(userIds: string[], postIds: string[], count: number) {
    const comments = [];
    
    for (let i = 0; i < count; i++) {
      const postId = faker.helpers.arrayElement(postIds);
      const createdAt = faker.date.recent({ days: 30 });
      
      comments.push({
        post_id: postId,
        user_id: faker.helpers.arrayElement(userIds),
        parent_id: faker.datatype.boolean({ probability: 0.2 }) 
          ? faker.helpers.arrayElement(comments.filter(c => c.post_id === postId).map(c => c.id))
          : null,
        content: faker.lorem.paragraph(),
        created_at: createdAt,
        updated_at: createdAt,
      });
    }
    return comments;
  }

  /**
   * Batch insert for better performance
   */
  private async batchInsert(
    tableName: string,
    data: any[],
    batchSize: number = 500
  ): Promise<string[]> {
    const ids: string[] = [];
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const keys = Object.keys(batch[0]);
      
      // Build VALUES clause
      const valueClauses = batch.map((_, idx) => {
        const params = keys.map((_, keyIdx) => `$${idx * keys.length + keyIdx + 1}`);
        return `(${params.join(', ')})`;
      });
      
      // Flatten all values
      const values = batch.flatMap(item => keys.map(key => item[key]));
      
      const query = `
        INSERT INTO ${tableName} (${keys.join(', ')})
        VALUES ${valueClauses.join(', ')}
        RETURNING id
      `;
      
      const result = await this.pool.query(query, values);
      ids.push(...result.rows.map(row => row.id));
    }
    
    return ids;
  }

  /**
   * Clear all data from tables
   */
  async clear() {
    console.log('🗑️  Clearing existing data...');
    await this.pool.query('TRUNCATE users, posts, comments CASCADE');
    console.log('✅ Data cleared');
  }

  /**
   * Main seed function
   */
  async seed(config: SeedConfig = {}) {
    const finalConfig = { ...this.config, ...config };
    const userCount = finalConfig.users || 50;
    const postCount = finalConfig.posts || 200;
    const commentCount = finalConfig.comments || 500;

    console.log('🌱 Starting database seeding...');
    console.log(`   Users: ${userCount}`);
    console.log(`   Posts: ${postCount}`);
    console.log(`   Comments: ${commentCount}`);
    console.log('');

    try {
      // Clear existing data
      await this.clear();

      // Generate and insert users
      console.log('👥 Creating users...');
      const users = await this.generateUsers(userCount);
      const userIds = await this.batchInsert('users', users);
      console.log(`✅ Created ${userIds.length} users`);

      // Generate and insert posts
      console.log('📝 Creating posts...');
      const posts = await this.generatePosts(userIds, postCount);
      const postIds = await this.batchInsert('posts', posts);
      console.log(`✅ Created ${postIds.length} posts`);

      // Generate and insert comments
      console.log('💬 Creating comments...');
      const comments = await this.generateComments(userIds, postIds, commentCount);
      const commentIds = await this.batchInsert('comments', comments);
      console.log(`✅ Created ${commentIds.length} comments`);

      console.log('');
      console.log('🎉 Seeding complete!');
      
      return {
        users: userIds.length,
        posts: postIds.length,
        comments: commentIds.length,
      };
    } catch (error) {
      console.error('❌ Seeding failed:', error);
      throw error;
    }
  }

  /**
   * Seed with custom model configuration
   */
  async seedCustom(models: ModelConfig) {
    console.log('🌱 Starting custom seeding...');
    const results: Record<string, number> = {};

    for (const [modelName, config] of Object.entries(models)) {
      console.log(`📦 Creating ${modelName}...`);
      const data = Array.from({ length: config.count }, () => config.generator());
      const ids = await this.batchInsert(modelName, data);
      results[modelName] = ids.length;
      console.log(`✅ Created ${ids.length} ${modelName}`);
    }

    console.log('🎉 Custom seeding complete!');
    return results;
  }
}
