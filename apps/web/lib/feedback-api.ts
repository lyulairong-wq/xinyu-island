import { authenticatedRequest } from "./api-client";

export const feedbackCategories = [
  ["account", "账号与登录"],
  ["chat", "聊天与模型"],
  ["skill", "趣味技能"],
  ["privacy", "隐私与数据"],
  ["safety", "安全风险"],
  ["experience", "界面与体验"],
  ["other", "其他"]
] as const;

export type FeedbackCategory = (typeof feedbackCategories)[number][0];

export async function submitBetaFeedback(input: { category: FeedbackCategory; content: string }) {
  return authenticatedRequest<{ id: string; category: FeedbackCategory; createdAt: string }>("/me/beta-feedback", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
