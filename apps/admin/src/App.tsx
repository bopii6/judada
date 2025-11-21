import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AdminLayout } from "./components/AdminLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CoursePackagesPage } from "./pages/CoursePackagesPage";
import { CourseDetailPage } from "./pages/CourseDetailPage";
import { GenerationJobsPage } from "./pages/GenerationJobsPage";
import { MusicTracksPage } from "./pages/MusicTracksPage";
import { MusicListPage } from "./pages/MusicListPage";
import { MusicUploadPage } from "./pages/MusicUploadPage";
import { MusicEditPage } from "./pages/MusicEditPage";

/**
 * App 组件负责描述整个后台的页面结构。
 * 在这里我们将登录页与需要登录的业务页拆开，方便将来接入真实的鉴权系统。
 */
const AppRoutes = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/packages" element={<CoursePackagesPage />} />
        <Route path="/packages/:id" element={<CourseDetailPage />} />
        <Route path="/jobs" element={<GenerationJobsPage />} />
        <Route path="/music" element={<MusicListPage />} />
        <Route path="/music/upload" element={<MusicUploadPage />} />
        <Route path="/music/edit/:id" element={<MusicEditPage />} />
        <Route path="/music/old" element={<MusicTracksPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AdminLayout>
  );
};

export default function App() {
  /**
   * 现在先用 AuthProvider 保存姓名和管理员密钥，
   * 将来接入 Supabase Auth 时，只需要改这一层即可。
   */
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

