import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export interface AuthUser {
  id: string;
  name: string;
  role: "operator" | "reviewer" | "admin";
}

interface AuthState {
  user: AuthUser | null;
  adminKey: string | null;
}

interface AuthContextValue extends AuthState {
  login: (payload: { name: string; adminKey: string }) => void;
  logout: () => void;
}

export const AUTH_STORAGE_KEY = "admin-auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const loadInitialState = (): AuthState => {
  if (typeof window === "undefined") {
    return { user: null, adminKey: null };
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { user: null, adminKey: null };
    const parsed = JSON.parse(raw) as AuthState;
    return {
      user: parsed.user ?? null,
      adminKey: parsed.adminKey ?? null
    };
  } catch (error) {
    console.warn("读取本地登录信息失败，将重新登录。", error);
    return { user: null, adminKey: null };
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>(loadInitialState);

  const value = useMemo<AuthContextValue>(() => {
    const persist = (next: AuthState) => {
      setState(next);
      if (typeof window === "undefined") return;
      if (next.user && next.adminKey) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    };

    return {
      user: state.user,
      adminKey: state.adminKey,
      login: ({ name, adminKey }) => {
        const user: AuthUser = {
          id: "demo-user",
          name,
          role: "admin"
        };
        persist({ user, adminKey });
      },
      logout: () => persist({ user: null, adminKey: null })
    };
  }, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }
  return context;
};

