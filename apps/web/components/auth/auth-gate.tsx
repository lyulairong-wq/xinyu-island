"use client";

import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, getCurrentUser, type AuthUser } from "../../lib/auth-api";
import { getBrowserTokenStorage, type TokenStorage } from "../../lib/auth-session";

type AuthGateProps = {
  anonymous: ReactNode;
  authenticated: (user: AuthUser) => ReactNode;
  loading?: ReactNode;
  loadUser?: (token: string) => Promise<AuthUser>;
  storage?: Pick<TokenStorage, "read" | "clear"> | null;
  onAuthenticated?: (user: AuthUser) => void;
};

type AuthState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "error"; message: string }
  | { kind: "authenticated"; user: AuthUser };

export function AuthGate({
  anonymous,
  authenticated,
  loading = <div aria-live="polite" role="status" />,
  loadUser = getCurrentUser,
  storage: injectedStorage,
  onAuthenticated
}: AuthGateProps) {
  const browserStorage = useMemo(() => getBrowserTokenStorage(), []);
  const storage = injectedStorage ?? browserStorage;
  const [state, setState] = useState<AuthState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const token = storage?.read();
    if (!token) {
      setState({ kind: "anonymous" });
      return;
    }

    let active = true;
    void loadUser(token)
      .then((user) => {
        if (!active) return;
        setState({ kind: "authenticated", user });
        onAuthenticated?.(user);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isInvalidAuthenticationResponse(error)) {
          storage?.clear();
          setState({ kind: "anonymous" });
          return;
        }
        setState({ kind: "error", message: temporaryFailureMessage(error) });
      });

    return () => {
      active = false;
    };
  }, [attempt, loadUser, onAuthenticated, storage]);

  if (state.kind === "loading") return loading;
  if (state.kind === "anonymous") return anonymous;
  if (state.kind === "error") {
    return <div role="alert">
      <p>{state.message}</p>
      <button type="button" onClick={() => {
        setState({ kind: "loading" });
        setAttempt((currentAttempt) => currentAttempt + 1);
      }}>重试</button>
    </div>;
  }
  return authenticated(state.user);
}

function isInvalidAuthenticationResponse(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

function temporaryFailureMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "暂时无法验证登录状态，请重试";
}
