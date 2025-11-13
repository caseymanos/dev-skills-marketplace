# Dockerfile Examples

Production-ready Dockerfiles for development environments with hot reload support.

## Backend API Dockerfile (Node.js/TypeScript)

### Production Dockerfile
```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built assets and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 8000

CMD ["node", "dist/server.js"]
```

### Development Dockerfile
```dockerfile
# backend/Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source (will be overridden by volume mount)
COPY . .

# Expose debug port
EXPOSE 8000 9229

# Run with nodemon for hot reload
CMD ["npm", "run", "dev"]
```

### package.json scripts
```json
{
  "scripts": {
    "dev": "nodemon --inspect=0.0.0.0:9229 -r ts-node/register src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

## Frontend Dockerfile (React/Vite)

### Production Dockerfile
```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image with nginx
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Development Dockerfile
```dockerfile
# frontend/Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source (will be overridden by volume mount)
COPY . .

EXPOSE 3000

# Run with Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### vite.config.ts
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    watch: {
      usePolling: true, // Enable for Docker
    },
    hmr: {
      host: 'localhost',
      port: 3000,
    },
  },
})
```

## Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - app-network

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "${API_PORT:-8000}:8000"
      - "9229:9229"  # Debug port
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://redis:6379
      PORT: 8000
      LOG_LEVEL: ${LOG_LEVEL:-debug}
    volumes:
      - ./backend:/app
      - /app/node_modules  # Prevent overwriting node_modules
      - ./backend/.env:/app/.env
    networks:
      - app-network
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "${FRONTEND_PORT:-3000}:3000"
    depends_on:
      - api
    environment:
      VITE_API_URL: http://localhost:${API_PORT:-8000}
      NODE_ENV: development
    volumes:
      - ./frontend:/app
      - /app/node_modules  # Prevent overwriting node_modules
    networks:
      - app-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
```

## .dockerignore Files

### Backend .dockerignore
```
node_modules
npm-debug.log
dist
.env
.env.*
!.env.example
*.log
.git
.gitignore
README.md
.vscode
.idea
coverage
.DS_Store
```

### Frontend .dockerignore
```
node_modules
npm-debug.log
dist
build
.env
.env.*
!.env.example
*.log
.git
.gitignore
README.md
.vscode
.idea
coverage
.DS_Store
```

## Nginx Configuration for Production

```nginx
# frontend/nginx.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy (if needed)
    location /api {
        proxy_pass http://api:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
