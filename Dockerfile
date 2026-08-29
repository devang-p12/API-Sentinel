# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies for both frontend and backend
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY server/package.json server/

RUN npm install

# Copy source files
COPY . .

# Build frontend and server
RUN npm run build --workspace=frontend
RUN npm run build --workspace=server

# Production stage
FROM node:20-alpine

# Install k6
RUN apk add --no-cache curl \
    && curl -L https://github.com/grafana/k6/releases/download/v0.53.0/k6-v0.53.0-linux-amd64.tar.gz | tar xz -C /usr/local/bin --strip-components=1 \
    && chmod +x /usr/local/bin/k6

WORKDIR /app

# Copy built assets and dependencies
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./server/

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Start the proxy server (assuming compiled entry is server/dist/server.js)
CMD ["node", "server/dist/server.js"]
