import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { User, LogOut, Menu, LogIn } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const links = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/courses", label: "课程", icon: "📚" },
  { to: "/settings", label: "设置", icon: "⚙️" }
];

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated, login, logout, getUserAvatar, getUserDisplayName } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* 移动端遮罩层 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h1 className="text-lg font-bold text-slate-800">
            <span className="text-xl">🎓</span> Jude English Lab
          </h1>
          <button
            className="lg:hidden text-slate-500 hover:text-slate-700"
            onClick={() => setSidebarOpen(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col px-4 py-6 text-sm font-medium text-slate-600">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center rounded-lg px-4 py-3 mb-2 transition hover:bg-slate-100 ${
                  isActive ? "bg-slate-200 text-slate-900 font-semibold" : ""
                }`
              }
            >
              <span className="text-xl mr-3">{link.icon}</span>
              <span className="hidden sm:inline">{link.label}</span>
              <span className="sm:hidden text-xs">{link.label.substring(0, 2)}</span>
            </NavLink>
          ))}
        </nav>

        {/* 移动端版本信息 */}
        <div className="absolute bottom-4 left-4 right-4 lg:hidden">
          <div className="text-xs text-slate-400 text-center">
            Made with ❤️ for English Learners
          </div>
        </div>
      </aside>

      {/* 主内容区域 */}
      <div className="flex-1 lg:ml-0">
        {/* 顶部导航栏 */}
        <header className="bg-white shadow-sm border-b border-slate-200">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-4">
              <button
                className="lg:hidden text-slate-600 hover:text-slate-900"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-lg font-semibold text-slate-800">Jude English Lab</h1>
            </div>

            {/* 用户区域 */}
            <div className="flex items-center space-x-3">
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <img
                      src={getUserAvatar()}
                      alt={getUserDisplayName()}
                      className="w-8 h-8 rounded-full object-cover border-2 border-slate-200"
                    />
                    <span className="hidden sm:block text-sm font-medium text-slate-700">
                      {getUserDisplayName()}
                    </span>
                  </button>

                  {/* 用户菜单 */}
                  {userMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                        <div className="px-4 py-2 border-b border-slate-100">
                          <p className="text-sm font-medium text-slate-900">
                            {getUserDisplayName()}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            logout();
                            setUserMenuOpen(false);
                          }}
                          className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
                  onClick={() => navigate('/login')}
                  className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  <span>登录</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* 主要内容 */}
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
