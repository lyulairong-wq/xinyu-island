"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { operationalNotice } from "../../lib/api-client";
import {
  createContactMemory,
  deleteContactMemory,
  listContactMemories,
  type Contact,
  type ContactMemory,
  type CreateMemoryInput
} from "../../lib/contacts-api";

type MemoryManagerProps = {
  contacts: Contact[];
  loadMemories?: (contactId: string) => Promise<ContactMemory[]>;
  createMemory?: (contactId: string, input: CreateMemoryInput) => Promise<ContactMemory>;
  deleteMemory?: (memoryId: string) => Promise<{ success: true }>;
};

export function MemoryManager({
  contacts,
  loadMemories = listContactMemories,
  createMemory = createContactMemory,
  deleteMemory = deleteContactMemory
}: MemoryManagerProps) {
  const [contactId, setContactId] = useState(contacts[0]?.id ?? "");
  const [memories, setMemories] = useState<ContactMemory[]>([]);
  const [fact, setFact] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!contacts.some((contact) => contact.id === contactId)) {
      setContactId(contacts[0]?.id ?? "");
    }
  }, [contactId, contacts]);

  useEffect(() => {
    if (!contactId) {
      setMemories([]);
      return;
    }

    let active = true;
    setNotice("");
    void loadMemories(contactId)
      .then((loaded) => {
        if (active) setMemories(loaded);
      })
      .catch((error: unknown) => {
        if (active) setNotice(operationalNotice(error, "暂时无法加载记忆"));
      });
    return () => { active = false; };
  }, [contactId, loadMemories]);

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedFact = fact.trim();
    if (!contactId || !trimmedFact) return;

    try {
      const created = await createMemory(contactId, { fact: trimmedFact, sensitivity: "normal" });
      setMemories((current) => [created, ...current]);
      setFact("");
      setNotice("");
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法保存记忆"));
    }
  };

  const remove = async (memory: ContactMemory) => {
    const confirmed = window.confirm("确认删除这条记忆吗？删除后，它将不再参与这个联系人的未来对话。");
    if (!confirmed) return;

    try {
      await deleteMemory(memory.id);
      setMemories((current) => current.filter((item) => item.id !== memory.id));
      setNotice("");
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法删除记忆"));
    }
  };

  if (contacts.length === 0) {
    return <p className="conversation-empty">还没有可管理记忆的联系人。</p>;
  }

  return (
    <div className="memory-manager">
      <label className="select-label">
        查看联系人记忆
        <select value={contactId} onChange={(event) => setContactId(event.target.value)}>
          {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
        </select>
      </label>
      <form className="memory-form" onSubmit={add}>
        <input
          value={fact}
          onChange={(event) => setFact(event.target.value)}
          placeholder="添加一条明确的长期记忆"
          maxLength={300}
        />
        <button className="primary-button" type="submit">保存</button>
      </form>
      {notice && <p className="form-message" role="status">{notice}</p>}
      <div className="memory-list">
        {memories.map((memory) => (
          <div className="memory-row" key={memory.id}>
            <span aria-hidden="true">◌</span>
            <p>{memory.fact}</p>
            <small>{memory.sensitivity === "sensitive" ? "敏感" : "普通"}</small>
            <button
              className="text-button"
              type="button"
              aria-label={`删除记忆：${memory.fact}`}
              onClick={() => void remove(memory)}
            >删除</button>
          </div>
        ))}
        {memories.length === 0 && <p className="conversation-empty">这个联系人还没有已保存的记忆。</p>}
      </div>
    </div>
  );
}
