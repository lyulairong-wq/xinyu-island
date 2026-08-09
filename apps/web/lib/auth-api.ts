const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type AuthUser = {
  id: string;
  nickname: string;
  email: string;
  ageBand: string;
  status: string;
  createdAt: string;
};

export type AuthSession = {
  accessToken: string;
  sessionId: string;
  user: AuthUser;
  requiredConsentTypes: string[];
};

export type LoginInput = {
  email: string;
  password: string;
  deviceLabel: string;
};

export type RegisterInput = LoginInput & {
  nickname: string;
  ageBand: string;
  consents: Array<{ type: string; version: string }>;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  return request<AuthSession>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function login(input: LoginInput): Promise<AuthSession> {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  return request<AuthUser>("/me", { headers: { Authorization: `Bearer ${token}` } });
}

export async function logout(token: string): Promise<void> {
  await request<unknown>("/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError("网络连接失败，请检查网络后重试", 0);
  }

  if (!response.ok) throw await toApiError(response);
  return response.json() as Promise<T>;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : undefined;
  return new ApiError(userSafeMessage(response.status), response.status, code);
}

function userSafeMessage(status: number): string {
  if (status === 401) return "邮箱或密码不正确";
  if (status === 403) return "当前会话已失效，请重新登录";
  if (status >= 400 && status < 500) return "提交的信息有误，请检查后重试";
  return "服务暂时不可用，请稍后重试";
}
