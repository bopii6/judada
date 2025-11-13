import { useAuth } from "../context/AuthContext";
import "./Topbar.css";

interface TopbarProps {
  onMenuToggle?: () => void;
  sidebarOpen?: boolean;
}

export const Topbar = ({ onMenuToggle, sidebarOpen }: TopbarProps) => {
  const { logout } = useAuth();

  return (
    <header className="topbar">
      {/* 移动端菜单按钮 */}
      <button
        className="topbar-menu-btn mobile-only"
        onClick={onMenuToggle}
        aria-label={sidebarOpen ? "关闭菜单" : "打开菜单"}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      <div className="topbar-title">
        <span className="desktop-only">课程内容生成控制面板</span>
        <span className="mobile-only">控制面板</span>
      </div>

      <div className="topbar-actions">
        {/* 桌面端显示操作指引 */}
        <button className="topbar-button desktop-only" type="button" disabled>
          操作指引
        </button>
        <button className="topbar-button danger" type="button" onClick={logout}>
          <span className="desktop-only">退出登录</span>
          <span className="mobile-only">退出</span>
        </button>
      </div>
    </header>
  );
};

