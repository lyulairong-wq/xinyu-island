"use client";

import React, { useState } from "react";
import type { SkillDefinition, StartSkillSessionInput } from "../../lib/skills-api";
import { SkillInputFlow, type SkillInputValues } from "./skill-input-flow";

type SkillLauncherProps = {
  skills: readonly SkillDefinition[];
  onStart: (input: Omit<StartSkillSessionInput, "mode">) => void | Promise<void>;
  disabled?: boolean;
};

const SESSION_NOTICE_KEY = "xinyu-skill-notice-seen";

export function SkillLauncher({ skills, onStart, disabled = false }: SkillLauncherProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SkillDefinition>();
  const [showNotice, setShowNotice] = useState(false);
  const [pending, setPending] = useState(false);

  const choose = (skill: SkillDefinition) => {
    setSelected(skill);
    setOpen(false);
    if (typeof window !== "undefined" && !window.sessionStorage.getItem(SESSION_NOTICE_KEY)) {
      window.sessionStorage.setItem(SESSION_NOTICE_KEY, "true");
      setShowNotice(true);
    }
  };

  const start = async (values: SkillInputValues) => {
    if (!selected) return;
    setPending(true);
    try {
      await onStart({ skill: selected.code, ...values });
      setSelected(undefined);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="skill-launcher">
      <button className="composer-plus" type="button" aria-label="更多功能" aria-expanded={open} onClick={() => setOpen((current) => !current)} disabled={disabled || skills.length === 0}>＋</button>
      {open && <div className="skill-menu" role="menu" aria-label="趣味技能">
        {skills.map((skill) => <button type="button" role="menuitem" key={skill.code} onClick={() => choose(skill)}>{skill.title}</button>)}
      </div>}
      {showNotice && <p role="status">趣味解读，仅供娱乐参考</p>}
      {selected && <SkillInputFlow skill={selected} onSubmit={start} onCancel={() => setSelected(undefined)} pending={pending} />}
    </div>
  );
}
