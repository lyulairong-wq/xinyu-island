// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_KEY } from "./auth-session";
import { deleteAccount, getConsentDocuments } from "./account-api";

describe("account API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("loads consent documents from the authenticated current-user endpoint", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "stored-token");
    const response = { documents: [] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getConsentDocuments()).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:4000/api/v1/me/consents");
    expect(init.method).toBeUndefined();
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer stored-token");
  });

  it("posts the password and explicit confirmation to the authenticated deletion endpoint", async () => {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, "stored-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteAccount({ password: "password123", confirmed: true })).resolves.toEqual({ success: true });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:4000/api/v1/me/account-deletion");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer stored-token");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ password: "password123", confirmed: true }));
  });
});
