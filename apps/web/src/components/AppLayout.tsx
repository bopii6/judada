import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LogOut, Menu, LogIn, LayoutDashboard, BookOpen, UserRound, Sparkles, Sun, Music3, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

const links = [
  { to: "/", label: "总览", icon: <LayoutDashboard className="h-5 w-5" /> },
  { to: "/courses", label: "课程", icon: <BookOpen className="h-5 w-5" /> },
  { to: "/lab/music", label: "音乐闯关", icon: <Music3 className="h-5 w-5" /> },
  { to: "/profile", label: "我的", icon: <UserRound className="h-5 w-5" /> }
];

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, logout, getUserAvatar, getUserDisplayName } = useAuth();

  const location = useLocation();
  // Hide sidebar on /courses (list) and /courses/:id (overview)
  const isCoursesPage = location.pathname === "/courses" || location.pathname.startsWith("/courses/");

  return (
    <div className="flex min-h-screen bg-[#FFFBF5] text-slate-700 font-sans relative overflow-hidden">
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
          className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="flex items-center justify-between px-8 py-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-100 text-orange-500">
                <Sun className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-orange-400 font-bold">Jude English</p>
                <h1 className="text-lg font-black text-slate-800 tracking-tight">Learning Studio</h1>
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
            {links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-4 rounded-[1.2rem] px-5 py-4 transition-all duration-300 ${isActive
                    ? "bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-100"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
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
            ))}
          </nav>

          <div className="absolute bottom-8 left-6 right-6">
            <div className="rounded-[1.5rem] bg-gradient-to-br from-sky-50 to-indigo-50 px-6 py-5 border border-sky-100">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-sky-500" />
                <p className="text-xs font-bold text-sky-600">每日小贴士</p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                保持好奇心，世界就是你的课堂。
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0 relative z-10">
        <header className="sticky top-0 z-30 bg-[#FFFBF5]/80 backdrop-blur-md border-b border-slate-200/50">
          <div className="flex items-center justify-between px-6 py-5 sm:px-8">
            <div className="flex items-center gap-4">
              {location.pathname === "/courses" ? (
                <button
                  onClick={() => navigate("/")}
                  className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  <span>返回首页</span>
                </button>
              ) : location.pathname.startsWith("/courses/") ? (
                <button
                  onClick={() => navigate("/courses")}
                  className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  <span>返回课程列表</span>
                </button>
              ) : (
                <>
                  <button
                    className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-white transition-colors"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="打开菜单"
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                  <div className="lg:hidden">
                    <span className="text-base font-bold text-slate-800">Jude English</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-5">
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-3 rounded-full bg-white pl-1.5 pr-4 py-1.5 shadow-sm border border-slate-100 hover:shadow-md transition-all"
                  >
                    <img
                      src={getUserAvatar()}
                      alt={getUserDisplayName()}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-orange-100"
                    />
                    <span className="hidden sm:block text-sm font-bold text-slate-700">
                      {getUserDisplayName()}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 mt-4 w-60 rounded-[1.5rem] bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 z-20 overflow-hidden p-2">
                        <div className="px-4 py-3 mb-2">
                          <p className="text-sm font-bold text-slate-800">{getUserDisplayName()}</p>
                          <p className="text-xs text-slate-400 mt-0.5 font-medium">Keep learning, keep growing</p>
                        </div>
                        <button
                          onClick={() => {
                            logout();
                            setUserMenuOpen(false);
                          }}
                          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
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
                  className="flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-200 hover:bg-slate-800 hover:scale-105 transition-all"
                >
                  <LogIn className="h-4 w-4" />
                  <span>登录</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-8 lg:px-10 overflow-y-auto custom-scrollbar">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
