# Image cho @vpp/api. Build từ GỐC repo (cần lockfile + packages/shared):
#   docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS builder
WORKDIR /app
ENV HUSKY=0
RUN corepack enable

# Cài dependency trước, tách khỏi mã nguồn để tận dụng cache layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY deploy/mock-idp/package.json deploy/mock-idp/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @vpp/shared build && pnpm --filter @vpp/api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Asia/Ho_Chi_Minh
RUN corepack enable

# Giữ nguyên cây thư mục workspace: symlink của pnpm và đường dẫn tương đối
# tới thư mục `drizzle/` (migrate.js tìm ../../../drizzle) đều phụ thuộc bố cục này.
COPY --from=builder /app /app

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
