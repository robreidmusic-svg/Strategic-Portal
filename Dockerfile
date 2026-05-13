FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Build the frontend
RUN npm run build

# Expose the port Cloud Run expects
EXPOSE 8080

# Start the server
CMD ["npm", "start"]
