# HiCAD 安全完整重建开发计划

## Summary

目标是在当前 HiCAD 镜像包基础上，按文章与 README 描述重建完整可维护源码工程，而不是继续依赖已编译的 `dist` / `frontend/assets` 产物。最终交付一个可本地开发、可构建、可部署、可审计的 AI 参数化 CAD 平台。

当前仓库只有构建产物，缺少真实 `backend/src`、`frontend/src`、`shared/src` 源码；并已发现默认 JWT 密钥、固定激活码、支付回调无验签、浏览器 Worker 动态执行代码等安全风险。重建时必须把这些作为安全基线修掉。

## Key Changes

- 重建 Monorepo：使用 `pnpm workspace` 管理 `backend`、`frontend`、`shared`，恢复 TypeScript 源码、开发脚本、构建脚本、测试脚本和环境配置。
- 后端采用 NestJS：保留现有 API 形状，重写认证、用户、AI、模型、模板、市场、分享、管理、反馈、支付模块。
- 前端采用 Vue 3 + Vite + Pinia：实现文章中的工作台界面，包括 AI 对话、模型列表、Monaco 编辑器、参数面板、Three.js 预览、材质/视图/导出/分享。
- CAD 执行链：AI 生成 JSCAD 参数化代码，前端 Worker 隔离执行，Three.js 渲染，支持 STL/OBJ 导入导出、参数注释解析和 300ms 防抖重渲染。
- AI 管线：实现 DeepSeek、OpenAI、Qwen 三类适配器，支持 SSE 流式输出、模型切换、错误重试；复杂工业模型走“意图 JSON -> 确定性代码生成器”的双阶段管线。
- 社区市场：支持模型保存、发布、分类、标签、搜索、点赞、分享链接、无登录预览、管理员治理。
- 安全重构：禁止默认生产密钥，移除固定激活码后门，管理员权限基于角色而不是邮箱硬编码，支付回调必须验签，Worker 执行增加超时、CSP、危险能力隔离和资源限制。

## Public Interfaces

- 保持主要 API 前缀为 `/api`，兼容现有镜像包中的核心路由：`/auth`、`/users/me`、`/ai/generate`、`/ai/modify`、`/ai/history`、`/models`、`/templates`、`/admin`、`/feedback`、`/pay`。
- 新增共享类型包 `shared`：统一定义 `User`、`Model`、`Template`、`AiProvider`、`AiStreamEvent`、`CadParameter`、`MaterialPreset`、`ShareToken`、`AdminStats`。
- SSE 事件统一为：`start`、`delta`、`code`、`spec`、`retry`、`error`、`done`，前端按事件类型增量更新对话、代码和状态。
- 环境变量必须显式配置：`JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、`AI_ADAPTER`、`DEEPSEEK_API_KEY`、`OPENAI_API_KEY`、`QWEN_API_KEY`、`DATA_DIR`、`CORS_ORIGIN`、支付密钥与回调验签密钥。

## Implementation Plan

1. 工程恢复
   - 新建标准源码目录：`backend/src`、`frontend/src`、`shared/src`。
   - 配置 `pnpm dev`、`pnpm build`、`pnpm start`、`pnpm test`、`pnpm lint`。
   - 保留当前 `dist` 与 `frontend` 构建产物作为行为参考，不作为长期源码来源。
   - 加入 `.env.example`、启动说明、生产部署说明和安全配置检查。

2. 后端核心
   - 实现 NestJS 模块化服务：认证、用户、AI、模型、模板、市场、管理、支付、反馈、文件导入导出。
   - 数据层 v1 使用轻量 JSON 文件数据库，封装 Repository 接口，后续可替换 PostgreSQL。
   - 密码哈希使用 Node 内置 `scrypt`，避免当前 `bcrypt` 原生构建失败导致无法启动。
   - 所有写接口加 DTO 校验、限流、错误过滤、统一响应结构和审计日志。

3. AI 建模
   - 通用建模 Prompt 输出可执行 JSCAD 代码，并要求顶层参数带注释协议。
   - 机械臂、坦克、建筑/室内、载具等复杂模型使用结构化 JSON 规格，再由确定性生成器生成代码。
   - DeepSeek 503/429 自动重试最多 3 次，间隔 2s、4s、8s；OpenAI/Qwen 采用同一适配器接口。
   - AI 修改功能基于当前代码 + 修改意图，只输出可应用的新代码或结构化 diff。

4. 前端工作台
   - 左侧 AI 建模助手：模型选择、提示词输入、历史消息、流式生成、修改当前代码。
   - 中部/右侧 CAD 工作区：Three.js 画布、视图模式、材质面板、标注开关、导入、参数面板。
   - Monaco 编辑器支持 JSCAD 语法提示、错误定位、代码折叠、应用 AI 结果、300ms 防抖渲染。
   - 参数面板解析 `// 描述 unit:mm min:0 max:100` 注释，支持滑块与数字输入双向同步。
   - 移动端采用可折叠面板，桌面端保持文章截图中的深色工程工具布局。

5. CAD 渲染与导出
   - Worker 中执行 JSCAD，返回可转移的 TypedArray 几何数据，主线程转 Three.js Mesh。
   - 支持实体、线框、X-Ray、平面 CAD 模式；支持 CAD 蓝、银色、黄金、铜、陶瓷、玻璃、霓虹等材质。
   - 支持 `@material` 注释和 `colorize()` 多色分组，尽量合并同材质 Mesh 降低 Draw Call。
   - 支持 STL 导入、Base64 存储、模型预览、STL/OBJ 导出。

6. 社区与分享
   - 用户可保存私有模型、发布到市场、撤回发布、编辑标题描述标签分类。
   - 市场支持官方模板、社区共创、分类、标签、关键词搜索、最新/热门排序。
   - 分享链接使用随机 token，可无登录预览，但不能越权编辑。
   - 管理员可删除违规模型、设置精选模板、查看基础统计。

7. 安全专项
   - 启动时检测生产环境默认密钥，发现默认值直接拒绝启动。
   - 激活码改为数据库记录的一次性/批量码，绑定创建者、使用者、过期时间和使用次数。
   - 管理员权限来自用户角色与服务端授权，不再依赖固定邮箱。
   - 支付回调必须验证平台签名、金额、订单号、幂等状态；测试环境使用明确的 mock provider。
   - Worker 执行代码加超时、尺寸限制、内存限制、禁用网络能力的 CSP 策略和错误隔离。
   - 对公开模型和模板做内容扫描，避免恶意代码通过市场传播。

## Test Plan

- 静态检查：`pnpm lint`、`pnpm typecheck`、依赖安全审计。
- 后端单元测试：认证、激活码、角色权限、AI 适配器、支付验签、模型 CRUD、分享 token。
- 后端集成测试：注册登录、AI SSE 生成、模型发布、市场搜索、管理员删除、支付回调幂等。
- 前端组件测试：AI 聊天、Monaco 编辑、参数面板、市场列表、分享页、登录态切换。
- CAD 渲染测试：参数注释解析、Worker 成功/失败/超时、JSCAD 几何转换、STL/OBJ 导出。
- E2E 验收：输入“生成一个 50x30x20mm 长方形盒子”后可流式生成、预览、调参数、保存、发布、分享、导出 STL。
- 安全验收：默认密钥无法生产启动；伪造支付回调失败；普通用户无法访问 `/api/admin`；恶意 Worker 代码不会卡死主 UI。

## Assumptions

- 目标是安全完整重建，而不是反编译当前压缩前端或在构建产物里打补丁。
- v1 数据库继续使用轻量 JSON 文件存储以贴近原项目部署；Repository 层预留未来迁移到 PostgreSQL。
- 支付模块 v1 先实现安全抽象与 mock provider，真实支付平台按后续密钥和平台文档接入。
- 当前不删除任何文件；后续如需清理 `.pnpm-store` 或旧构建产物，会遵守本项目规则：不批量删除，逐个明确路径确认。
