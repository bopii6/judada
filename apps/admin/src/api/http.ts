import { AUTH_STORAGE_KEY } from "../context/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const getAdminKey = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { adminKey?: string };
    return parsed.adminKey ?? null;
  } catch (error) {
    console.warn("解析管理员密钥失败，请重新登录后台", error);
    return null;
  }
};

const buildHeaders = (input?: HeadersInit): Headers => {
  const headers = new Headers(input);
  const adminKey = getAdminKey();
  if (adminKey) headers.set("x-admin-key", adminKey);
  return headers;
};

const isFormDataBody = (body: RequestInit["body"]): body is FormData =>
  typeof FormData !== "undefined" && body instanceof FormData;

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = buildHeaders(init.headers);
  const bodyIsFormData = isFormDataBody(init.body);

  if (init.body && !headers.has("Content-Type") && !bodyIsFormData) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    let message = "请求失败，请稍后重试";
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch (error) {
      // ignore json parse error
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
