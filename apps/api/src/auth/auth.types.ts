import type { Request } from "express";

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
}

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };
