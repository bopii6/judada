import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LogOut, Menu, LogIn, LayoutDashboard, BookOpen, UserRound, Sparkles, Music3, ArrowRight, Crown } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { SettingsModal } from "./SettingsModal";

const links = [
  { to: "/", label: "总览", icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: "/courses", label: "课程", icon: <BookOpen className="h-5 w-5" /> },
  { to: "/lab/music", label: "音乐闯关", icon: <Music3 className="h-5 w-5" /> },
  { to: "/membership", label: "会员", icon: <Crown className="h-5 w-5" /> },
  { to: "/profile", label: "设置", icon: <UserRound className="h-5 w-5" /> }
];

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, logout, getUserAvatar, getUserDisplayName } = useAuth();

  const location = useLocation();
  // Hide sidebar on /courses (list) and /courses/:id (overview)
  const isCoursesPage = location.pathname === "/courses" || location.pathname.startsWith("/courses/");

  return (
    <div className="flex h-screen bg-[#FFFBF5] dark:bg-slate-900 text-slate-700 dark:text-slate-100 font-sans relative overflow-hidden transition-colors">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on Courses Page */}
      {!isCoursesPage && (
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-56 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.3)] transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="flex items-center justify-between px-8 py-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-100 text-orange-500">
                <img src="/icons/bear-icon.svg" alt="Logo" className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-orange-400 dark:text-orange-500 font-bold">Jude English</p>
                <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">Learning Studio</h1>
              </div>
            </div>
            <button
              className="lg:hidden text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setSidebarOpen(false)}
              aria-label="关闭菜单"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col px-6 py-4 space-y-2">
            {links.map(link => {
              if (link.to === '/profile') {
                return (
                  <button
                    key={link.to}
                    onClick={() => {
                      setSidebarOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="group flex items-center gap-4 rounded-[1.2rem] px-5 py-4 transition-all duration-300 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 w-full text-left"
                  >
                    <span className="flex items-center justify-center transition-colors group-hover:text-slate-700 dark:group-hover:text-slate-200">
                      {link.icon}
                    </span>
                    <span className="text-base font-bold">{link.label}</span>
                  </button>
                );
              }
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `group flex items-center gap-4 rounded-[1.2rem] px-5 py-4 transition-all duration-300 ${isActive
                      ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-orange-100 dark:ring-orange-800"
                      : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200"
                    }`
                  }
                >
                  <span className={`flex items-center justify-center transition-colors ${
                    // isActive logic handled by parent class
                    ""
                    } group-[.active]:text-orange-500`}>
                    {link.icon}
                  </span>
                  <span className="text-base font-bold">{link.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="absolute bottom-8 left-6 right-6 space-y-4">


            {/* User Profile Link */}
            {isAuthenticated ? (
              <button
                onClick={() => {
                  // navigate("/profile");
                  setIsSettingsOpen(true);
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
              >
                <img
                  src={getUserAvatar()}
                  alt={getUserDisplayName()}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white dark:ring-slate-700 shadow-sm group-hover:scale-105 transition-transform"
                />
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                    {getUserDisplayName()}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    点击查看个人设置
                  </p>
                </div>
                <UserRound className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </button>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-lg shadow-slate-200 hover:scale-105 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>登录账号</span>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0 relative z-10">
        <header className="sticky top-0 z-30 bg-[#FFFBF5]/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center justify-between px-6 py-5 sm:px-8">
            <div className="flex items-center gap-4">
              {location.pathname === "/courses" ? (
                <button
                  onClick={() => navigate("/")}
                  className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  <span>返回首页</span>
                </button>
              ) : location.pathname.startsWith("/courses/") ? (
                <button
                  onClick={() => navigate("/courses")}
                  className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  <span>返回课程列表</span>
                </button>
              ) : (
                <>
                  <button
                    className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="打开菜单"
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                  <div className="lg:hidden">
                    <span className="text-base font-bold text-slate-800 dark:text-slate-100">Jude English</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8 lg:px-10 overflow-y-auto custom-scrollbar">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div >

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div >
  );
};
