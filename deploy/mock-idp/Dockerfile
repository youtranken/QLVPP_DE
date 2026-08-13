# Image cho @vpp/mock-idp (IdP giả — CHỈ demo). Build từ GỐC repo:
#   docker build -f deploy/mock-idp/Dockerfile .
FROM node:22-alpine
WORKDIR /app
ENV HUSKY=0
ENV TZ=Asia/Ho_Chi_Minh
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY deploy/mock-idp/package.json deploy/mock-idp/
RUN pnpm install --frozen-lockfile

COPY deploy/mock-idp deploy/mock-idp

# Chạy thẳng TypeScript bằng tsx — mock-idp không có decorator nên không vướng
# hạn chế emitDecoratorMetadata của esbuild (khác @vpp/api, phải build bằng tsc).
WORKDIR /app/deploy/mock-idp
EXPOSE 9000
CMD ["pnpm", "start"]
