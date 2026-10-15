export type Role = "student" | "lecturer";
export interface DocumentRecord {
  id: number;
  filename: string;
  original_name?: string;
  kind: "cv" | "transcript";
  created_at?: string;
}
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  bio?: string;
  gpa?: number | null;
  skills: string[];
  interests: string[];
  major?: string;
  year?: number | null;
  university?: string;
  website?: string;
  consent_ai: boolean;
  documents?: DocumentRecord[];
}
export interface Publication {
  id: number;
  title: string;
  abstract?: string;
  url?: string;
  year?: number;
  source_url?: string;
}
export interface Lab {
  id: number;
  name: string;
  slug: string;
  summary: string;
  description: string;
  topics: string[];
  skills: string[];
  min_gpa: number;
  capacity: number;
  location: string;
  website?: string;
  owner_id: number;
  lecturer_name: string;
  publication_count: number;
  is_open: boolean;
  publications?: Publication[];
}
export type ApplicationStatus =
  | "submitted"
  | "reviewing"
  | "interview"
  | "accepted"
  | "rejected"
  | "withdrawn";
export interface Application {
  id: number;
  lab_id: number;
  lab_name: string;
  student_id: number;
  student_name: string;
  student_email: string;
  student_gpa: number | null;
  student_skills: string[];
  student_interests: string[];
  cover_letter: string;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
  history?: {
    from_status?: string;
    to_status?: string;
    status?: string;
    note?: string;
    created_at?: string;
  }[];
  documents?: DocumentRecord[];
}
export interface Match {
  lab_id: number;
  score: number;
  reasons: string[];
  gaps: string[];
}
export interface Source {
  id: string | number;
  entity_id?: number;
  title: string;
  type?: string;
  url?: string;
  excerpt?: string;
  score?: number;
}
export interface ChatReply {
  answer: string;
  mode: string;
  sources: Source[];
  filters?: Record<string, unknown>;
  warning?: string | null;
  vector_store?: string;
}
export interface ImportPreview {
  title: string;
  summary: string;
  topics: string[];
  keywords: string[];
  publications: {
    title: string;
    abstract?: string;
    year?: number;
    url?: string;
  }[];
  source_url: string;
  warning?: string;
}
