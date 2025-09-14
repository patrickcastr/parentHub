# syntax=docker/dockerfile:1

# --- deps stage ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

# --- build stage ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# If you transpile TS:
#   npm run build should output to dist/
RUN npm run build

# --- runtime ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
# copy built app + node_modules + prisma schema
COPY --from=builder /app ./
EXPOSE 8080
# adjust path if your entry is different
CMD ["node", "dist/index.js"]
