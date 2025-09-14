FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
# use install instead of ci
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
ENV PORT=8080
COPY --from=builder /app ./
# run migrations on start (optional but handy) ugh
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
