"use client";

import React, { useState } from "react";
import { operationalNotice } from "../../lib/api-client";
import { createGroup, type CreateGroupResult } from "../../lib/chat-api";
import {
  createContact,
  deleteContact,
  type Contact,
  type CreateContactInput
} from "../../lib/contacts-api";
import { ContactEditor, type ContactProfileDraft } from "./contact-editor";
import { GroupCreator } from "./group-creator";

type ContactsHomeProps = {
  contacts: Contact[];
  onOpenContact: (contact: Contact) => void | Promise<void>;
  onGroupCreated: (group: CreateGroupResult) => void;
  onContactsChange: () => void | Promise<void>;
  createPrivate?: (input: CreateContactInput) => Promise<Contact>;
  removePrivate?: (contactId: string) => Promise<{ success: true }>;
  createDiscussionGroup?: (contactIds: string[]) => Promise<CreateGroupResult>;
};

export function ContactsHome({
  contacts,
  onOpenContact,
  onGroupCreated,
  onContactsChange,
  createPrivate = createContact,
  removePrivate = deleteContact,
  createDiscussionGroup = createGroup
}: ContactsHomeProps) {
  const [surface, setSurface] = useState<"editor" | "group" | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Contact | null>(null);
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
      await createPrivate(withTaskFiveSkillDefault(draft));
      await onContactsChange();
      setSurface(null);
    } catch (error) {
      setNotice(operationalNotice(error, "暂时无法创建联系人"));
    }
  };

  const remove = async (contact: Contact) => {
    setNotice("");
    try {
      await removePrivate(contact.id);
      await onContactsChange();
      setDeleteCandidate(null);
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
      {surface === "group" && <GroupCreator contacts={contacts} onCreate={createGroupFrom} onCancel={() => setSurface(null)} />}
      <ContactSection title="官方 AI" contacts={official} onOpen={open} onDeleteCandidate={setDeleteCandidate} />
      <ContactSection title="我的 AI" contacts={privateContacts} onOpen={open} onDeleteCandidate={setDeleteCandidate} empty="还没有私有 AI 联系人。" />
      {deleteCandidate && (
        <div className="confirmation-panel" role="alertdialog" aria-label={`删除 ${deleteCandidate.name}`}>
          <p>确定删除“{deleteCandidate.name}”吗？相关设置将不可恢复。</p>
          <div className="form-actions">
            <button className="quiet-button" type="button" onClick={() => setDeleteCandidate(null)}>取消</button>
            <button className="danger-button" type="button" onClick={() => void remove(deleteCandidate)}>确认删除</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactSection({ title, contacts, onOpen, onDeleteCandidate, empty }: {
  title: string;
  contacts: Contact[];
  onOpen: (contact: Contact) => void | Promise<void>;
  onDeleteCandidate: (contact: Contact) => void;
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
            {contact.canDelete && <button className="text-button" type="button" onClick={() => onDeleteCandidate(contact)}>删除</button>}
          </article>
        ))}
      </div>
    </section>
  );
}

function withTaskFiveSkillDefault(draft: ContactProfileDraft): CreateContactInput {
  return {
    ...draft,
    skillCodes: ["tarot"],
    primarySkill: "tarot"
  };
}
