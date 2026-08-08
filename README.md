# 心屿（Island）

心屿是面向中国大陆用户的线上 AI 娱乐陪伴 Web 产品。

当前仓库从零构建正式产品实现。需求、架构、数据模型、API 契约和参考分析位于 `docs/`。

## 开发环境

- Node.js 22+
- npm 11+
- Docker Desktop
- PostgreSQL 16（推荐使用 Docker Compose）

## 初始化

```bash
npm install
copy .env.example .env
npm run typecheck
npm run test
npm run build
```

## 启动

```bash
docker compose up -d postgres
npm run dev
```

阶段 0 只提供工程骨架、健康检查、配置校验和 Provider 接口，不代表业务功能已经完成。
