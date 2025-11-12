import { useAuth } from "../context/AuthContext";
import "./Topbar.css";

export const Topbar = () => {
  const { logout } = useAuth();

  return (
    <header className="topbar">
      <div className="topbar-title">课程内容生成控制面板</div>
      <div className="topbar-actions">
        <button className="topbar-button" type="button" disabled>
          操作指引
        </button>
        <button className="topbar-button danger" type="button" onClick={logout}>
          退出登录
        </button>
      </div>
    </header>
  );
};

