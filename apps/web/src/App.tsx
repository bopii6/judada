import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Courses } from "./pages/Courses";
import { Profile } from "./pages/Profile";
import { CourseOverviewPage } from "./pages/CourseOverviewPage";
import { LessonPlayPage } from "./pages/play/LessonPlayPage";
import { LoginPage } from "./pages/LoginPage";
import EmailLoginPage from "./pages/EmailLoginPage";
import { MusicDemoPage } from "./pages/lab/MusicDemoPage";
import { useAuth } from "./hooks/useAuth";
import { useCloudSync, progressStore } from "./store/progressStore";

const App = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // 初始化云同步
  useCloudSync();

  // 登录后立即拉取云端进度，避免初始为 0
  React.useEffect(() => {
    if (!isLoading && isAuthenticated && localStorage.getItem("token")) {
      progressStore.initializeForUser();
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/email-login" element={<EmailLoginPage />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:courseId" element={<CourseOverviewPage />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="/play/:courseId/stages/:stageId/:mode" element={<LessonPlayPage />} />
      <Route path="/lab/music" element={<MusicDemoPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
