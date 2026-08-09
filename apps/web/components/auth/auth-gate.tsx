"use client";

import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentUser, type AuthUser } from "../../lib/auth-api";
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
      .catch(() => {
        if (!active) return;
        storage?.clear();
        setState({ kind: "anonymous" });
      });

    return () => {
      active = false;
    };
  }, [loadUser, onAuthenticated, storage]);

  if (state.kind === "loading") return loading;
  if (state.kind === "anonymous") return anonymous;
  return authenticated(state.user);
}
