# ---- build ----
FROM node:24.22.1-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:24.22.1-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
# dist đã kèm migrations/*.sql (nest-cli assets)
COPY --from=builder /app/dist ./dist
# Seed chạy được trên prod: docker compose exec api node scripts/seed-catalog.mjs
COPY scripts ./scripts
COPY seed ./seed
# Volume mới kế thừa owner của mount point → phải là node để ghi ảnh
RUN mkdir -p /data/files && chown node:node /data/files
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
