FROM node:20-bookworm

WORKDIR /app/myChatbot

# Install dependencies first for better layer caching
COPY myChatbot/package*.json ./
RUN npm ci

# Copy application source and build UI5 production assets
COPY myChatbot/ ./
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
