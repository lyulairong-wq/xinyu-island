import { describe, expect, it, vi } from "vitest";
import { ContactsController } from "./contacts.controller";

describe("ContactsController skill configuration", () => {
  it("forwards the authenticated owner, contact id, and approved configuration to the PATCH service", async () => {
    const contacts = {
      updateSkills: vi.fn(async () => ({
        id: "private-1",
        type: "private",
        skills: ["tarot"],
        primarySkill: "tarot",
        editable: true
      }))
    };
    const controller = new ContactsController(contacts as never);
    const input = { skillCodes: ["tarot"], primarySkill: "tarot" } as const;

    await expect((controller as any).updateSkills({ id: "user-1" }, "private-1", input)).resolves.toMatchObject({
      id: "private-1",
      editable: true
    });
    expect(contacts.updateSkills).toHaveBeenCalledWith("user-1", "private-1", input);
  });
});
