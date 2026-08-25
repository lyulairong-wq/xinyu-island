import React from "react";

const APP_ENTRIES = [
  {
    id: "life-mirror",
    title: "人生镜像副本",
    description: "探索虚构人生分支的入口将在独立模块中提供。"
  },
  {
    id: "themed-events",
    title: "主题活动",
    description: "阶段性娱乐互动的入口将在独立模块中提供。"
  }
] as const;

export function AppsHome() {
  return (
    <div className="module-page apps-home">
      <p className="module-intro">这里展示可进入的独立体验。当前仅提供入口与开发状态。</p>
      <div className="app-launch-grid">
        {APP_ENTRIES.map((entry) => (
          <article className="app-launch-card" key={entry.id}>
            <span className="app-status">后续模块开发</span>
            <h3>{entry.title}</h3>
            <p>{entry.description}</p>
            <button type="button" disabled>暂未开放</button>
          </article>
        ))}
      </div>
    </div>
  );
}
