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
import { MusicLevelSelectionPage } from "./pages/lab/MusicLevelSelectionPage";
import { TelegraphPage } from "./pages/lab/TelegraphPage";
import { SharePage } from "./pages/SharePage";
import { useAuth } from "./hooks/useAuth";
import { useCloudSync, progressStore } from "./store/progressStore";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMusicTracks } from "./api/music";
import { warmMusicAssets } from "./utils/musicAssetCache";

const App = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const hasPrefetchedAssets = React.useRef(false);

  // 初始化云同步
  useCloudSync();

  // 预加载音乐闯关资源，用户点击菜单即刻可用
  React.useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ["lab-music-tracks"],
      queryFn: fetchMusicTracks,
      staleTime: 1000 * 60 * 10
    });
  }, [queryClient]);

  // 进一步预加载封面与音频资源，进入闯关时秒开
  React.useEffect(() => {
    let cancelled = false;

    const prefetchAssets = async () => {
      if (hasPrefetchedAssets.current) return;

      try {
        const tracks = await queryClient.ensureQueryData({
          queryKey: ["lab-music-tracks"],
          queryFn: fetchMusicTracks,
          staleTime: 1000 * 60 * 10
        });

        if (cancelled || hasPrefetchedAssets.current) return;

        await warmMusicAssets(tracks, 4);
        if (!cancelled) {
          hasPrefetchedAssets.current = true;
        }
      } catch (error) {
        console.warn("[Prefetch] music assets failed", error);
      }
    };

    void prefetchAssets();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

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
      <Route path="/lab/music" element={<MusicLevelSelectionPage />} />
      <Route path="/lab/music/:slug" element={<MusicDemoPage />} />
      <Route path="/lab/telegraph" element={<TelegraphPage />} />
      <Route path="/share/:courseId" element={<SharePage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
