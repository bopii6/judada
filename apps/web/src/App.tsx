import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Courses } from "./pages/Courses";
import { Settings } from "./pages/Settings";
import { CourseOverviewPage } from "./pages/CourseOverviewPage";
import { LessonPlayPage } from "./pages/play/LessonPlayPage";
import { LoginPage } from "./pages/LoginPage";
import { useAuth } from "./hooks/useAuth";

const App = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* 登录页面 - 不需要认证 */}
      <Route path="/login" element={<LoginPage />} />

      {/* 所有页面都支持游客模式，无需认证 */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseId" element={<CourseOverviewPage />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* 播放页面 - 支持游客模式 */}
      <Route path="/play/:courseId/stages/:stageId/:mode" element={<LessonPlayPage />} />

      {/* 默认重定向 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
