import { Timestamp } from "firebase/firestore";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  preferences: UserPreferences;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
}

export interface UserPreferences {
  theme: "light" | "dark";
  codeEditorTheme: string;
  defaultLanguage: string;
  fontSize: number;
  tabSize: number;
  showLineNumbers: boolean;
}

export interface History {
  id: string;
  userId: string;
  problemId: string;
  companyId: string;
  scenarioId: string;
  code: string;
  language: string;
  executionResults: import('./execution').ExecutionResults;
  notes?: string;
  completed: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
} 