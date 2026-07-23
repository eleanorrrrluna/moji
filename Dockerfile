# =============================================================================
# Moji 生产镜像 —— 一个盒子里同时装前端和后端
# 多阶段构建（multi-stage）：分几个阶段做不同的事，最终镜像只保留必要的东西。
# =============================================================================

# ---- 阶段 1：编译前端 ----
# 用完整的 Node 镜像装依赖 + 跑 vite build，产出一堆静态 html/js/css 文件。
FROM node:20-slim AS client-build
WORKDIR /build/client
# 先只拷 package 文件、装依赖 —— 这样只要依赖没变，重复构建会命中缓存、飞快
COPY client/package*.json ./
RUN npm ci
# 再拷源码、编译
COPY client/ ./
RUN npm run build
# 产物落在 /build/client/dist（一堆静态文件）


# ---- 阶段 2：装后端生产依赖 ----
# better-sqlite3 是 C++ 原生模块，装的时候需要编译工具（python/make/g++）。
# 我们只在这个中间阶段装编译工具，最终镜像里不带这些，保持苗条。
FROM node:20-slim AS server-deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /build/server
COPY server/package*.json ./
# --omit=dev = 不装开发依赖，生产镜像更干净小巧
RUN npm ci --omit=dev


# ---- 阶段 3：最终运行镜像 ----
# 干净的 Node 镜像，没有编译工具、没有前端源码，只留跑起来必需的东西。
FROM node:20-slim
WORKDIR /app

# 从阶段 1 把编译好的前端静态文件搬过来
# 路径保持 client/dist 是为了配合 server/src/index.js 里那句 express.static(path.join(__dirname, '..', '..', 'client', 'dist'))
COPY --from=client-build /build/client/dist ./client/dist

# 从阶段 2 把已经编译好的 node_modules 搬过来（含编译好的 better-sqlite3）
COPY --from=server-deps /build/server/node_modules ./server/node_modules

# 后端源码（很小，直接拷）
COPY server/package.json ./server/package.json
COPY server/src ./server/src

# 环境标记：告诉 Express / Node 现在是生产环境
ENV NODE_ENV=production
# 后端端口。ANTHROPIC_API_KEY 和 MOJI_LLM 会在运行时由 docker compose 注入，绝不写在这里
ENV MOJI_SERVER_PORT=3611

# 告诉 docker 这个容器暴露 3611 端口
EXPOSE 3611

# 切到 server 目录，用 node 直接启动（不走 npm 脚本，因为 npm start 里的 --env-file 只用于本机 dev）
WORKDIR /app/server
CMD ["node", "src/index.js"]
