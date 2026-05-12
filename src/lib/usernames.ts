const USERNAME_PATTERN = /^[a-z0-9-]{3,24}$/;
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
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      reason: username.length < 3 ? "Username must be at least 3 characters." : "Invalid username.",
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
