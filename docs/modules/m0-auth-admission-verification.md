# M0 认证与准入验收记录

## 验收结论

- 验收日期：2026-08-09（Asia/Shanghai）
- 分支：`feature/m0-auth-admission`
- 结论：**通过，可作为 M0 合并候选。**
- 证据卫生：仅保留测试标识和 HTTP 状态码；未记录测试邮箱、密码、访问令牌、会话令牌或数据库连接凭据。

## 自动化回归与构建

| 命令 | 结果 |
| --- | --- |
| `npm.cmd run test:api` | PASS，20 个测试通过 |
| `npm.cmd run test:web` | PASS，12 个测试通过 |
| `npm.cmd run test --workspace @xinyu/config` | PASS，1 个测试通过 |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run build --workspace @xinyu/web` | PASS（仅有多 lockfile 的非阻塞提示） |
| `npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma` | PASS，7 个迁移均已应用 |

## 真实 PostgreSQL API 验证

验证对象为本地 PostgreSQL 与编译后的 Nest API。测试账号仅用于本地验收。

| 用例 | 端点 | 实际结果 | 判定 |
| --- | --- | --- | --- |
| 缺少必需同意项时注册 | `POST /auth/register` | HTTP 409 | PASS |
| 三项同意完整时注册 | `POST /auth/register` | HTTP 201 | PASS |
| 首尾空格邮箱注册 | `POST /auth/register` | HTTP 201 | PASS |
| 伪造协议版本注册后的数据库记录 | PostgreSQL 只读核验 | 3 条同意均记录服务器定义的 `1.0` | PASS |
| 当前会话获取用户资料 | `GET /me` | HTTP 200 | PASS |
| 当前会话列表 | `GET /auth/sessions` | HTTP 200 | PASS |
| 注销当前会话 | `POST /auth/logout` | HTTP 201 | PASS |
| 复用已撤销令牌 | `GET /me` | HTTP 401 | PASS |
| 大小写混合、首尾空格邮箱登录 | `POST /auth/login` | HTTP 201 | PASS |

## 浏览器端到端验证

本地 Web 运行于 `http://localhost:3100`，本地 API 运行于 `http://localhost:4100/api/v1`。使用临时本地账号完成以下用例。

| 测试标识 | 用例 | 结果 |
| --- | --- | --- |
| `M0-BR-01` | 未完成三项协议同意时，“创建心屿账号”保持禁用 | PASS |
| `M0-BR-02` | 勾选三项同意后可注册并进入聊天首页 | PASS |
| `M0-BR-03` | 刷新页面后通过 `/me` 恢复已登录状态 | PASS |
| `M0-BR-04` | 退出登录后返回入口，客户端会话被清除 | PASS |
| `M0-BR-05` | 已注册用户可重新登录；邮箱首尾空格与大小写变化可被规范化 | PASS |
| `M0-BR-06` | 已撤销令牌的服务端拒绝由 API 用例覆盖；浏览器退出流程确认回到匿名入口 | PASS |

安全运行时修复提交后，已再次执行浏览器登录和刷新恢复：两项均通过。

## 本轮运行时修复

发现 `tsx watch` 不发射 Nest 依赖注入所需的装饰器元数据，导致开发模式下控制器依赖为 `undefined`，表现为就绪检查和认证请求失败。API 开发脚本已改为“先构建配置包，再由 TypeScript 编译监视配合 Node 运行时监视”；本地存在 `.env` 时，入口会在导入认证模块前加载并校验配置。真实就绪检查现在返回 HTTP 200。

补充安全修复：JWT 密钥必须不少于 32 个字符且不存在固定回退值；服务端写入当前协议版本而不信任客户端版本；注册与登录均先裁剪邮箱；已禁用用户不能继续通过现存会话访问受保护接口。

## 已知非阻塞事项

- Web 构建会提示仓库存在多个 lockfile；构建结果仍为成功。本轮不修改受保护的 `package-lock.json`。
- 协议链接目前指向内部封闭测试版锚点；正式法律文本与最终 UI 文案仍属于后续确认范围。

## 有意排除

- 密码找回、邮箱验证、第三方登录
- 正式法律文本、数据导出、账号删除

以上内容均不属于 M0，未实现也未作为本模块验收能力陈述。
