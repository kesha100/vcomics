# Use the official Node.js image as the base image
FROM node:18 AS build

RUN apt-get update && \
    apt-get install -y python3 python3-dev
# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the application
RUN npm run build

# Use a new stage to run the app
FROM node:18

# Set the working directory
WORKDIR /app

# Copy the build output from the build stage
COPY --from=build /app/dist ./dist

# Install only production dependencies
COPY package*.json ./
RUN npm install

# Expose the application port
EXPOSE 3000

# Define the command to run the application
CMD ["node", "dist/main.js"]
