export const ACCESS_TOKEN_KEY = "xinyu_access_token";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type TokenStorage = {
  read(): string | null;
  write(token: string): void;
  clear(): void;
};

export function createTokenStorage(storage: StorageLike): TokenStorage {
  return {
    read: () => storage.getItem(ACCESS_TOKEN_KEY),
    write: (token) => storage.setItem(ACCESS_TOKEN_KEY, token),
    clear: () => storage.removeItem(ACCESS_TOKEN_KEY)
  };
}

export function getBrowserTokenStorage(): TokenStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return createTokenStorage(window.localStorage);
  } catch {
    return null;
  }
}
