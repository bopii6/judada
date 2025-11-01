import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/courses", label: "课程" },
  { to: "/settings", label: "设置" },
  { to: "/admin", label: "Admin" }
];

export const AppLayout = () => (
  <div className="flex min-h-screen">
    <aside className="w-64 bg-white shadow-lg">
      <div className="px-6 py-6 text-lg font-bold text-slate-800">Jude English Lab</div>
      <nav className="flex flex-col px-4 text-sm font-medium text-slate-600">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 mb-1 transition hover:bg-slate-100 ${
                isActive ? "bg-slate-200 text-slate-900 font-semibold" : ""
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
    <main className="flex-1 bg-slate-50">
      <div className="mx-auto max-w-5xl px-8 py-10">
        <Outlet />
      </div>
    </main>
  </div>
);
