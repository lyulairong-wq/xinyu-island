import type { ConsentDocument } from "@xinyu/contracts";
import { authenticatedRequest } from "./api-client";

export type ConsentDocumentWithGrant = ConsentDocument & {
  grantedAt: string;
};

export type DeleteAccountInput = {
  password: string;
  confirmed: true;
};

export function getConsentDocuments(): Promise<{ documents: ConsentDocumentWithGrant[] }> {
  return authenticatedRequest<{ documents: ConsentDocumentWithGrant[] }>("/me/consents");
}

export function deleteAccount(input: DeleteAccountInput): Promise<{ success: true }> {
  return authenticatedRequest<{ success: true }>("/me/account-deletion", {
    method: "POST",
    body: JSON.stringify(input)
  });
}
