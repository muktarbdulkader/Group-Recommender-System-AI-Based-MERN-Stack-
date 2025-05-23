export interface User {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'instructor';
  skills?: string[];
  interests?: string[];
  availability?: string[];
}

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  skills: string[];
  interests: string[];
  availability: string[];
  role: 'student';
}


export interface Group {
  id: number;
  name: string;
  members: string[];
  matching_skills: string[];
  study_time: string;
  status: string;
  feedback: { id: number; content: string; rating?: number; userId: number; created_at: string }[];
}
export interface Schedule {
  id: number;
  groupId: number;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  agenda?: string;
}
