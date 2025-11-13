import { useState } from "react";
import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import "./AdminLayout.css";

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * 后台常用的三段式布局：左侧是菜单，右侧是内容区域，顶部放操作按钮。
 * 移动端适配：小屏幕下侧边栏可折叠，采用移动端友好的布局。
 */
export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout-shell">
      {/* 移动端遮罩层 */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={`layout-main ${sidebarOpen ? "sidebar-open" : ""}`}>
        <Topbar
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />
        <main className="layout-content">{children}</main>
      </div>
    </div>
  );
};

