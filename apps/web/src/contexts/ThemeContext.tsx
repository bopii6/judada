import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // 从localStorage读取，如果没有则使用系统偏好
    if (typeof window !== "undefined") {
      // 优先读取新的键名，如果没有则读取旧的键名（兼容性）
      const saved = localStorage.getItem("theme") as Theme | null;
      const oldSaved = localStorage.getItem("judada:theme") as Theme | null;
      let initialTheme: Theme = "light";
      
      if (saved && (saved === "light" || saved === "dark")) {
        initialTheme = saved;
      } else if (oldSaved && (oldSaved === "light" || oldSaved === "dark")) {
        // 迁移到新的键名
        localStorage.setItem("theme", oldSaved);
        localStorage.removeItem("judada:theme");
        initialTheme = oldSaved;
      } else {
        // 检查系统偏好
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
          initialTheme = "dark";
        }
      }
      
      // 立即应用主题，避免闪烁
      const root = document.documentElement;
      if (initialTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      
      return initialTheme;
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      // 只有在用户没有手动设置过主题时才跟随系统
      if (!localStorage.getItem("theme")) {
        setThemeState(e.matches ? "dark" : "light");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    setThemeState(prev => (prev === "light" ? "dark" : "light"));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

