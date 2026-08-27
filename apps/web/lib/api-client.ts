import { getBrowserTokenStorage } from "./auth-session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const CODE_NOTICES: Readonly<Record<string, string>> = {
  FREE_QUOTA_EXCEEDED: "今日免费额度已用完，请明天再试",
  FREE_COOLDOWN_ACTIVE: "请稍候片刻再发送",
  FREE_GENERATION_IN_PROGRESS: "上一条回复仍在生成，请稍候",
  GENERATION_IN_PROGRESS: "上一条回复仍在生成，请稍候",
  GENERATION_ALREADY_COMPLETED: "这次请求已经完成，请刷新对话",
  TOKEN_QUOTA_REQUIRED: "Token 模式暂不可用，请切换到免费模式",
  GENERATION_SAFETY_REJECTED: "这个话题无法使用趣味技能，请回到普通聊天",
  GENERATION_OUTPUT_REJECTED: "这次回复未通过安全检查，请换个说法重试",
  MODEL_UNAVAILABLE: "AI 服务暂时不可用，请稍后重试",
  BETA_GENERATION_PAUSED: "封测生成服务暂时维护中，你仍可查看和管理已有内容。",
  BETA_PROJECT_QUOTA_EXCEEDED: "本轮封测的体验额度已用尽，生成服务将恢复后再开放。",
  BETA_TOKEN_MODE_DISABLED: "封测期间仅提供免费体验模式。",
  BETA_REGISTRATION_PAUSED: "当前封测暂不开放新的注册。",
  BETA_ADULT_ONLY: "本次封测仅面向 18 周岁及以上用户。",
  BETA_INVITE_REQUIRED: "请输入有效的邀请码。",
  BETA_INVITE_INVALID: "邀请码无效、已使用或已过期。",
  BETA_FEEDBACK_DISABLED: "反馈入口暂未开放，请稍后再试。",
  CONTACT_SKILLS_INVALID: "联系人技能配置无效，请重新选择",
  OFFICIAL_CONTACT_IMMUTABLE: "官方 AI 的配置不能修改"
};

export class OperationalApiError extends Error {
  readonly name = "OperationalApiError";

  constructor(
    readonly notice: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(notice);
  }
}

export async function authenticatedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getBrowserTokenStorage()?.read();
  if (!token) throw new OperationalApiError("登录状态已失效，请重新登录", 401);

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new OperationalApiError("网络连接失败，请检查网络后重试", 0);
  }

  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function operationalNotice(error: unknown, fallback: string): string {
  if (error instanceof OperationalApiError) return error.notice;
  return fallback;
}

export function generationRequestId(requestId?: string): string {
  const value = requestId ?? globalThis.crypto.randomUUID();
  if (!isUuid(value)) {
    throw new OperationalApiError("请求标识无效，请重试", 0, "GENERATION_REQUEST_ID_INVALID");
  }
  return value;
}

async function responseError(response: Response): Promise<OperationalApiError> {
  const body = await response.json().catch(() => null) as ApiErrorBody | null;
  const code = errorCode(body);
  const notice = (code && CODE_NOTICES[code]) ?? statusNotice(response.status);
  return new OperationalApiError(notice, response.status, code);
}

function errorCode(body: ApiErrorBody | null): string | undefined {
  if (typeof body?.code === "string") return body.code;
  return isRecord(body?.message) && typeof body.message.code === "string"
    ? body.message.code
    : undefined;
}

function statusNotice(status: number): string {
  if (status === 401 || status === 403) return "登录状态已失效，请重新登录";
  if (status === 404) return "请求的内容不存在或已被删除";
  if (status === 409) return "当前操作与已有状态冲突，请刷新后重试";
  if (status === 429) return "请求过于频繁，请稍后重试";
  if (status >= 400 && status < 500) return "提交的信息有误，请检查后重试";
  return "服务暂时不可用，请稍后重试";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type ApiErrorBody = {
  code?: unknown;
  message?: unknown;
};
