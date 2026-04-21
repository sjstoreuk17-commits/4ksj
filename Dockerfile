# Use Node.js as base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Build the frontend
RUN npm run build

# Expose port (HF Spaces defaults to 7860, AI Studio uses 3000)
ENV PORT=7860
EXPOSE 7860

# Start the server
CMD ["npm", "start"]
