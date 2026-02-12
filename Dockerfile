# Use official Node.js LTS image
FROM node:24-slim

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install && npm cache clean --force;

# Copy UI and install UI dependencies
COPY ui ./ui
RUN cd ui && npm install --production && cd ..

# Copy source code
COPY . ./

# Build TypeScript
RUN npm run build

# Set environment variables (override as needed)
ENV NODE_ENV=production

# Expose UI port
EXPOSE 3000

# Start the UI server by default (Hono)
CMD ["node", "ui/server.mjs"]
