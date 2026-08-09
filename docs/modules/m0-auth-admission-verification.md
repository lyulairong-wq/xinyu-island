# M0 认证与准入验证记录

## 验证结论

- 验证日期：2026-08-09（Asia/Shanghai）
- 分支：`feature/m0-auth-admission`
- 起始提交：`38fe4ca`
- 结论：**阻塞，尚未达到 M0 合并门槛。** 模块回归、类型检查、Web 构建和迁移状态通过；真实 PostgreSQL API 验证发现空格包裹邮箱登录失败；当前运行环境没有可用浏览器实例，因此浏览器用例未执行。
- 证据卫生：仅记录测试标识符和状态码；未记录测试邮箱、密码、访问令牌、会话令牌或数据库凭据。

## 环境

- Windows / PowerShell
- Node.js `v24.18.0`
- npm `11.16.0`
- Prisma CLI / Client `6.19.3`
- 本地 API 前缀：`/api/v1`
- 本地 PostgreSQL：`localhost:5432`，`xinyu_island.public`

## 规定回归与构建

| 命令 | 结果 | 精确结果 |
|---|---|---|
| `npm.cmd run test:api` | PASS（exit 0） | 4 个测试文件、16 个测试全部通过：`auth.policy.spec.ts` 4、`auth.service.spec.ts` 5、`usage.service.spec.ts` 2、`chat.service.spec.ts` 5。 |
| `npm.cmd run test:web` | PASS（exit 0） | 5 个测试文件、12 个测试全部通过：`auth-session.spec.ts` 1、`auth-api.spec.ts` 1、`auth-gate.spec.tsx` 6、`page.spec.tsx` 1、`consent-checklist.spec.tsx` 3。 |
| `npm.cmd run typecheck` | PASS（exit 0） | `contracts`、`config`、`ai`、`safety`、`api`、`web` 全部通过。 |
| `npm.cmd run build --workspace @xinyu/web` | PASS（exit 0） | Next.js `16.2.10` 编译、TypeScript、页面数据收集和 3 个静态页面生成成功。出现多 lockfile 导致工作区根目录推断的非阻塞警告。 |
| `npm.cmd run verify` | PASS（exit 0，22.1 秒） | 全仓类型检查、测试和生产构建成功。测试结果：API 16、Web 12、AI 2、Safety 3，共 33 个测试通过；Config 与 Contracts 没有测试文件并按 `--passWithNoTests` exit 0。 |

`verify` 的成功不覆盖下述真实 HTTP 邮箱规范化失败，也不能替代未执行的浏览器用例。

## 迁移状态

执行命令（数据库连接值按证据卫生要求省略）：

```powershell
$env:DATABASE_URL='<local-development-database-url>'
npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma
```

结果：PASS（exit 0）。Prisma 找到 7 个 migration，并报告 `Database schema is up to date!`。CLI 同时提示可升级到 Prisma 7.9.1；本验证未升级依赖，也未修改 migration。

## 真实 PostgreSQL API 验证

测试标识符：`M0-API-20260809-200416-31772daa`。使用新测试身份访问编译后的本地 API；测试值和令牌未写入本记录。

| 用例 | 端点 | 实际结果 | 判定 |
|---|---|---|---|
| 缺少必要同意项注册 | `POST /api/v1/auth/register` | HTTP 409 | PASS |
| 被拒绝后使用同一测试身份完整注册 | `POST /api/v1/auth/register` | HTTP 201 | PASS；证明被拒绝请求未预先占用该身份。 |
| 三项同意完整注册后的数据库状态 | PostgreSQL 只读核验 | 用户存在；3 条 `ConsentRecord`；类型为 `terms`、`privacy`、`entertainment_notice`；版本均为 `1.0`；`TokenAccount` 存在 | PASS |
| 有效会话读取当前用户 | `GET /api/v1/me` | HTTP 200 | PASS |
| 读取当前用户会话 | `GET /api/v1/auth/sessions` | HTTP 200 | PASS |
| 注销当前会话 | `POST /api/v1/auth/logout` | HTTP 201 | PASS |
| 注销后复用已撤销令牌 | `GET /api/v1/me` | HTTP 401 | PASS；数据库核验显示 1 个已撤销会话。 |
| 常规邮箱登录 | `POST /api/v1/auth/login` | HTTP 201 | PASS；数据库核验显示共创建 2 个会话。 |
| 大小写混合且前后带空格的邮箱登录 | `POST /api/v1/auth/login` | HTTP 400 | **FAIL**；预期规范化身份并创建新会话。请求在 DTO 的邮箱校验阶段被拒绝，未进入 `AuthService.normalizeEmail`。 |
| 无效令牌读取当前用户 | `GET /api/v1/me` | HTTP 401 | PASS |

会话所有权过滤由 `auth.service.spec.ts` 的 `updateMany({ where: { id, userId } })` 回归覆盖。当前 API 没有接受任意目标会话 ID 的注销端点，因此本轮没有构造跨用户实时端点调用；不把单元覆盖表述为浏览器或实时 API 证据。

## 浏览器验证

浏览器控制运行时尝试为 `http://localhost:3000/` 选择浏览器，返回 `No browser is available`；按排障流程再次枚举可用浏览器，结果为空数组 `[]`。本地 API 健康端点和 Web 根页面分别通过普通 HTTP 请求返回 200，但这不构成浏览器证据。

因此下列真实浏览器用例均为 **NOT RUN（环境阻塞）**，没有生成浏览器测试账号，也没有伪造 UI、网络或存储证据：

| 测试标识符 | 浏览器用例 | 结果 |
|---|---|---|
| `M0-BR-01` | 同意项不完整时不能提交 | NOT RUN |
| `M0-BR-02` | 三项同意完整时注册成功 | NOT RUN |
| `M0-BR-03` | 有效令牌刷新后由 `/me` 恢复登录用户 | NOT RUN |
| `M0-BR-04` | 退出后返回入口且本地令牌移除 | NOT RUN |
| `M0-BR-05` | 已注册用户重新登录成功 | NOT RUN |
| `M0-BR-06` | 无效或已撤销令牌刷新后返回入口并清除本地令牌 | NOT RUN |

## 已知问题与限制

1. **M0 阻塞：邮箱规范化未贯穿 HTTP DTO。** `AuthService` 的单元测试覆盖大小写和空格规范化，但真实 `POST /auth/login` 在 `@IsEmail()` 校验前没有去除首尾空格，实际返回 400。
2. **M0 阻塞：缺少真实浏览器证据。** 当前会话没有可用浏览器实例，无法验证按钮禁用、注册、刷新恢复、本地存储清理和页面跳转。
3. **本地开发运行差异。** `npm.cmd run dev --workspace @xinyu/api` 启动的 `tsx watch` 服务健康检查返回 200，但认证请求返回 500；同一请求对 `npm.cmd run build --workspace @xinyu/api` 生成的编译产物返回预期状态。本任务为 verification-only，未修改启动脚本或运行时代码。
4. Web 构建报告多 lockfile 工作区根目录推断警告；构建仍 exit 0。本任务未修改或提交受保护的 `package-lock.json`。
5. `apps/web/next-env.d.ts` 在本地 Next.js 运行/构建期间发生生成式变化；它不属于 Task 6 文档范围，未纳入提交。

## 有意排除

- 密码找回
- 邮箱验证
- 第三方登录
- 正式法律文本
- 数据导出
- 账号删除

以上均未实现、未测试，也不作为 M0 已完成能力陈述。

## 合并判断

在修复真实 HTTP 邮箱规范化失败并补齐全部 `M0-BR-*` 浏览器证据前，M0 应保持“验证阻塞”，不得标记为已验收或可合并。
