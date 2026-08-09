import type { AgeBand } from "@xinyu/contracts";

export const REQUIRED_CONSENT_TYPES = ["terms", "privacy", "entertainment_notice"] as const;
export const CURRENT_CONSENT_DOCUMENT_VERSION = "1.0";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSupportedAgeBand(ageBand: string): ageBand is AgeBand {
  return ["under_13", "13_15", "16_17", "18_plus", "undisclosed"].includes(ageBand);
}

export function hasRequiredConsents(consentTypes: string[]): boolean {
  return REQUIRED_CONSENT_TYPES.every((type) => consentTypes.includes(type));
}
