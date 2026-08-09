# M0 认证与准入模块需求与验收记录

## 基本信息

- 模块名称：M0 认证与准入（Auth & Admission）
- 分支名称：`feature/m0-auth-admission`
- 负责人：M0 实施工程师
- 依赖模块：无（基于已有认证基础设施）
- 不包含内容：密码找回、邮箱验证、第三方登录、支付、账号删除、正式法律文本、最终 UI 视觉稿、AI 人格内容、人生镜像剧情、Token 计费逻辑

## 目标与用户价值

- 解决的问题：提供可追溯的注册准入流程，记录三项必要同意，保证会话可恢复与可退出。
- 用户可完成的动作：
  1. 使用邮箱密码注册并同意用户协议、隐私政策、娱乐用途提示
  2. 使用邮箱密码登录
  3. 刷新页面后恢复已登录会话
  4. 退出登录并注销服务端会话
- 明确不做的动作：密码找回/重置、邮箱验证、第三方登录、支付/充值、账号删除、正式法律文本

## 设计约束

- 数据模型与新增 migration：无（预期不需要数据库迁移）
- API/共享契约变更：无（复用现有 `/auth/register`、`/auth/login`、`/auth/logout`、`/me`）
- 权限与数据隔离：用户只能访问自己的会话与数据；AuthService 中已包含所有权过滤
- 安全与娱乐边界：注册必须记录 `terms`、`privacy`、`entertainment_notice` 三项同意；客户端不得在全部同意前发送注册请求
- 删除、导出、保留和审计策略：同意记录持久化保存在 `ConsentRecord` 表中可追溯；会话可通过 `UserSession.revokedAt` 注销

## 验收用例

| 场景 | 预期结果 | 验证方式 |
|---|---|---|
| Register with all three consents | Creates user, consent records, token account, and active session | API + browser |
| Register missing any consent | Returns conflict; no user or session is created | API |
| Login using mixed-case/space-padded email | Uses normalized identity and creates a new session | API |
| Reload with valid token | `/me` restores authenticated user before app shell renders | browser |
| Reload with invalid/revoked token | Token is cleared and entry screen is shown | browser |
| Logout | Server session is revoked and local token is removed | API + browser |
| Access another user's session | Rejected by ownership filter | API |

## 合并门槛

- [ ] 新旧迁移可顺序执行（本模块不新增迁移）。
- [ ] 模块测试、类型检查和构建通过。
- [ ] 默认 PostgreSQL 真实 API 验证通过。
- [ ] 需要页面的模块已完成浏览器验证。
- [ ] 已执行全量 `npm.cmd run verify`。
- [ ] 已记录验证结果和已知限制。
