import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, Menu, LogIn, LayoutDashboard, BookOpen, UserRound } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const links = [
  { to: "/", label: "总览", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/courses", label: "课程", icon: <BookOpen className="h-4 w-4" /> },
  { to: "/profile", label: "我的", icon: <UserRound className="h-4 w-4" /> }
];

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, logout, getUserAvatar, getUserDisplayName } = useAuth();

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50">
      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-68 bg-white/90 backdrop-blur border-r border-slate-200 shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/70">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Jude English</p>
            <h1 className="mt-1 text-lg font-bold text-slate-900">Learning Studio</h1>
          </div>
          <button
            className="lg:hidden text-slate-500 hover:text-slate-700"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭菜单"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col px-4 py-6 text-sm font-medium text-slate-700">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-4 py-3 mb-2 transition ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm"
                    : "hover:bg-slate-100"
                }`
              }
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-[.active]:bg-indigo-100">
                {link.icon}
              </span>
              <span className="text-sm font-semibold">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 lg:hidden">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-xs text-slate-500 shadow-sm">
            精练·沉浸·乐学
          </div>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="flex-1 lg:ml-0">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200/70">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center space-x-4">
              <button
                className="lg:hidden text-slate-600 hover:text-slate-900"
                onClick={() => setSidebarOpen(true)}
                aria-label="打开菜单"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Jude English</p>
                <h1 className="text-base font-semibold text-slate-900">English · Beyond Basics</h1>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm hover:shadow"
                  >
                    <img
                      src={getUserAvatar()}
                      alt={getUserDisplayName()}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <span className="hidden sm:block text-sm font-medium text-slate-800">
                      {getUserDisplayName()}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-lg z-20">
                        <div className="px-4 py-3 border-b border-slate-100">
                          <p className="text-sm font-semibold text-slate-900">{getUserDisplayName()}</p>
                          <p className="text-xs text-slate-500">保持进步，继续学习</p>
                        </div>
                        <button
                          onClick={() => {
                            logout();
                            setUserMenuOpen(false);
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>退出登录</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => navigate("/login")}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:from-indigo-600 hover:to-blue-700"
                >
                  <LogIn className="h-4 w-4" />
                  <span>登录</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
