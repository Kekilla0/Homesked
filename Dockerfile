FROM node:20-alpine

WORKDIR /app

# Install build tools needed for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Data volume mount point
RUN mkdir -p /data

EXPOSE 3000

ENV NODE_ENV=production
ENV DB_PATH=/data/homesked.db

CMD ["node", "server.js"]
