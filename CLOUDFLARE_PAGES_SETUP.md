# Cloudflare Pages 部署設置指南

## 問題說明

如果遇到錯誤：`It looks like you've run a Workers-specific command in a Pages project`

這是因為 Cloudflare Pages 自動部署時執行了錯誤的命令。

## 解決方法

### 在 Cloudflare Dashboard 中設置：

1. 前往 Cloudflare Dashboard → Pages → 你的項目
2. 點擊 **Settings** → **Builds & deployments**
3. 找到 **Build configuration** 部分
4. 設置以下內容：
   - **Build command**: 留空（不填寫任何內容）
   - **Build output directory**: `.` （或留空）
   - **Root directory**: `/` （或留空）

### 或者使用環境變數：

在 Cloudflare Pages 設置中，添加環境變數：
- `NODE_VERSION`: `18` （可選）

## 重要提示

- 這是 **Cloudflare Pages** 項目，不是 Workers 項目
- 不需要執行 `wrangler deploy`
- Pages 會自動識別 `functions/` 目錄中的 Functions
- 靜態文件（如 `index.html`）會自動從根目錄提供

## 驗證部署

部署成功後，你的網站應該可以通過以下 URL 訪問：
- `https://your-project-name.pages.dev`

API endpoints 會自動在以下路徑可用：
- `https://your-project-name.pages.dev/api/query`
- `https://your-project-name.pages.dev/api/seed`
- 等等...
