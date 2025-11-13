-- Generic SQL seeding script
-- Adjust table names and columns for your schema

-- Clear existing data
TRUNCATE users, posts, comments CASCADE;

-- Insert sample users
INSERT INTO users (email, name, username, bio, created_at) VALUES
  ('alice@example.com', 'Alice Johnson', 'alice_j', 'Software engineer passionate about clean code', NOW() - INTERVAL '180 days'),
  ('bob@example.com', 'Bob Smith', 'bob_smith', 'Product manager and tech enthusiast', NOW() - INTERVAL '150 days'),
  ('carol@example.com', 'Carol White', 'carol_w', 'Designer focused on user experience', NOW() - INTERVAL '120 days'),
  ('david@example.com', 'David Brown', 'dave_b', 'DevOps engineer automating all the things', NOW() - INTERVAL '90 days'),
  ('emma@example.com', 'Emma Davis', 'emma_d', 'Data scientist exploring ML', NOW() - INTERVAL '60 days'),
  ('frank@example.com', 'Frank Wilson', 'frank_w', 'Security researcher', NOW() - INTERVAL '30 days');

-- Insert sample posts (10 per user)
INSERT INTO posts (user_id, title, content, published, created_at)
SELECT 
  u.id,
  'Sample Post ' || generate_series || ' by ' || u.username,
  'This is sample content for post ' || generate_series || '. ' ||
  'It contains multiple paragraphs of text to simulate real blog posts. ' ||
  'The content is generated automatically for testing purposes.',
  CASE WHEN random() < 0.7 THEN TRUE ELSE FALSE END,  -- 70% published
  u.created_at + (generate_series || ' days')::INTERVAL
FROM users u, generate_series(1, 10);

-- Insert sample comments (3-5 per post)
INSERT INTO comments (post_id, user_id, content, created_at)
SELECT 
  p.id,
  u.id,
  'This is a comment from ' || u.username || ' on post ' || p.id,
  p.created_at + (RANDOM() * 30 || ' days')::INTERVAL
FROM posts p
CROSS JOIN users u
WHERE random() < 0.3  -- Random subset
LIMIT 500;

-- Display summary
SELECT 
  'users' as table_name,
  COUNT(*) as row_count
FROM users
UNION ALL
SELECT 
  'posts' as table_name,
  COUNT(*) as row_count
FROM posts
UNION ALL
SELECT 
  'comments' as table_name,
  COUNT(*) as row_count
FROM comments;
