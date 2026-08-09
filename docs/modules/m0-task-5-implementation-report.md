# M0 Task 5 实施报告：显式注册同意项

## 范围

仅完成授权计划中的 Task 5：在注册入口提供可见、独立且必须选择的三项同意，并在客户端构建可审计的内部测试版本记录。

## 实现结果

- 新增 `ConsentChecklist`，分别展示 `terms`、`privacy`、`entertainment_notice` 三项选择。
- 每项链接均标识为“内部封闭测试版 v1.0”；未引入或宣称任何正式法律文本。
- 注册按钮在三项全部选择前保持禁用；提交时按固定顺序发送三项 `{ type, version: "1.0" }`。
- 客户端限制仅作为入口保护，服务端既有三项同意校验与 `ConsentRecord` 持久化审计仍为权威。

## TDD 与验证记录

| 检查 | 结果 |
|---|---|
| 红阶段：`npm.cmd run test:web -- --run components/auth/consent-checklist.spec.tsx` | 按预期失败：新建测试无法解析尚不存在的 `ConsentChecklist` 模块。 |
| 目标测试 | 通过：3/3（独立三项文档、未完整同意时禁用注册、完整审计载荷）。 |
| `npm.cmd run test:web` | 通过：5 个测试文件、12 个测试。 |
| `npm.cmd run build --workspace @xinyu/web` | 通过：Next.js 生产构建退出码为 0。 |

构建输出包含既有多锁文件工作区根目录推断警告；未修改 `package-lock.json`。

## 有意未执行的范围

- 未执行 Task 6 的真实 PostgreSQL、迁移状态或浏览器 E2E 验证。
- 未执行推送、迁移、正式法律文案、支付或其他 M0 任务。
