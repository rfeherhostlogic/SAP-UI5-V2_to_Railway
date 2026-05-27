FROM node:20-bookworm

WORKDIR /app/myChatbot

# Python is used by deterministic analytics runners in the backend.
# LibreOffice is used for DOCX -> PDF preview conversion.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 libreoffice-writer \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first for better layer caching
COPY myChatbot/package*.json ./
RUN npm ci --legacy-peer-deps

# Copy application source and build UI5 production assets
COPY myChatbot/ ./
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
