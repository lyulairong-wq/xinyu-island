"use client";

import React, { useState } from "react";
import { operationalNotice } from "../../lib/api-client";
import { createGroup, type CreateGroupResult } from "../../lib/chat-api";
import {
  createContact,
  deleteContact,
  updateContact,
  type Contact,
  type CreateContactInput,
  type UpdateContactInput
} from "../../lib/contacts-api";
import { ContactEditor, type ContactProfileDraft } from "./contact-editor";
import { GroupCreator } from "./group-creator";

type ContactsHomeProps = {
  contacts: Contact[];
  onOpenContact: (contact: Contact) => void | Promise<void>;
  onGroupCreated: (group: CreateGroupResult) => void;
  onContactsChange: () => void | Promise<void>;
  createPrivate?: (input: CreateContactInput) => Promise<Contact>;
  updatePrivate?: (contactId: string, input: UpdateContactInput) => Promise<Contact>;
  removePrivate?: (contactId: string, input: { deleteConversations?: boolean; deleteMemories?: boolean }) => Promise<{ success: true }>;
  createDiscussionGroup?: (contactIds: string[]) => Promise<CreateGroupResult>;
};

export function ContactsHome({
  contacts,
  onOpenContact,
  onGroupCreated,
  onContactsChange,
  createPrivate = createContact,
  updatePrivate = updateContact,
  removePrivate = deleteContact,
  createDiscussionGroup = createGroup
}: ContactsHomeProps) {
  const [surface, setSurface] = useState<"editor" | "group" | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Contact | null>(null);
  const [deleteConversations, setDeleteConversations] = useState(false);
  const [deleteMemories, setDeleteMemories] = useState(false);
  const [notice, setNotice] = useState("");
  const official = contacts.filter((contact) => contact.type === "official");
  const privateContacts = contacts.filter((contact) => contact.type === "private");

  const open = async (contact: Contact) => {
    setNotice("");
    try {
      await onOpenContact(contact);
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法打开对话"));
    }
  };

  const create = async (draft: ContactProfileDraft) => {
    setNotice("");
    try {
      await createPrivate(draft);
      await onContactsChange();
      setSurface(null);
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法创建联系人"));
    }
  };

  const update = async (draft: ContactProfileDraft) => {
    if (!editing) return;
    try { await updatePrivate(editing.id, draft); await onContactsChange(); setEditing(null); }
    catch (error) { setNotice(operationalNotice(error, "暂时无法更新联系人")); }
  };

  const remove = async (contact: Contact) => {
    setNotice("");
    try {
      await removePrivate(contact.id, { deleteConversations, deleteMemories });
      await onContactsChange();
      setDeleteCandidate(null);
      setDeleteConversations(false);
      setDeleteMemories(false);
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法删除联系人"));
    }
  };

  const createGroupFrom = async (contactIds: string[]) => {
    setNotice("");
    try {
      const group = await createDiscussionGroup(contactIds);
      onGroupCreated(group);
      setSurface(null);
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法创建讨论组"));
    }
  };

  return (
    <div className="module-page contacts-home">
      <div className="module-toolbar">
        <p>点击联系人即可开始或继续聊天。</p>
        <div className="toolbar-actions">
          <button className="quiet-button" type="button" onClick={() => setSurface("editor")}>新建私有 AI</button>
          <button className="quiet-button" type="button" onClick={() => setSurface("group")}>创建讨论组</button>
        </div>
      </div>
      {notice && <p className="form-message" role="status">{notice}</p>}
      {surface === "editor" && <ContactEditor onCreate={create} onCancel={() => setSurface(null)} />}
      {editing && <ContactEditor contact={editing} onCreate={update} onCancel={() => setEditing(null)} submitLabel="保存修改" />}
      {surface === "group" && <GroupCreator contacts={contacts} onCreate={createGroupFrom} onCancel={() => setSurface(null)} />}
      <ContactSection title="官方 AI" contacts={official} onOpen={open} onDeleteCandidate={setDeleteCandidate} onEdit={setEditing} />
      <ContactSection title="我的 AI" contacts={privateContacts} onOpen={open} onDeleteCandidate={setDeleteCandidate} onEdit={setEditing} empty="还没有私有 AI 联系人。" />
      {deleteCandidate && (
        <div className="confirmation-panel" role="alertdialog" aria-label={`删除 ${deleteCandidate.name}`}>
          <p>确定删除“{deleteCandidate.name}”吗？相关设置将不可恢复。</p>
          <label><input type="checkbox" checked={deleteConversations} onChange={(event) => setDeleteConversations(event.target.checked)} />同时删除与该 AI 的单聊记录</label>
          <label><input type="checkbox" checked={deleteMemories} onChange={(event) => setDeleteMemories(event.target.checked)} />同时删除该 AI 的长期记忆</label>
          <p>未勾选的数据会保留在“我的 → 数据与隐私 → 已删除 AI 记录”中，仅可查看或彻底删除。</p>
          <div className="form-actions">
            <button className="quiet-button" type="button" onClick={() => { setDeleteCandidate(null); setDeleteConversations(false); setDeleteMemories(false); }}>取消</button>
            <button className="danger-button" type="button" onClick={() => void remove(deleteCandidate)}>确认删除</button>
          </div>
        </div>
      )}
    </div>
  );
}
function ContactSection({ title, contacts, onOpen, onDeleteCandidate, onEdit, empty }: {
  title: string;
  contacts: Contact[];
  onOpen: (contact: Contact) => void | Promise<void>;
  onDeleteCandidate: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  empty?: string;
}) {
  const sectionId = title === "官方 AI" ? "official-contacts" : "private-contacts";
  return (
    <section className="contact-section" aria-labelledby={sectionId}>
      <h3 id={sectionId}>{title}</h3>
      {contacts.length === 0 && <p className="contact-empty">{empty}</p>}
      <div className="contact-list">
        {contacts.map((contact) => (
          <article className="contact-row" key={contact.id}>
            <button className="contact-main-action" type="button" onClick={() => void onOpen(contact)} aria-label={`与${contact.name}聊天`}>
              <span className="contact-avatar" aria-hidden="true">{contact.avatar}</span>
              <span className="contact-row-copy">
                <b>{contact.name}</b>
                <small>{contact.tagline}</small>
                <span>{contact.description}</span>
              </span>
            </button>
            {contact.editable && <button className="text-button" type="button" onClick={() => onEdit(contact)}>编辑</button>}
            {contact.canDelete && <button className="text-button" type="button" onClick={() => onDeleteCandidate(contact)}>删除</button>}
          </article>
        ))}
      </div>
    </section>
  );
}
