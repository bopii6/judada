import api from "./client";
import type { Question } from "./types";

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

export interface CourseQuestionsResponse {
  course: {
    id: string;
    title: string;
    topic: string;
    description: string | null;
    coverUrl: string | null;
    lessonCount: number;
  };
  questions: Question[];
}

export const fetchPublishedCourses = async () => {
  const { data } = await api.get<CourseListResponse>("/courses");
  return data.courses;
};

export const fetchCourseQuestions = async (courseId: string) => {
  const { data } = await api.get<CourseQuestionsResponse>(`/courses/${courseId}/questions`);
  return data;
};
