FROM node:20-alpine

WORKDIR /app

# Add OpenSSL — required by Prisma
RUN apk add --no-cache openssl openssl-dev

COPY package*.json ./
RUN npm install

COPY . .

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
