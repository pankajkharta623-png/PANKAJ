export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  studentId?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester: string;
  teacherId: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  enrollmentDate: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  courseId: string;
  date: string;
  status: 'present' | 'absent';
  teacherId: string;
}

export interface Test {
  id: string;
  courseId: string;
  name: string;
  maxMarks: number;
  dueDate: string;
  teacherId: string;
}

export interface TestScore {
  id: string;
  studentId: string;
  testId: string;
  marks: number;
  grade: string;
}

export interface Material {
  id: string;
  courseId: string;
  title: string;
  description: string;
  fileUrl: string;
  type: 'pdf' | 'video';
  uploadedBy: string;
  uploadedAt: string;
}
