// Auth utilities for the frontend

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
const TOKEN_KEY = 'autobio_token';
const USER_KEY = 'autobio_user';

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Get stored token
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

// Get stored user
export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userJson = localStorage.getItem(USER_KEY);
  return userJson ? JSON.parse(userJson) : null;
}

// Store auth data
export function setAuth(data: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

// Clear auth data
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Check if authenticated
export function isAuthenticated(): boolean {
  return !!getToken();
}

// Sign up
export async function signup(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Signup failed');
  }

  setAuth(data);
  return data;
}

// Login
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Login failed');
  }

  setAuth(data);
  return data;
}

// Get dev token (for development only)
export async function getDevToken(): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to get dev token');
  }

  setAuth(data);
  return data;
}

// Logout
export function logout(): void {
  clearAuth();
  window.location.href = '/';
}

// OAuth - Get Google auth URL
export async function getGoogleAuthUrl(redirectUri: string): Promise<{ url: string; state: string }> {
  const response = await fetch(`${API_URL}/auth/oauth/google?redirect_uri=${encodeURIComponent(redirectUri)}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to get Google auth URL');
  }

  return data;
}

// OAuth - Exchange Google code for token
export async function googleCallback(code: string, redirectUri: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/oauth/google/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Google authentication failed');
  }

  setAuth(data);
  return data;
}

// OAuth - Get Apple auth URL
export async function getAppleAuthUrl(redirectUri: string): Promise<{ url: string; state: string }> {
  const response = await fetch(`${API_URL}/auth/oauth/apple?redirect_uri=${encodeURIComponent(redirectUri)}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to get Apple auth URL');
  }

  return data;
}

// OAuth - Exchange Apple code for token
export async function appleCallback(code: string, redirectUri: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/oauth/apple/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Apple authentication failed');
  }

  setAuth(data);
  return data;
}

// Authenticated fetch helper
export async function authFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');

  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
}
