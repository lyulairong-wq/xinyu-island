import {
  CONSENT_DOCUMENT_TYPES,
  CURRENT_CONSENT_DOCUMENT_VERSION,
  type AgeBand
} from "@xinyu/contracts";

export const REQUIRED_CONSENT_TYPES = CONSENT_DOCUMENT_TYPES;
export { CURRENT_CONSENT_DOCUMENT_VERSION };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSupportedAgeBand(ageBand: string): ageBand is AgeBand {
  return ["under_13", "13_15", "16_17", "18_plus", "undisclosed"].includes(ageBand);
}

export function hasRequiredConsents(consentTypes: string[]): boolean {
  return REQUIRED_CONSENT_TYPES.every((type) => consentTypes.includes(type));
}
