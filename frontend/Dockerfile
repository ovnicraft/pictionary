# Stage 1: Build the application
FROM node:20-slim AS build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm install


EXPOSE 5173

# Start Nginx
CMD ["npm", "run", "dev"] 