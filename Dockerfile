# Stage 1: Build mã nguồn
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Cài đặt dependencies (dùng --legacy-peer-deps cho NestJS 12)
RUN npm install --legacy-peer-deps

# Copy toàn bộ mã nguồn
COPY . .

# Build dự án sang thư mục dist
RUN npm run build

# Gỡ bỏ các thư viện devDependencies để tối ưu dung lượng
RUN npm prune --omit=dev --legacy-peer-deps

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Chạy với user node (non-root) để bảo mật
USER node

# Copy các file cần thiết từ stage builder
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
