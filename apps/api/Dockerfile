# Build Stage
FROM node:18 AS build

# Install Python and required build tools
RUN apt-get update && apt-get install -y python3 python3-dev python3-pip build-essential

WORKDIR /app

# Copy the entire project
COPY . .

# Navigate to the api directory (adjust if necessary)
WORKDIR /app/apps/api

# Install dependencies
RUN npm i

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production Stage
FROM node:18-slim

# Install Redis and other necessary tools
RUN apt-get update && apt-get install -y redis-server curl

WORKDIR /app

# Copy built assets from the build stage
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/package*.json ./

# Copy Prisma files
COPY --from=build /app/apps/api/prisma ./prisma

# Copy the entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 3000

# Use the entrypoint script to start the application
ENTRYPOINT ["/entrypoint.sh"]