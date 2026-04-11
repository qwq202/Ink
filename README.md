# AI 图片工具

一个基于 Next.js 15 和 React 19 构建的多供应商 AI 图片生成与编辑界面。项目内置 FAL、OpenAI Images 以及可自定义的 NewAPI 渠道，提供批量上传、参数化生成、结果预览、历史存档等端到端功能，适合快速搭建内部图片生产或创意工具。

## 功能特性
- 多供应商支持：在同一界面切换 FAL、OpenAI 与自建 NewAPI 服务，灵活配置鉴权信息。
- 双模式工作流：支持文本生图（txt2img）与图片驱动的编辑/增强（img2img），按需切换。
- 完整的生成参数：自定义提示词、尺寸、数量、随机种子、安全校验、同步策略，以及 FAL 模型列表实时拉取。
- 便捷的图片上传体验：拖拽或点击上传，自动校验格式与大小，客户端压缩到最大边 2048 像素，最多保留 4 张图片。
- 结果与历史管理：最新结果即时预览、放大、下载，IndexedDB 自动保存最近 20 条历史记录，可清空或单独删除。
- 队列与进度反馈：内置任务队列限制并发生成次数，实时展示运行与排队状态。
- 本地安全存储：供应商密钥使用浏览器 `crypto.subtle` AES-GCM 加密后写入 localStorage，跨标签页自动同步。
- 诊断日志：所有关键请求会发送到 `/api/log` 记录服务端日志，便于排查错误。

## 技术栈
- Next.js 15（App Router）与 React 19
- TypeScript、Tailwind CSS 4、shadcn/ui 组件体系
- Radix UI、Lucide 图标、react-hook-form、zod 校验
- IndexedDB（浏览器端历史记录）、localStorage（加密供应商配置）
- Vercel Analytics 与 API 路由

## 快速开始

### 环境要求
- Node.js 18.18.0 以上（Next.js 15 官方要求）
- pnpm 9 或兼容包管理器（仓库包含 `pnpm-lock.yaml`，推荐使用 pnpm）

### 安装依赖
```bash
pnpm install
```
如需使用 npm 或 yarn，请先删除 `pnpm-lock.yaml` 并重新生成锁定文件。

### 本地开发
```bash
pnpm dev
```
默认监听 `http://localhost:3000`。首次访问需在页面右上角打开“设置”对话框，填写并启用至少一个供应商的 API 信息。

### 生产构建与部署
```bash
pnpm build
pnpm start
```
构建产物位于 `.next/`。也可直接部署到 Vercel 或任何支持 Next.js 的平台，确保为无服务器函数启用外部网络访问，以便调用第三方模型服务。

## 供应商配置
所有配置均从页面右上角的“设置”对话框管理，并保存在本地浏览器：

### FAL
- `API Key`：FAL 平台生成的密钥。
- `模型`：在生成表单中按 `model_id` 选择，不再手动配置队列端点。
- `调用方式`：前端统一通过 `@fal-ai/client` 和 `/api/fal/proxy` 服务端代理访问 FAL。
- `启用`：开启后即加入可选供应商列表。

### OpenAI Images
- `API Key`：OpenAI 账号的 API 密钥。
- `API 端点`：默认 `https://api.openai.com/v1/images/generations`，如需兼容代理可进行替换。
- `启用`：勾选后可在生成表单中选择 OpenAI。

### NewAPI
- `API Key` 或 `用户 Token`：根据服务端要求填写，表单会同时支持 `Authorization` 与 `New-Api-User` 头。
- `API 端点`：需要指向 `.../images/generations`，可选填 `编辑端点` 用于图片编辑任务。
- `User ID`：部分服务需要额外的用户标识。
- “获取模型列表”按钮会访问 `{baseOrigin}/api/models`，拉取渠道信息并通过通知提示数量。

### 存储与安全
- 所有供应商配置写入浏览器 localStorage，写入前使用 AES-GCM 加密并缓存密钥。
- 多标签页间会通过 `storage` 事件保持同步。
- 若需要重置，可在浏览器开发者工具中清除 `ai-image-tool-providers` 项。

## 使用指南

### 模式切换
- “图片编辑”模式需要先上传图片，可选填提示词；系统会把图片数据转换为 Data URL 提交到供应商。
- “文本生图”模式不需要图片，直接提供提示词即可。

### 上传与处理图片
- 拖拽或点击上传，支持 PNG/JPG/WEBP，单文件最大 10 MB。
- 客户端自动压缩至最大边 2048 像素，保证兼容性并减少上传体积。
- 可随时清空已选图片，缩略图角标显示顺序与尺寸。

### 生成参数
- FAL 文生/图像编辑的 `image_size` 仅支持枚举值或 `{ width, height }` 对象，不再接收任意字符串；推荐的枚举有 `square`、`landscape_4_3`（默认）、`landscape_16_9`、`portrait_4_3`、`portrait_16_9`，图片编辑模式额外提供“与原图相同”选项。如需自定义尺寸，可传入 `{"width": 1280, "height": 720}` 等 JSON 对象，宽高需为正整数。
- 支持设置输出数量、随机种子、安全校验开关、同步模式。
- 当供应商为 FAL 时，可从最新模型列表中选择具体模型 ID。

### 结果与下载
- 最新任务的图片结果集中展示，可点击放大或一键下载。
- 未返回图片时，界面会提示相应状态或错误。

### 队列与历史记录
- 顶部状态栏实时展示排队与运行中的任务数量。
- 历史记录保存在 IndexedDB，只保留最近 20 条，可查看详情、清空或删除单条记录。

## 本地存储与日志
- 供应商配置：localStorage，键名 `ai-image-tool-providers`，内容加密。
- 历史记录：IndexedDB `ai-image-tool` 数据库的 `history` 表，按时间倒序读取。
- 日志上报：客户端通过 `lib/logger.ts` 调用 `/api/log`，服务端会写入控制台（info/warn/error）。

## 内置 API
- `GET /api/fal/models`：代理调用 fal.ai 模型接口，按分类抓取并缓存 1 小时，可使用 `?category=` 和 `?search=` 查询。
- `GET/POST/PUT /api/fal/proxy`：基于 `@fal-ai/server-proxy` 的官方代理路由，供 FAL SDK 调用。
- `POST /api/log`：接收客户端日志并写入服务器 stdout，便于部署环境调试。

## 项目结构
```
app/                # Next.js App Router 页面与 API 路由
components/         # UI 组件、生成表单、历史记录、设置对话框等
hooks/              # 自定义 Hooks，如生成流程、供应商配置、任务队列
lib/                # API 客户端、队列、加密存储、IndexedDB 操作
public/             # 静态资源
styles/             # 全局样式与 Tailwind 定制
```

## 常见问题
- **生成卡住或无响应**：检查供应商是否启用、密钥是否填写正确，以及浏览器控制台是否存在跨域或网络错误。
- **FAL 生成失败或无结果**：检查 FAL API Key、所选 `model_id` 是否有效，以及图片输入是否符合该模型能力要求。
- **历史记录丢失**：IndexedDB 升级或清理缓存会清空历史，请及时导出需要的图片。
- **NewAPI 拉取模型失败**：确认端点返回 JSON 且包含 `success` 字段，必要时检查鉴权头是否符合服务端要求。

## 许可
仓库未明确声明许可证，若需对外发布或商用，请先与仓库所有者确认。
