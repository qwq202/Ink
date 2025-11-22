# 仓库指南

面向 Next.js 15 + React 19 AI 图像工具贡献者的简明说明。

## 项目结构与模块组织
- `app/`：App Router 页面与 API 路由（OpenRouter 模型代理、日志）。
- `components/`：功能 UI；`components/ui/` 存放 shadcn 原子组件，优先组合使用。
- `hooks/`：上传、供应商设置、队列、模型获取等客户端钩子。
- `lib/`：API 客户端、IndexedDB 存储、加密的供应商存储、队列工具；新增辅助功能优先放这里。
- `public/`：静态资源；`styles/` 和 `app/globals.css` 携带 Tailwind v4 主题变量。
- 路径别名 `@/*` 指向仓库根目录；导入时优先使用。

## 构建、测试与开发命令
```bash
pnpm install
pnpm dev
pnpm lint
pnpm build && pnpm start
```
使用 Node 18.18+；`pnpm-lock.yaml` 为权威锁文件。

## 代码风格与命名规范
- 严格 TypeScript；首选带类型的函数组件。
- 默认 server component；仅在需要状态/副作用时加 `"use client"`。
- Tailwind v4 工具类 + `globals.css` 主题变量；保持赛博/工业风，避免随意内联样式。
- 组件 PascalCase，hooks 采用 `use-*.ts`，工具函数用 camelCase 导出；导入优先走 `@/...`。
- UI 文案用简体中文，保持简洁一致。

## 测试指南
- 暂无自动化套件；提交前跑 `pnpm lint`，并手动在 txt2img / img2img 做冒烟（上传限制、历史、下载）。
- 若新增测试：`*.spec.ts` 放在 `__tests__/` 或模块旁；hooks 选 Vitest，端到端选 Playwright。
- 修复队列/供应商逻辑时优先加回归覆盖。

## 提交与 PR 指南
- 使用 Conventional Commits（`feat: ...`、`fix: ...`、`chore: ...`）。
- PR 需包含：变更摘要、关联 issue（如有）、UI 变更截图/GIF、手动测试说明，以及 lint/build 通过证明。
- 保持 diff 聚焦；若有 API 或 schema 变更请在描述中强调。
- 默认远程仓库：`https://github.com/qwq202/ai-image`。推送前请确认指向该远程。
- 若与远程存在冲突，一律以本地版本为准解决。
- 每次修改后都需执行 `git add` + `git commit`（Conventional Commits），便于管理和回退。
- 推送前必须跑完整构建/测试（至少 `pnpm lint` 与 `pnpm build`），确保无警告或错误后再提交到远程。

## 安全与配置提示
- 不要提交密钥；`.env*` 已忽略。将 `OPENROUTER_REFERER` 与 `OPENROUTER_TITLE` 放入 `.env.local`。
- 供应商密钥仅客户端加密存储；不要记录密钥或提示/图像内容。
- API 路由请遵循 `lib/logger.ts` 的模式，避免过宽的 CORS/headers。
