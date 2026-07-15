export function getAuthToken(): string | null {
  return localStorage.getItem("scopebot_token");
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
