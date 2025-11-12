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

export type LessonInteractionType = "type" | "tiles" | "listenTap" | "speak";

export interface CourseStage {
  id: string;
  lessonId: string;
  lessonTitle: string;
  lessonSequence: number;
  stageSequence: number;
  promptCn: string;
  answerEn: string;
  variants: string[];
  type: LessonInteractionType;
  audioUrl?: string | null;
  hints?: string[];
  estimatedSeconds?: number;
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
