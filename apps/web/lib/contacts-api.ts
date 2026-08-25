import { authenticatedRequest } from "./api-client";

export type SkillCode = "tarot" | "mbti" | "zodiac" | "ziwei" | "meihua";

export type Contact = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  avatar: string;
  tone: string;
  type: "official" | "private";
  skills: SkillCode[];
  primarySkill?: SkillCode;
  editable: boolean;
  canDelete: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ContactMemory = {
  id: string;
  contactId: string;
  fact: string;
  sensitivity: "normal" | "sensitive";
  source: "user_explicit";
  createdAt: string;
  updatedAt: string;
};

export type ContactSkillConfiguration = {
  skillCodes: SkillCode[];
  primarySkill: SkillCode;
};

export type CreateContactInput = ContactSkillConfiguration & {
  name: string;
  tagline?: string;
  description?: string;
  tone?: string;
};

export type CreateMemoryInput = Pick<ContactMemory, "fact" | "sensitivity">;

export function listContacts(): Promise<Contact[]> {
  return authenticatedRequest<Contact[]>("/contacts");
}

export function createContact(input: CreateContactInput): Promise<Contact> {
  return authenticatedRequest<Contact>("/contacts", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateContactSkills(contactId: string, input: ContactSkillConfiguration): Promise<Contact> {
  return authenticatedRequest<Contact>(`/contacts/${encodeURIComponent(contactId)}/skills`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteContact(contactId: string): Promise<{ success: true }> {
  return authenticatedRequest<{ success: true }>(`/contacts/${encodeURIComponent(contactId)}`, {
    method: "DELETE"
  });
}

export function listContactMemories(contactId: string): Promise<ContactMemory[]> {
  return authenticatedRequest<ContactMemory[]>(`/contacts/${encodeURIComponent(contactId)}/memories`);
}

export function createContactMemory(contactId: string, input: CreateMemoryInput): Promise<ContactMemory> {
  return authenticatedRequest<ContactMemory>(`/contacts/${encodeURIComponent(contactId)}/memories`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function deleteContactMemory(memoryId: string): Promise<{ success: true }> {
  return authenticatedRequest<{ success: true }>(`/contacts/memories/${encodeURIComponent(memoryId)}`, {
    method: "DELETE"
  });
}

export function updateDefaultMemory(enabled: boolean): Promise<{ defaultMemoryEnabled: boolean }> {
  return authenticatedRequest<{ defaultMemoryEnabled: boolean }>("/contacts/settings/memory-default", {
    method: "PATCH",
    body: JSON.stringify({ enabled })
  });
}
