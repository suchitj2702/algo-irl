import { getDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/firebase';

export interface CodeSubmission {
  id?: string;
  code: string;
  language: string;
  judge0Tokens: string[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  testCases: unknown[];
  results?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Creates a new code submission in Firestore
 */
export async function createCodeSubmission(data: Omit<CodeSubmission, 'createdAt' | 'updatedAt' | 'id'> & { id: string }) {
  const now = new Date();
  const submissionData: CodeSubmission = {
    ...data,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = doc(db, 'codeSubmissions', data.id);
  await setDoc(docRef, submissionData);
  return { ...submissionData };
}

/**
 * Gets a code submission by ID
 */
export async function getCodeSubmission(id: string): Promise<CodeSubmission | null> {
  const docRef = doc(db, 'codeSubmissions', id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as CodeSubmission;
}

/**
 * Updates a code submission status and results
 */
export async function updateCodeSubmissionStatus(id: string, status: string, results?: unknown) {
  const docRef = doc(db, 'codeSubmissions', id);
  
  const updateData = {
    status,
    results: results || null,
    updatedAt: new Date()
  };
  
  await updateDoc(docRef, updateData);
  return { id, ...updateData };
}