# 心屿（Island）API 契约与错误码设计

版本：0.1  
状态：开发前接口基线  
协议：HTTPS + JSON REST，AI 生成使用 SSE

## 1. 通用规则

### 1.1 基础路径

```text
/api/v1
```

### 1.2 请求头

```http
Authorization: Bearer <access-token>
Content-Type: application/json
X-Request-Id: <optional-client-request-id>
Idempotency-Key: <required-for-generation-and-mutating-generation-actions>
```

服务端始终生成或透传 `X-Request-Id`，用于日志、审计和错误定位。

### 1.3 成功响应

```json
{
  "data": {},
  "meta": {
    "requestId": "req_xxx"
  }
}
```

列表响应：

```json
{
  "data": [],
  "meta": {
    "requestId": "req_xxx",
    "nextCursor": null
  }
}
```

### 1.4 错误响应

```json
{
  "error": {
    "code": "CONVERSATION_ACCESS_DENIED",
    "message": "无法访问该会话",
    "requestId": "req_xxx",
    "details": {}
  }
}
```

用户可见 `message` 必须是安全、可理解的中文，不暴露 API Key、Provider 内部堆栈、数据库信息或安全策略细节。

## 2. 认证与用户

### POST `/auth/register`

请求：

```json
{
  "email": "user@example.com",
  "password": "********",
  "nickname": "小屿",
  "ageBand": "18_plus",
  "consents": [
    { "type": "terms", "version": "2026-08-01" },
    { "type": "privacy", "version": "2026-08-01" },
    { "type": "entertainment_notice", "version": "2026-08-01" }
  ]
}
```

规则：

- `email` 必须唯一。
- 密码只在服务端哈希后保存。
- 年龄段不能使用精确生日替代。
- 必需协议未同意时注册失败。
- 记忆、主动联系、远程 Provider 和 Token 不得默认授权。

### POST `/auth/login`

请求：`email`、`password`。  
响应：短期 access token 和会话摘要。

### POST `/auth/logout`

撤销当前会话，不影响其他设备。

### GET `/auth/sessions`

返回当前用户会话列表，不返回 token 原文。

### DELETE `/auth/sessions/:sessionId`

撤销指定会话。

### PATCH `/me`

允许修改昵称、头像引用和非敏感用户设置。

### PATCH `/me/password`

修改密码，需要验证当前密码。

### DELETE `/me`

发起账号注销和数据删除。响应必须说明删除范围、不可恢复范围和处理状态。

## 3. 授权和设置

### GET `/me/consents`

返回当前用户授权状态、文档版本和撤回能力。

### POST `/me/consents/:type/revoke`

可撤回：

- `memory`
- `proactive_contact`
- `remote_provider`
- `product_improvement`
- `token_mode`

协议和隐私政策的必要同意不能用普通撤回接口处理，应走账号注销或重新确认流程。

### GET `/me/settings`

返回：

- 全局记忆默认开关
- 全局 Token 默认开关
- 主动联系默认设置
- 自动清理设置
- 通知和隐私设置

### PATCH `/me/settings`

支持修改全局默认值。单个会话和联系人可以覆盖默认值。

## 4. AI 联系人

### GET `/contacts`

查询当前用户可见联系人：官方 AI、用户私有 AI、收藏、置顶、隐藏和屏蔽状态。

查询参数：

```text
kind=official|user
status=active|hidden|blocked
q=<keyword>
cursor=<cursor>
```

### GET `/contacts/:contactId`

返回联系人展示信息、当前用户状态和可用功能，不返回不可公开的系统 Prompt 或安全策略原文。

### POST `/contacts/:contactId/add`

将官方联系人加入当前用户联系人列表。官方联系人不能被复制为公开角色。

### DELETE `/contacts/:contactId`

官方联系人仅从当前用户列表移除；用户 AI 才执行所有者删除流程。

### PATCH `/contacts/:contactId/state`

修改本地昵称、收藏、置顶、隐藏、屏蔽、记忆覆盖和主动联系授权。

### POST `/user-contacts`

创建私有 AI 联系人。

请求中的人格、兴趣、角色和自然语言描述必须经过配置安全检查。

### PATCH `/user-contacts/:contactId`

创建新版本，不直接改变旧版本和历史会话。

### DELETE `/user-contacts/:contactId`

删除用户 AI 及其配置。长期记忆删除范围必须由用户确认。

## 5. 会话和消息

### GET `/conversations`

返回当前用户会话列表，支持：

```text
kind=direct|group
contactId=<id>
q=<keyword>
archived=true|false
cursor=<cursor>
```

### POST `/conversations`

创建单聊或讨论组。

单聊请求：

```json
{
  "kind": "direct",
  "contactId": "contact_xxx",
  "memoryMode": "inherit",
  "tokenMode": "inherit"
}
```

讨论组请求：

```json
{
  "kind": "group",
  "title": "周末观点秀",
  "participantContactIds": ["contact_a", "contact_b"],
  "mode": "opinion_show"
}
```

### GET `/conversations/:conversationId`

返回会话摘要、参与者、模式状态、未读状态和最近消息。

### PATCH `/conversations/:conversationId`

支持重命名、置顶、归档、记忆模式覆盖和 Token 模式覆盖。

### DELETE `/conversations/:conversationId`

删除会话。请求可携带：

```json
{
  "deleteRelatedMemory": false
}
```

### POST `/conversations/:conversationId/context-reset`

清空当前临时上下文但保留历史记录和联系人长期记忆。

### GET `/conversations/:conversationId/messages`

分页返回消息。删除消息默认不返回正文。

### POST `/conversations/:conversationId/messages`

创建用户消息并启动 AI 生成。该接口返回生成任务标识，实际文本通过 SSE 返回。

请求：

```json
{
  "content": "今天想体验一个新的主题",
  "quotedMessageId": null,
  "memoryMode": "inherit",
  "tokenMode": "inherit"
}
```

要求 `Idempotency-Key`。

### GET `/generations/:generationId/events`

SSE 事件：

```text
event: generation.started
event: message.delta
event: message.completed
event: usage.committed
event: generation.failed
event: generation.closed
```

示例：

```text
event: message.delta
data: {"messageId":"msg_xxx","text":"你好"}
```

客户端断线后可以重新订阅任务状态，不重复创建生成请求。

### POST `/messages/:messageId/report`

举报单条消息，提交原因和可选说明。

### POST `/messages/:messageId/feedback`

提交点赞或点踩，不得将反馈内容直接写入联系人长期记忆。

### POST `/messages/:messageId/memory-candidate`

请求保存非敏感记忆，敏感内容必须进入明确确认流程。

## 6. 多 AI 讨论组

### PATCH `/conversations/:conversationId/participants`

添加、移除 AI 和调整发言顺序。

### PATCH `/conversations/:conversationId/group-settings`

支持：

- `mode`: `free_discussion`、`hosted`、`roleplay`、`opinion_show`
- `allowProactiveSpeech`
- `turnOrder`
- `memoryMode`

### POST `/conversations/:conversationId/mentions/resolve`

解析 `@角色名`，返回本轮允许参与的联系人，不直接触发生成。

## 7. 记忆和关系

### GET `/contacts/:contactId/memories`

只返回当前用户与指定联系人之间的长期记忆。

### PATCH `/memories/:memoryId`

修改记忆内容或状态。

### DELETE `/memories/:memoryId`

删除单条长期记忆。

### POST `/contacts/:contactId/memory-reset`

清除该联系人对当前用户的长期记忆，不删除聊天记录或其他联系人记忆。

### POST `/contacts/:contactId/relationship-reset`

重置关系成长状态，不自动删除聊天或长期记忆。

## 8. Token、免费模式和额度

### GET `/me/quota`

返回用户可见的额度汇总：

- 当前可用 Token
- 即将过期额度
- 重置时间
- 当前模式
- 免费模式限流状态

不返回 Provider 密钥或后台成本信息。

### GET `/me/usage`

分页返回用户自己的消耗记录，展示总量和会话关联。

### GET `/generations/:generationId/usage`

返回当前用户有权查看的该次生成用量。

额度扣减必须绑定生成任务和幂等键，删除聊天不能删除 UsageRecord 或 QuotaLedgerEntry。

## 9. 人生镜像副本和主题活动

### GET `/scenarios`

返回当前年龄段可见的已发布场景。

### POST `/scenario-runs`

创建一次私密模拟。

### GET `/scenario-runs/:runId`

返回当前用户自己的运行状态、分支和当前节点。

### POST `/scenario-runs/:runId/choices`

提交选择，创建新节点。要求幂等键，不能覆盖历史节点。

### POST `/scenario-runs/:runId/branches`

从指定节点创建新分支。

### DELETE `/scenario-runs/:runId`

删除整次模拟及其分支和节点，不影响聊天记忆。

### GET `/activities`

返回年龄段可见的主题活动。

### POST `/activity-runs`

创建活动运行记录；活动结果默认不写入长期记忆。

## 10. 后台 API 边界

后台接口统一使用 `/admin/v1`，必须具备管理员权限和审计：

- `/admin/v1/contacts`：官方 AI 草稿、发布、下线、版本和回滚
- `/admin/v1/activities`：主题活动内容生命周期
- `/admin/v1/quota-policies`：额度规则和用户调整
- `/admin/v1/usage`：聚合使用量和异常消耗
- `/admin/v1/reports`：举报处理和申诉
- `/admin/v1/safety-events`：暂停、下线、策略和回滚
- `/admin/v1/policies`：协议和安全规则版本
- `/admin/v1/audit-events`：审计查询

管理员默认不能浏览完整聊天；特殊安全事件只能按最小范围授权查看。

## 11. 错误码

### 通用

```text
REQUEST_INVALID
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
INTERNAL_ERROR
SERVICE_UNAVAILABLE
```

### 认证

```text
EMAIL_ALREADY_EXISTS
INVALID_CREDENTIALS
SESSION_REVOKED
PASSWORD_POLICY_FAILED
CONSENT_REQUIRED
AGE_BAND_INVALID
```

### 联系人与会话

```text
CONTACT_NOT_AVAILABLE
CONTACT_VERSION_UNAVAILABLE
CONTACT_ACCESS_DENIED
CONVERSATION_ACCESS_DENIED
CONVERSATION_STATE_INVALID
PARTICIPANT_NOT_FOUND
PARTICIPANT_ALREADY_EXISTS
MESSAGE_NOT_FOUND
MESSAGE_ALREADY_DELETED
MESSAGE_EDIT_NOT_SUPPORTED
```

### AI 生成

```text
GENERATION_NOT_FOUND
GENERATION_ALREADY_COMPLETED
GENERATION_IN_PROGRESS
GENERATION_IDEMPOTENCY_CONFLICT
FREE_PROVIDER_UNAVAILABLE
TOKEN_PROVIDER_UNAVAILABLE
PROVIDER_TIMEOUT
PROVIDER_RESPONSE_INVALID
GENERATION_SAFETY_BLOCKED
GENERATION_OUTPUT_REJECTED
```

### 额度

```text
TOKEN_MODE_NOT_CONSENTED
TOKEN_QUOTA_EXHAUSTED
TOKEN_QUOTA_LOCKED
USAGE_COMMIT_FAILED
USAGE_ROLLBACK_FAILED
QUOTA_POLICY_UNAVAILABLE
```

### 记忆与隐私

```text
MEMORY_MODE_DISABLED
MEMORY_SENSITIVE_CONFIRMATION_REQUIRED
MEMORY_ACCESS_DENIED
MEMORY_NOT_FOUND
DATA_EXPORT_IN_PROGRESS
DATA_DELETION_IN_PROGRESS
REMOTE_PROVIDER_DISABLED
```

### 场景与活动

```text
SCENARIO_NOT_AVAILABLE
SCENARIO_RUN_NOT_FOUND
SCENARIO_BRANCH_NOT_FOUND
SCENARIO_CHOICE_INVALID
SCENARIO_STATE_CONFLICT
ACTIVITY_NOT_AVAILABLE
ACTIVITY_AGE_RESTRICTED
```

## 12. HTTP 状态映射

| 状态 | 使用范围 |
|---|---|
| 400 | 请求格式、字段或状态非法 |
| 401 | 缺少或无效认证 |
| 403 | 已认证但无权限或年龄策略不允许 |
| 404 | 资源不存在或对当前用户不可见 |
| 409 | 幂等冲突、版本冲突或资源状态冲突 |
| 422 | 业务字段验证失败 |
| 429 | 账号、IP、会话或资源限流 |
| 500 | 未预期服务错误 |
| 503 | Provider、数据库或依赖不可用 |

## 13. API 实现顺序

第一里程碑只实现：

1. `auth` 和 `me`
2. `contacts` 查询和状态
3. `conversations` 创建、查询和消息分页
4. `messages` 发送
5. `generations` SSE
6. Mock Provider
7. 基础错误码、请求 ID 和幂等

第二阶段再加入 Token、额度、记忆、群聊、场景和后台接口。
