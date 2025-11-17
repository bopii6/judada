import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Courses } from "./pages/Courses";
import { Settings } from "./pages/Settings";
import { CourseOverviewPage } from "./pages/CourseOverviewPage";
import { LessonPlayPage } from "./pages/play/LessonPlayPage";
import { LoginPage } from "./pages/LoginPage";
import EmailLoginPage from "./pages/EmailLoginPage";
import { useAuth } from "./hooks/useAuth";
import { useCloudSync } from "./store/progressStore";

const App = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // 初始化云同步
  useCloudSync();

  // 页面加载时强制同步一次数据
  React.useEffect(() => {
    if (isAuthenticated && localStorage.getItem('token')) {
      // 延迟一点时间确保组件完全加载
      setTimeout(() => {
        console.log('页面加载完成，触发数据同步...');
        import('./store/progressStore').then(({ progressStore }) => {
          progressStore.initializeForUser();
        });
      }, 100);
    }
  }, [isAuthenticated]);

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
      <Route path="/email-login" element={<EmailLoginPage />} />

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
