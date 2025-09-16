# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Copy only manifests first for better layer caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the frontend (exclude via .dockerignore)
COPY . .

# Build-time API base URL for Vite (reads VITE_* at build)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build the static site (outputs /dist)
RUN npm run build

# ---- Runtime (Nginx) ----
FROM nginx:alpine

# Cloud Run uses 8080; make Nginx listen on 8080
RUN sed -i 's/listen       80;/listen 8080;/g' /etc/nginx/conf.d/default.conf

# SPA fallback + caching for static assets
RUN printf 'server {\n\
  listen 8080;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri /index.html;\n\
  }\n\
  location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {\n\
    expires 30d;\n\
    add_header Cache-Control "public, max-age=2592000, immutable";\n\
    try_files $uri /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx","-g","daemon off;"]
