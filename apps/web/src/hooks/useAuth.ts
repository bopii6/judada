import { useState, useEffect } from "react";

interface User {
  id: string;
  nickname?: string;
  loginType: "device" | "admin" | "email";
  name?: string;
  role?: string;
  email?: string;
  avatarUrl?: string;
}

interface AuthData {
  user: User;
  token: string;
  expires_in?: number;
  refresh_token?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 初始化时从 localStorage 读取用户信息，若没有则创建游客
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedUser = localStorage.getItem("user");
        const storedToken = localStorage.getItem("token");

        if (storedUser && storedToken) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setToken(storedToken);
          setIsAuthenticated(true);
        } else {
          const guestId = "guest-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
          const guestUser: User = {
            id: guestId,
            nickname: "游客用户",
            loginType: "device",
            name: "Guest User"
          };
          const guestToken = btoa(
            JSON.stringify({
              id: guestId,
              type: "guest",
              timestamp: Date.now(),
              nonce: Math.random().toString(36).substr(2, 16)
            })
          );
          localStorage.setItem("user", JSON.stringify(guestUser));
          localStorage.setItem("token", guestToken);
          setUser(guestUser);
          setToken(guestToken);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("解析用户数据失败:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = (authData: AuthData) => {
    localStorage.setItem("user", JSON.stringify(authData.user));
    localStorage.setItem("token", authData.token);
    if (authData.expires_in) {
      const expiresAt = Date.now() + authData.expires_in * 1000;
      localStorage.setItem("token_expires_at", expiresAt.toString());
    }
    setUser(authData.user);
    setToken(authData.token);
    setIsAuthenticated(true);
  };

  const persistUser = (userData: User, tokenValue: string) => {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", tokenValue);
    setUser(userData);
    setToken(tokenValue);
    setIsAuthenticated(true);
  };

  const updateProfile = (payload: Partial<Pick<User, "nickname" | "avatarUrl">>) => {
    if (!user) return;
    const nextUser = { ...user, ...payload };
    persistUser(nextUser, token || localStorage.getItem("token") || "");
  };

  const setPasswordForEmail = async (email: string, password: string) => {
    const res = await fetch("/api/auth/password/set", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || localStorage.getItem("token") || ""}`
      },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || "设置密码失败");
    }
    return true;
  };

  const loginWithPassword = async (email: string, password: string) => {
    const res = await fetch("/api/auth/password/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      throw new Error(body?.message || "邮箱或密码错误");
    }
    login({ user: body.user, token: body.token });
    return true;
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("token_expires_at");
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
  };

  const checkTokenExpiry = () => {
    try {
      const expiresAt = localStorage.getItem("token_expires_at");
      if (expiresAt) {
        const expiryTime = parseInt(expiresAt, 10);
        if (Date.now() > expiryTime) {
          logout();
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("检查token过期时间失败:", error);
      return false;
    }
  };

  const getUserAvatar = () => {
    if (user?.avatarUrl) return user.avatarUrl;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.nickname || user?.email || "User")}&background=10b981&color=fff`;
  };

  const getUserDisplayName = () => {
    return user?.nickname || user?.name || user?.email || "未知用户";
  };

  const isAdmin = () => {
    return user?.role === "admin" || user?.loginType === "admin";
  };

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    logout,
    updateProfile,
    setPasswordForEmail,
    loginWithPassword,
    checkTokenExpiry,
    getUserAvatar,
    getUserDisplayName,
    isAdmin
  };
};
