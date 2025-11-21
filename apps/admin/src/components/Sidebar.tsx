import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Sidebar.css";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const links = [
  { to: "/dashboard", label: "工作台总览" },
  { to: "/packages", label: "课程包管理" },
  { to: "/music", label: "音乐包管理" },
  { to: "/jobs", label: "生成任务监控" }
];

export const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
  const { user } = useAuth();

  return (
    <>
      {/* 移动端遮罩层 */}
      {isOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        {/* 移动端关闭按钮 */}
        <button
          className="sidebar-close-btn mobile-only"
          onClick={onClose}
          aria-label="关闭侧边栏"
        >
          ✕
        </button>

        <div className="sidebar-header">
          <span className="sidebar-brand">课程管理后台</span>
          {user && <span className="sidebar-user">你好，{user.name}</span>}
        </div>

        <nav className="sidebar-nav">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
              onClick={() => {
                // 移动端点击链接后关闭侧边栏
                if (window.innerWidth <= 768 && onClose) {
                  onClose();
                }
              }}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* 移动端底部占位 */}
        <div className="sidebar-footer mobile-only">
          <div className="sidebar-footer-content">
            <p>© 2024 Jude English Lab</p>
            <p className="text-xs">管理后台移动版</p>
          </div>
        </div>
      </aside>
    </>
  );
};

