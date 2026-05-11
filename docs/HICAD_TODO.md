# HiCAD 完整 TODO 清单

更新时间：2026-05-11

本文档记录 HiCAD 从“镜像包”重建为可维护源码工程后的完整待办。状态含义：

- `[x]` 已完成并经过当前轮验证
- `[ ]` 待实现或待完善
- `P0` 必须优先处理，影响安全、可运行性或核心闭环
- `P1` 产品主路径能力
- `P2` 增强、体验优化或工程化改进

## P0 已完成基线

- [x] 建立 `pnpm workspace`，拆分 `backend`、`frontend`、`shared`。
- [x] 恢复源码目录：`backend/src`、`frontend/src`、`shared/src`。
- [x] 写入开发计划：`docs/HICAD_DEVELOPMENT_PLAN.md`。
- [x] 新增根启动脚本：`start.sh`。
- [x] 新增根脚本：`pnpm dev`、`pnpm build`、`pnpm start`、`pnpm test`、`pnpm typecheck`、`pnpm lint`。
- [x] 后端从编译产物迁移到 NestJS TypeScript 源码。
- [x] 前端从构建产物迁移到 Vue 3 + Vite TypeScript 源码。
- [x] 共享类型包提供 `User`、`CadModel`、`Template`、`AiProvider`、`AiStreamEvent`、`CadParameter` 等基础类型。
- [x] 参数注释协议解析：`const boxWidth = 80 // 描述 unit:mm min:10 max:200 step:5`。
- [x] 密码哈希从 `bcrypt` native addon 改为 Node 内置 `scrypt`。
- [x] 启动时检查生产环境 JWT 与支付回调密钥，拒绝默认/占位密钥。
- [x] 移除固定激活码后门，改为数据库激活码记录；本地仅保留 `DEV_ACTIVATION_CODE`。
- [x] 管理员权限改为用户角色判断，不再依赖固定邮箱。
- [x] 支付回调加入 HMAC 验签、金额校验和幂等状态更新。
- [x] Worker/CAD 代码增加基础危险能力拦截：`fetch`、`XMLHttpRequest`、`WebSocket`、`importScripts` 等。
- [x] 实现 `/api/auth/register`、`/api/auth/login`、`/api/auth/refresh`。
- [x] 实现 `/api/users/me`。
- [x] 实现 `/api/ai/generate` SSE。
- [x] 实现 `/api/ai/modify` POST 与修改流接口。
- [x] 实现 `/api/ai/history`。
- [x] 实现模型保存、更新、删除、发布、撤回、点赞、分享链接。
- [x] 实现 `/api/templates`、`/api/templates/:id`、`/api/templates/:id/use`。
- [x] 实现 `/api/admin/stats`、用户、订单、模型、模板、反馈、激活码管理基础接口。
- [x] 实现 `/api/pay/create`、`/api/pay/status/:orderNo`、`/api/pay/code/:orderNo`、`/api/pay/callback`。
- [x] 实现 `/api/feedback`。
- [x] 实现前端 AI 面板、工作台、Monaco 编辑器、Three.js 预览、参数面板、市场面板。
- [x] 实现 STL ASCII 导出 v1。
- [x] 完成验证：`bash -n start.sh`、`pnpm test`、`pnpm typecheck`、`pnpm build`。
- [x] 完成冒烟：`PORT=3100 ./start.sh`、首页、`/api/templates`、`/api/ai/generate` SSE。

## P0 必须补齐

- [x] 接入真实 AI HTTP 适配器：DeepSeek、OpenAI、Qwen。
- [x] 为 AI 适配器加入统一超时、重试、错误码映射和日志脱敏。
- [x] DeepSeek 503/429 自动重试 3 次，间隔 `2s / 4s / 8s`。
- [x] OpenAI/Qwen 使用同一 `AiAdapter` 接口，支持模型名配置与默认模型。
- [x] AI 调用失败时回退到本地确定性 codegen，并在 SSE 中发送 `retry` / `error` / `fallback` 状态。
- [x] 将当前本地 codegen 明确标记为 fallback，而不是伪装成真实第三方模型结果。
- [x] 完善 AI Prompt：通用建模、机械臂、坦克、建筑/室内、载具。
- [x] 实现“意图 JSON -> 确定性 JSCAD 代码”的双阶段管线。
- [x] 对 AI 输出做代码边界校验：禁止网络、持久化、副作用、超长代码和可疑全局访问。
- [x] Worker 加入真实执行超时机制，超时后 terminate 并重建 Worker。
- [x] Worker 返回结构化错误码，前端展示可操作错误信息。
- [x] Three.js 预览接入真实 JSCAD 几何执行与网格转换。
- [x] 接入 `@jscad/modeling` 或等价 JSCAD runtime。
- [x] 支持 JSCAD 几何序列化到 Transferable TypedArray。
- [x] 前端根据 Worker 返回几何生成真实 Mesh，而不是仅按参数生成 BoxGeometry。
- [x] 完善 `colorize()` 多色分组解析。
- [x] 完善 `@material` 注释解析与材质映射。
- [x] 完善 STL/OBJ 导出为真实几何导出。
- [x] 为注册、登录、模型保存、发布、分享补集成测试。
- [x] 为支付回调补集成测试：验签失败、金额不一致、重复回调、订单不存在。
- [x] 为普通用户访问 `/api/admin` 补安全测试。
- [x] 为生产默认密钥拒绝启动补启动级测试。
- [x] 写入正式 README：源码工程启动、环境变量、开发脚本、生产部署、安全说明。

## P1 后端功能

- [x] 数据层抽象为 Repository 接口，便于后续从 JSON 文件迁移到 PostgreSQL。
- [x] 为 `JsonDatabaseService` 增加写入锁，避免并发写导致 JSON 文件状态丢失。
- [x] 为数据库增加 schema version 与轻量 migration。
- [x] 将 `data/templates.json` 的旧字段完整迁移到新 `Template` schema。
- [x] 模型增加版本历史：每次保存生成 revision。
- [x] 模型增加草稿/已发布分离，避免编辑草稿直接影响市场版本。
- [x] 模型发布增加内容安全扫描和代码安全扫描。
- [x] 分享 token 增加过期时间、撤销状态和访问统计。
- [x] 点赞接口增加用户维度，避免同一用户无限点赞。
- [x] 市场搜索增加排序：最新、热门、最多使用、精选。
- [x] 市场筛选增加分类、标签、多关键词组合。
- [x] 模型导入接口支持 STL 上传、Base64 存储、元数据提取。
- [x] 文件上传增加大小限制、类型校验和病毒/恶意内容预留钩子。
- [x] 用户配额：每日 AI 次数、模型数量、导出次数。
- [x] 用户 tier：free、pro、team 的权限矩阵。
- [x] 激活码增加批量创建、过期时间、使用次数、禁用状态。
- [x] 管理后台增加审计日志：谁在何时删除/精选/禁用内容。
- [x] 管理后台增加用户封禁/解封。
- [x] 管理后台增加模板精选、取消精选、排序权重。
- [x] 支付 provider 抽象：mock、微信、支付宝或 Stripe。
- [x] 真实支付平台接入时补验签文档、回调重放保护和订单状态机。
- [x] 反馈接口增加状态流转：open、reviewing、closed。
- [x] 全局错误响应格式统一为 `{ code, message, details, requestId }`。
- [x] 增加请求日志、慢请求日志和 requestId。
- [x] 增加健康检查：`/api/health`。
- [x] 增加诊断接口：仅管理员可查看版本、配置完整性、AI provider 状态。

## P1 前端功能

- [ ] 前端接入真实登录态持久化和刷新 token。
- [ ] 登录/注册从顶栏临时输入改成正式弹窗或独立页面。
- [ ] 工作台保存/发布/分享失败时展示明确错误。
- [ ] 模型列表：我的模型、草稿、已发布、分享中。
- [ ] 市场页独立路由或独立视图，支持搜索、分类、标签、排序。
- [ ] 分享页独立路由，未登录可只读预览。
- [ ] 管理后台页面：用户、模型、模板、订单、反馈、激活码。
- [ ] 参数面板支持分组、单位显示、数值校验和重置默认值。
- [ ] Monaco 增加 JSCAD snippets、自动补全、错误标记。
- [ ] Monaco 对 AI 生成代码支持 diff/apply，而不是直接覆盖。
- [ ] AI 修改模式支持“基于当前代码修改”并显示变更摘要。
- [ ] AI 消息合并流式 delta，避免每个 chunk 独立成消息气泡。
- [ ] AI 面板增加历史记录和重新生成。
- [ ] 模型生成时展示 `start/spec/retry/code/done/error` 细粒度状态。
- [ ] 视图模式完善：实体、线框、X-Ray、平面 CAD。
- [ ] 标注开关：尺寸标注、参数标签、坐标轴、网格。
- [ ] 材质面板完善 10+ 材质，并支持模型级/部件级材质。
- [ ] 支持 STL 导入，Base64 存储并进入同一保存/发布流程。
- [ ] 支持 OBJ 导出。
- [ ] 支持导出前预览导出体积、三角面数量、单位。
- [ ] 移动端改为可折叠面板，避免三栏布局挤压。
- [ ] 前端增加 toast、confirm、loading、empty、error 通用组件。
- [ ] 前端增加可访问性：按钮 aria-label、键盘操作、焦点态。

## P1 CAD 与渲染

- [ ] 真实执行 JSCAD `main()` 并捕获异常。
- [ ] 支持常用建模 API：`cuboid`、`roundedCuboid`、`cylinder`、`sphere`、`union`、`subtract`、`translate`、`rotate`、`colorize`。
- [ ] 支持复杂模型的部件树和颜色分组。
- [ ] Worker 使用 Transferable Objects 返回几何数据，减少复制。
- [ ] 主线程合并同材质 Mesh，降低 Draw Call。
- [ ] 计算并展示包围盒尺寸。
- [ ] 计算并展示面数、顶点数、渲染耗时。
- [ ] 大模型降级策略：限制面数、提示优化、暂停自动渲染。
- [ ] WebGL context lost 恢复处理。
- [ ] 相机控制：旋转、平移、缩放、重置视角。
- [ ] 预设视角：正视、侧视、顶视、等轴测。
- [ ] 支持阴影、环境光和工程网格。
- [ ] 平面 CAD 模式显示正交投影和尺寸线。
- [ ] X-Ray 模式透明材质和边线叠加。
- [ ] STL/OBJ 导出使用真实网格数据。

## P1 测试与质量

- [ ] 后端集成测试覆盖注册、登录、刷新 token。
- [ ] 后端集成测试覆盖模型 CRUD、发布、撤回、分享。
- [ ] 后端集成测试覆盖模板读取和使用。
- [ ] 后端集成测试覆盖 AI SSE 事件序列。
- [ ] 后端集成测试覆盖管理员权限。
- [ ] 前端组件测试覆盖 AI 面板、参数面板、市场面板。
- [ ] 前端组件测试覆盖保存、发布、分享按钮行为。
- [ ] Worker 测试覆盖危险代码拦截、超时、错误返回。
- [ ] CAD 测试覆盖参数解析、参数应用、材质注释、多色分组。
- [ ] E2E：生成盒子 -> 预览 -> 调参 -> 保存 -> 发布 -> 分享 -> 导出 STL。
- [ ] E2E：普通用户无法访问管理后台。
- [ ] E2E：伪造支付回调失败。
- [ ] Playwright 截图检查桌面端布局。
- [ ] Playwright 截图检查移动端布局。
- [ ] 依赖安全审计纳入 CI。
- [ ] 构建产物体积检查，重点处理 Monaco 过大 bundle。

## P2 工程化

- [ ] 增加 GitHub Actions：install、test、typecheck、build、audit。
- [ ] 增加 Dockerfile。
- [ ] 增加 docker-compose：应用 + 可选 PostgreSQL。
- [ ] 增加 PM2 配置。
- [ ] 增加 Nginx 示例配置。
- [ ] 增加 `.env.production.example`。
- [ ] 增加 release checklist。
- [ ] 增加 changelog。
- [ ] 增加贡献指南。
- [ ] 增加代码格式化配置：Prettier/ESLint。
- [ ] 拆分 Monaco 语言包，减少首屏体积。
- [ ] 前端路由懒加载。
- [ ] Three.js 和 Monaco 分包加载。
- [ ] 服务端静态资源缓存头。
- [ ] 日志脱敏，避免输出 API Key、JWT、支付签名。
- [ ] 增加 OpenAPI/Swagger 文档。
- [ ] 增加 API client 自动生成或类型安全封装。

## P2 产品增强

- [ ] 模型版本对比。
- [ ] 协同编辑预研。
- [ ] 模型评论。
- [ ] 模型收藏。
- [ ] 模板评分。
- [ ] 官方模板后台编辑器。
- [ ] AI 生成缩略图。
- [ ] 市场首页精选区。
- [ ] 用户主页。
- [ ] 团队空间。
- [ ] 私有模板库。
- [ ] 参数预设保存。
- [ ] 多语言：中文、英文。
- [ ] 主题：深色、浅色。
- [ ] 新手示例提示词。
- [ ] 复杂工业模型库：机械臂、坦克、航母、飞行汽车、室内结构。

## 验收命令

每次阶段性交付至少运行：

```bash
bash -n start.sh
pnpm test
pnpm typecheck
pnpm build
```

本地冒烟建议：

```bash
PORT=3100 ./start.sh
curl --noproxy '*' -sS -I http://127.0.0.1:3100
curl --noproxy '*' -sS http://127.0.0.1:3100/api/templates
curl --noproxy '*' -sS -N 'http://127.0.0.1:3100/api/ai/generate?prompt=生成一个50x30x20mm的盒子'
```

## 当前已知边界

- 当前 AI 生成已接入 DeepSeek/OpenAI/Qwen HTTP adapter；未配置密钥或调用失败时会明确发送 fallback 事件并进入本地确定性 codegen。
- 当前 Three.js 预览已接入 JSCAD Worker 真几何执行；大型模型仍需后续补面数限制与降级策略。
- 当前数据存储为 JSON 文件，适合 v1 轻量部署，不适合高并发生产。
- 当前前端是可用工作台雏形，市场、管理后台、分享页仍需产品化。
- `frontend/dist`、`backend/dist`、`shared/dist` 已加入 `.gitignore`，构建产物不作为长期源码来源。
