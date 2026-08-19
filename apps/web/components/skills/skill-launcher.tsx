"use client";

import React, { useState } from "react";
import type { SkillDefinition, StartSkillSessionInput } from "../../lib/skills-api";
import { SkillInputFlow, type SkillInputValues } from "./skill-input-flow";

type SkillLauncherProps = {
  skills: readonly (SkillDefinition | SkillLaunchOption)[];
  onStart: (input: Omit<StartSkillSessionInput, "mode">) => void | Promise<void>;
  disabled?: boolean;
};

export type SkillLaunchOption = {
  skill: SkillDefinition;
  targetContactId?: string;
  label?: string;
};

const SESSION_NOTICE_KEY = "xinyu-skill-notice-seen";

export function SkillLauncher({ skills, onStart, disabled = false }: SkillLauncherProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SkillLaunchOption>();
  const [showNotice, setShowNotice] = useState(false);
  const [pending, setPending] = useState(false);

  const options = skills.map((skill) => "skill" in skill ? skill : { skill });

  const choose = (option: SkillLaunchOption) => {
    setSelected(option);
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
      await onStart({ skill: selected.skill.code, ...values, ...(selected.targetContactId ? { targetContactId: selected.targetContactId } : {}) });
      setSelected(undefined);
      setShowNotice(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="skill-launcher">
      <button className="composer-plus" type="button" aria-label="更多功能" aria-expanded={open} onClick={() => setOpen((current) => !current)} disabled={disabled || skills.length === 0}>＋</button>
      {open && <div className="skill-menu" role="menu" aria-label="趣味技能">
        {options.map((option) => <button type="button" role="menuitem" key={`${option.targetContactId ?? "direct"}-${option.skill.code}`} onClick={() => choose(option)}>{option.label ?? option.skill.title}</button>)}
      </div>}
      {selected && <SkillInputFlow skill={selected.skill} notice={showNotice ? "趣味解读，仅供娱乐参考" : undefined} onSubmit={start} onCancel={() => { setSelected(undefined); setShowNotice(false); }} pending={pending} />}
    </div>
  );
}
