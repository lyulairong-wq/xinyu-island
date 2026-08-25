import { authenticatedRequest } from "./api-client";

export type UsageSummary = {
  free: {
    limit: number;
    used: number;
    remaining: number;
    resetAt: string;
  };
  token: {
    paidBalance: number;
  };
};

export function getUsageSummary(): Promise<UsageSummary> {
  return authenticatedRequest<UsageSummary>("/usage");
}
