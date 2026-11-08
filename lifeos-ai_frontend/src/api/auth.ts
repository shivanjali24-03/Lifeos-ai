
const API_URL = "http://localhost:5000/api";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
};

type SignupData = {
  name: string;
  email: string;
  password: string;
};

type LoginData = {
  email: string;
  password: string;
};

async function authRequest(
  endpoint: string,
  data: SignupData | LoginData
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ?? `Request failed with status ${response.status}`
    );
  }

  return result as AuthResponse;
}

export function signup(data: SignupData): Promise<AuthResponse> {
  return authRequest("/auth/signup", data);
}

export function login(data: LoginData): Promise<AuthResponse> {
  return authRequest("/auth/login", data);
}
