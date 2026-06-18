FROM node:20-bookworm

WORKDIR /app/myChatbot

# Python is used by deterministic analytics runners in the backend.
# LibreOffice (headless, via soffice) is used for DOCX -> PDF conversion
# in the Arajanlat keszito (Quote Builder) module. libreoffice-writer
# pulls in libreoffice-core, which provides the soffice binary; fonts
# are added so generated PDFs render templates consistently.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3 \
       libreoffice-writer \
       libreoffice-core \
       fonts-liberation \
       fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/* \
  && which soffice

# Headless LibreOffice needs a writable profile/config directory; the
# default $HOME may not exist or be writable in all runtime platforms
# (e.g. App Runner / ECS), so pin it to a directory that always is.
ENV HOME=/tmp

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
