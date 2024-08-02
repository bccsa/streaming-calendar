# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

ARG NODE_VERSION=20.11.1

FROM node:${NODE_VERSION}-alpine

# Use production node environment by default.
ENV NODE_ENV=production

WORKDIR /app

# Copy the source files
COPY . .

# Download dependencies as a separate step to take advantage of Docker's caching.
RUN cd ./api/src; npm ci --omit=dev

# Run the application as a non-root user.
USER node

# Expose the port that the application listens on.
EXPOSE 3000


# Run the application.
CMD ["node", "./api/src/index.js"]