const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const TOKEN_KEY = "vp_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function withAuthHeaders() {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function login(username, password) {
  // OAuth2PasswordRequestForm expects x-www-form-urlencoded
  const body = new URLSearchParams();
  body.append("username", username);
  body.append("password", password);

  const res = await fetch(`${API_BASE_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Login failed");
  }

  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      ...withAuthHeaders(),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch /auth/me");
  }

  return res.json();
}

export async function fetchTeams() {
  const res = await fetch(`${API_BASE_URL}/teams`, {
    headers: {
      ...withAuthHeaders(),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch teams");
  }

  return res.json();
}

export async function createTeam(team) {
  const res = await fetch(`${API_BASE_URL}/teams`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuthHeaders(),
    },
    body: JSON.stringify(team),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to create team");
  }

  return res.json();
}

