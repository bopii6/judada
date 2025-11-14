import { useState, useEffect } from 'react';

interface User {
  id: string;
  nickname?: string;
  loginType: 'device' | 'admin';
  name?: string;
  role?: string;
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

  // 初始化时从 localStorage 读取用户信息，如果没有则创建游客用户
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedToken = localStorage.getItem('token');

        if (storedUser && storedToken) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
          setToken(storedToken);
          setIsAuthenticated(true);
        } else {
          // 如果没有用户信息，自动创建游客用户
          const guestUser = {
            id: 'guest-user',
            nickname: '游客用户',
            loginType: 'device' as const,
            name: 'Guest User'
          };

          const authData = {
            user: guestUser,
            token: 'guest-token-' + Date.now()
          };

          // 自动保存到localStorage
          localStorage.setItem('user', JSON.stringify(guestUser));
          localStorage.setItem('token', authData.token);

          setUser(guestUser);
          setToken(authData.token);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('解析用户数据失败:', error);
        // 清理无效数据
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // 登录函数
  const login = (authData: AuthData) => {
    try {
      localStorage.setItem('user', JSON.stringify(authData.user));
      localStorage.setItem('token', authData.token);

      if (authData.expires_in) {
        const expiresAt = Date.now() + authData.expires_in * 1000;
        localStorage.setItem('token_expires_at', expiresAt.toString());
      }

      setUser(authData.user);
      setToken(authData.token);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('保存登录信息失败:', error);
      throw error;
    }
  };

  // 退出登录
  const logout = () => {
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('token_expires_at');

      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  };

  // 检查token是否过期
  const checkTokenExpiry = () => {
    try {
      const expiresAt = localStorage.getItem('token_expires_at');
      if (expiresAt) {
        const expiryTime = parseInt(expiresAt, 10);
        if (Date.now() > expiryTime) {
          logout();
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('检查token过期时间失败:', error);
      return false;
    }
  };

  // 获取用户头像
  const getUserAvatar = () => {
    // 默认头像
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.nickname || 'User')}&background=10b981&color=fff`;
  };

  // 获取用户显示名称
  const getUserDisplayName = () => {
    return user?.nickname || user?.name || '未知用户';
  };

  
  // 检查是否为管理员
  const isAdmin = () => {
    return user?.role === 'admin' || user?.loginType === 'admin';
  };

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    logout,
    checkTokenExpiry,
    getUserAvatar,
    getUserDisplayName,
    isAdmin
  };
};