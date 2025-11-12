import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import "./AdminLayout.css";

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * 后台常用的三段式布局：左侧是菜单，右侧是内容区域，顶部放操作按钮。
 * 这样既能帮助运营同学快速定位功能，也方便后续新增模块时仅调整菜单即可。
 */
export const AdminLayout = ({ children }: AdminLayoutProps) => (
  <div className="layout-shell">
    <Sidebar />
    <div className="layout-main">
      <Topbar />
      <main className="layout-content">{children}</main>
    </div>
  </div>
);

