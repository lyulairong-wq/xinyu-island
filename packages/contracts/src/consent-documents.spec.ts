import { describe, expect, it } from "vitest";
import {
  CONSENT_DOCUMENTS,
  CURRENT_CONSENT_DOCUMENT_VERSION
} from "./consent-documents.js";

describe("consent document contract", () => {
  it("publishes the required documents in registration order", () => {
    expect(CONSENT_DOCUMENTS.map((item) => item.type)).toEqual([
      "terms",
      "privacy",
      "entertainment_notice"
    ]);
    expect(CONSENT_DOCUMENTS.every((item) => (
      item.version === CURRENT_CONSENT_DOCUMENT_VERSION &&
      item.version === "1.0" &&
      item.content.length > 0
    ))).toBe(true);
  });
});
