"use client";

import React, { FormEvent, useState } from "react";
import type { Contact } from "../../lib/contacts-api";

type GroupCreatorProps = {
  contacts: Contact[];
  onCreate: (contactIds: string[]) => void | Promise<void>;
  onCancel?: () => void;
};

export function GroupCreator({ contacts, onCreate, onCancel }: GroupCreatorProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = (contactId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (!checked) return current.filter((id) => id !== contactId);
      if (current.includes(contactId) || current.length >= 3) return current;
      return [...current, contactId];
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedIds.length < 2 || selectedIds.length > 3) return;
    void onCreate(selectedIds.slice(0, 3));
  };

  return (
    <form className="group-creator" onSubmit={submit} aria-label="创建讨论组">
      <div>
        <h3>创建讨论组</h3>
        <p>按选择顺序邀请 2–3 位 AI 联系人。</p>
      </div>
      <div className="group-contact-options">
        {contacts.map((contact) => {
          const checked = selectedIds.includes(contact.id);
          const capped = !checked && selectedIds.length >= 3;
          return (
            <label className={capped ? "disabled" : ""} key={contact.id}>
              <input
                type="checkbox"
                checked={checked}
                disabled={capped}
                onChange={(event) => toggle(contact.id, event.target.checked)}
              />
              <span className="contact-avatar" aria-hidden="true">{contact.avatar}</span>
              <span>{contact.name}</span>
            </label>
          );
        })}
      </div>
      <p className="selection-count" aria-live="polite">已选择 {selectedIds.length} / 3</p>
      <div className="form-actions">
        {onCancel && <button className="quiet-button" type="button" onClick={onCancel}>取消</button>}
        <button className="primary-button" type="submit" disabled={selectedIds.length < 2}>创建讨论组</button>
      </div>
    </form>
  );
}
