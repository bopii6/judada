import api from "./client";

export interface CourseSummary {
  id: string;
  title: string;
  topic: string;
  description: string | null;
  coverUrl: string | null;
  grade: string | null;      // 年级
  publisher: string | null;  // 出版社
  semester: string | null;   // 学期
  updatedAt: string;
  lessonCount: number;
  unitCount?: number;        // 单元数量
}

export interface CourseFilters {
  grades: string[];
  publishers: string[];
}

export interface CourseListResponse {
  courses: CourseSummary[];
  filters: CourseFilters;
}

export type LessonInteractionType = "type" | "tiles" | "listenTap" | "speak" | "game";

export interface CourseStage {
  id: string;
  lessonId: string;
  lessonTitle: string;
  lessonSequence: number;
  stageSequence: number;
  unitNumber?: number | null;  // 单元序号
  unitName?: string | null;    // 单元名称
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
  course: CourseSummary & { stageCount: number; unitCount?: number };
  stages: CourseStage[];
}

export interface FetchCoursesParams {
  grade?: string;
  publisher?: string;
}

export const fetchPublishedCourses = async (params?: FetchCoursesParams) => {
  const queryParams = new URLSearchParams();
  if (params?.grade) queryParams.set("grade", params.grade);
  if (params?.publisher) queryParams.set("publisher", params.publisher);
  
  const queryString = queryParams.toString();
  const url = queryString ? `/courses?${queryString}` : "/courses";
  
  const { data } = await api.get<CourseListResponse>(url);
  return data;
};

export const fetchCourseContent = async (courseId: string) => {
  const { data } = await api.get<CourseContentResponse>(`/courses/${courseId}/questions`);
  return data;
};
