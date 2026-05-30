FROM node:20-alpine

WORKDIR /app

# Add OpenSSL — required by Prisma
RUN apk add --no-cache openssl openssl-dev

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
