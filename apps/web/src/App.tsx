import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Courses } from "./pages/Courses";
import { Settings } from "./pages/Settings";
import { Admin } from "./pages/Admin";
import { CourseOverviewPage } from "./pages/CourseOverviewPage";
import { LessonPlayPage } from "./pages/play/LessonPlayPage";

const App = () => (
  <Routes>
    <Route element={<AppLayout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/courses" element={<Courses />} />
      <Route path="/courses/:courseId" element={<CourseOverviewPage />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/admin" element={<Admin />} />
    </Route>
    <Route path="/play/:courseId/stages/:stageId/:mode" element={<LessonPlayPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
