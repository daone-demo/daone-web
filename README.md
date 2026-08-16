# Daone Web

Daone 用户端前端（Vue 3 + TypeScript + Vite）。

## 开发

```bash
npm install
npm run dev
```

开发默认 `VITE_API_BASE_URL=/api/api/v1`，由 Vite 把 `/api` 代理到 `VITE_API_BASE_HOST`。

## 构建

```bash
npm run build        # 默认
npm run build:dev    # development
npm run build:test   # test
npm run build:prod   # production（会校验产物中写入了绝对 API 基址）
```

生产使用 `.env.production` 的绝对地址 `VITE_API_BASE_URL`（浏览器直连后端），不依赖站点 Nginx/Vercel 的 `/api` 反代。若改回相对前缀，需同步配置反代。

## 预览

```bash
npm run preview
# 或
npm run start
```
