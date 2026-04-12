# 仓库领域化重组设计

日期：2026-04-12

## 目标

把当前以 `components/`、`hooks/`、`lib/` 顶层平铺为主的结构，重组为“领域 + 职责”混合分层：

- `app/` 保持 Next.js 路由入口职责不变
- 供应商能力按领域归档到 `domains/<provider>/`
- 跨供应商的生成、设置、历史等能力进入对应领域目录
- 纯通用能力进入 `shared/`

这次不是单纯搬文件，还会顺手修正以下结构问题：

- OpenAI / NewAPI 规则在多个目录散落
- 表单与 provider 参数装配关系过深
- 设置、历史、生成流程的代码边界不够清晰
- 公共工具和供应商工具混放

## 目标结构

### 顶层原则

- `app/`：仅保留页面入口和 API route 外壳
- `domains/`：业务领域代码
- `shared/`：跨领域通用 UI、工具、类型

### 计划目录

```text
domains/
  generation/
    components/
    hooks/
    lib/
  history/
    hooks/
    lib/
  settings/
    components/
    hooks/
    lib/
  openai/
    components/
    lib/
  newapi/
    components/
    hooks/
    lib/
  fal/
    hooks/
    lib/
  gemini/
    hooks/
  openrouter/
    hooks/

shared/
  ui/
  lib/
  types/
```

## 迁移映射

### OpenAI

- `components/openai/openai-settings-section.tsx` -> `domains/openai/components/openai-settings-section.tsx`
- `lib/openai-*` -> `domains/openai/lib/*`

### NewAPI

- `components/newapi/newapi-settings-section.tsx` -> `domains/newapi/components/newapi-settings-section.tsx`
- `hooks/use-newapi-models.ts` -> `domains/newapi/hooks/use-newapi-models.ts`
- `lib/newapi-*` -> `domains/newapi/lib/*`

### FAL

- `hooks/use-fal-models.ts` -> `domains/fal/hooks/use-fal-models.ts`
- `lib/fal-*` -> `domains/fal/lib/*`

### OpenRouter

- `hooks/use-openrouter-models.ts` -> `domains/openrouter/hooks/use-openrouter-models.ts`

### Gemini

- `hooks/use-gemini-models.ts` -> `domains/gemini/hooks/use-gemini-models.ts`

### Generation

- `components/generation-form.tsx` -> `domains/generation/components/generation-form.tsx`
- `components/task-status-panel.tsx` -> `domains/generation/components/task-status-panel.tsx`
- `hooks/use-generation.ts` -> `domains/generation/hooks/use-generation.ts`
- `hooks/use-task-queue.ts` -> `domains/generation/hooks/use-task-queue.ts`
- `lib/api-client.ts` -> `domains/generation/lib/api-client.ts`
- `lib/task-queue.ts` -> `domains/generation/lib/task-queue.ts`
- `lib/generation-provider-payload.ts` -> `domains/generation/lib/generation-provider-payload.ts`
- `lib/image-utils.ts` -> `domains/generation/lib/image-utils.ts`

### History

- `hooks/use-generation-history.ts` -> `domains/history/hooks/use-generation-history.ts`
- 历史相关恢复逻辑优先留在 hook/lib，不分散回顶层

### Settings

- `components/settings-dialog.tsx` -> `domains/settings/components/settings-dialog.tsx`
- `hooks/use-provider-settings.ts` -> `domains/settings/hooks/use-provider-settings.ts`
- `lib/providers.ts` -> `domains/settings/lib/providers.ts`
- `lib/openai-endpoint-profile.ts` -> `domains/settings/lib/openai-endpoint-profile.ts`

### Shared

- `lib/db.ts` -> `shared/lib/db.ts`
- `lib/persist.ts` -> `shared/lib/persist.ts`
- `lib/logger.ts` -> `shared/lib/logger.ts`
- `lib/utils.ts` -> `shared/lib/utils.ts`

## API Route 策略

- `app/api/**/route.ts` 位置不变
- route 内部调用迁移后的领域模块
- 不在本次把 route 本身重命名或改层级

## 导入边界

- provider 专属模块不得反向依赖页面组件
- `domains/*` 可以依赖 `shared/*`
- `shared/*` 不依赖 `domains/*`
- `generation/` 允许依赖各 provider 领域能力
- provider 领域不直接依赖其他 provider 领域，避免横向缠绕

## 风险控制

- 优先移动“已经明确成块”的文件，减少中间状态
- 每轮迁移后统一修 import
- 以 `lint + tsc + build` 作为迁移完成标准

## 完成标准

- 顶层 `lib/`、`hooks/`、`components/` 中的核心业务文件完成领域化迁移
- 入口组件和页面仍可正常工作
- 全仓库通过 `pnpm lint`
- 全仓库通过 `pnpm exec tsc --noEmit`
- 全仓库通过 `pnpm build`
