const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/;
const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "been-to-box",
  "dashboard",
  "login",
  "logout",
  "new-3d",
  "profile",
  "products",
  "settings",
  "sign-in",
  "sign-up",
  "travel",
  "u",
  "user",
  "users",
]);

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      reason: "Use 3-24 characters: lowercase letters, numbers, and hyphens. Start and end with a letter or number.",
      username,
    } as const;
  }

  if (RESERVED_USERNAMES.has(username)) {
    return {
      ok: false,
      reason: "That username is reserved. Try another one.",
      username,
    } as const;
  }

  return {
    ok: true,
    username,
  } as const;
}
