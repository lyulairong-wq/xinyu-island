import { describe, expect, it } from "vitest";
import { CONSENT_DOCUMENT_TYPES, CURRENT_CONSENT_DOCUMENT_VERSION } from "@xinyu/contracts";
import { CURRENT_CONSENT_DOCUMENT_VERSION as policyDocumentVersion, hasRequiredConsents, isSupportedAgeBand, normalizeEmail, REQUIRED_CONSENT_TYPES } from "./auth.policy";

describe("auth policy", () => {
  it("normalizes email addresses for account identity", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
  });

  it("accepts only the defined age bands", () => {
    expect(isSupportedAgeBand("18_plus")).toBe(true);
    expect(isSupportedAgeBand("unknown")).toBe(false);
  });

  it("requires all first-entry documents", () => {
    expect(hasRequiredConsents(["terms", "privacy", "entertainment_notice"])).toBe(true);
    expect(hasRequiredConsents(["terms", "privacy"])).toBe(false);
  });

  it("does not let repeated consent types replace a required document", () => {
    expect(hasRequiredConsents(["terms", "terms", "privacy"])).toBe(false);
  });

  it("uses the shared consent catalog and document version", () => {
    expect(REQUIRED_CONSENT_TYPES).toEqual(CONSENT_DOCUMENT_TYPES);
    expect(policyDocumentVersion).toBe(CURRENT_CONSENT_DOCUMENT_VERSION);
  });
});
