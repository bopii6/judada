import api from "./client";

export interface CourseSummary {
  id: string;
  title: string;
  topic: string;
  description: string | null;
  coverUrl: string | null;
  updatedAt: string;
  lessonCount: number;
}

export interface CourseListResponse {
  courses: CourseSummary[];
}

export type LessonInteractionType = "type" | "tiles" | "listenTap" | "speak" | "game";

export interface CourseStage {
  id: string;
  lessonId: string;
  lessonTitle: string;
  lessonSequence: number;
  stageSequence: number;
  promptCn: string;
  promptEn?: string; // 英文句子（主要显示内容）
  answerEn: string;
  variants: string[];
  type: LessonInteractionType;
  audioUrl?: string | null;
  hints?: string[];
  estimatedSeconds?: number;
  // 后端可能返回的关卡难度（未提供时留空）
  difficulty?: string | number;
}

export interface CourseContentResponse {
  course: CourseSummary & { stageCount: number };
  stages: CourseStage[];
}

export const fetchPublishedCourses = async () => {
  const { data } = await api.get<CourseListResponse>("/courses");
  return data.courses;
};

export const fetchCourseContent = async (courseId: string) => {
  const { data } = await api.get<CourseContentResponse>(`/courses/${courseId}/questions`);
  return data;
};
