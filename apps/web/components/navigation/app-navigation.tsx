"use client";

import React from "react";

export type AppDestination = "chat" | "contacts" | "apps" | "me";

type AppNavigationProps = {
  active?: AppDestination;
  onNavigate: (destination: AppDestination) => void;
  profile?: { nickname: string };
  onLogout?: () => void;
};

const DESTINATIONS: ReadonlyArray<{ id: AppDestination; label: string; icon: string }> = [
  { id: "chat", label: "聊天", icon: "▣" },
  { id: "contacts", label: "联系人", icon: "♧" },
  { id: "apps", label: "应用", icon: "◇" },
  { id: "me", label: "我的", icon: "◎" }
];

export function AppNavigation({
  active = "chat",
  onNavigate,
  profile,
  onLogout
}: AppNavigationProps) {
  return (
    <aside className="sidebar app-navigation">
      <div className="sidebar-brand" aria-hidden="true">
        <span className="small-mark">心</span>
        <span>心屿</span>
      </div>
      <nav aria-label="主导航">
        {DESTINATIONS.map((destination) => (
          <button
            className={`nav-item ${active === destination.id ? "selected" : ""}`}
            type="button"
            aria-current={active === destination.id ? "page" : undefined}
            onClick={() => onNavigate(destination.id)}
            key={destination.id}
          >
            <span className="nav-icon" aria-hidden="true">{destination.icon}</span>
            <span>{destination.label}</span>
          </button>
        ))}
      </nav>
      {profile && onLogout && (
        <button
          className="profile"
          type="button"
          aria-label={`${profile.nickname}，退出登录`}
          onClick={onLogout}
        >
          <span className="avatar" aria-hidden="true">{profile.nickname.slice(0, 1)}</span>
          <span><b>{profile.nickname}</b><small>退出登录</small></span>
        </button>
      )}
    </aside>
  );
}
