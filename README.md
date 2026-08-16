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

## 测试

```bash
npm test
```

## 发布 Tag

与运营后台 `daone-admin` 对齐：在**提交并推送稳定修复后**为当前 HEAD 打附注 tag：

```bash
git tag -a "release-2026.08.16" -m "Daone web release 2026-08-16"
git push origin "release-2026.08.16"
```

可用 `git describe --tags --exact-match` 确认 HEAD 是否已有对应 tag。

## 预览

```bash
npm run preview
# 或
npm run start
```
