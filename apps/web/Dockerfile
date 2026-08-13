# Image cho @vpp/web: build SPA rồi phục vụ bằng nginx.
# Build từ GỐC repo (cần lockfile + packages/shared):
#   docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS builder
WORKDIR /app
ENV HUSKY=0
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY deploy/mock-idp/package.json deploy/mock-idp/
RUN pnpm install --frozen-lockfile

COPY . .
# Web bundle @vpp/shared từ mã nguồn nên không cần build shared trước.
RUN pnpm --filter @vpp/web build

FROM nginx:1.27-alpine AS runner
ENV TZ=Asia/Ho_Chi_Minh
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
