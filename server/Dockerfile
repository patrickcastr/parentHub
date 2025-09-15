FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Cloud Run injects $PORT (defaults to 8080)
ENV PORT=8080
COPY --from=builder /app ./

# Document container port (not strictly required, but recommended)
EXPOSE 8080

# Start app + run migrations
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]