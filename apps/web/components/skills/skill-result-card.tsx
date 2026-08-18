"use client";

import React from "react";
import type { SkillCard } from "../../lib/skills-api";

type SkillResultCardProps = {
  card: SkillCard;
  onRemember?: () => void | Promise<void>;
  remembering?: boolean;
};

export function SkillResultCard({ card, onRemember, remembering = false }: SkillResultCardProps) {
  return (
    <aside className="skill-result-card" aria-label={`${card.title}趣味解读`}>
      <span>{card.title}</span>
      <p>{card.summary}</p>
      <small>{card.disclaimer}</small>
      {onRemember && <button type="button" onClick={() => void onRemember()} disabled={remembering}>{remembering ? "正在保存…" : "记住此信息"}</button>}
    </aside>
  );
}
