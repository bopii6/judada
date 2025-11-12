import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Sidebar.css";

const links = [
  { to: "/dashboard", label: "工作台总览" },
  { to: "/packages", label: "课程包管理" },
  { to: "/jobs", label: "生成任务监控" }
];

export const Sidebar = () => {
  const { user } = useAuth();
  return (
    <aside className="sidebar">
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
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

