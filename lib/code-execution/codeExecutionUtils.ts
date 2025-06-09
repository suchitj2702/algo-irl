import { adminDb } from '../firebase/firebaseAdmin';

export interface CodeSubmission {
  id?: string;
  code: string;
  language: string;
  judge0Tokens: string[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  testCases: unknown[];
  results?: unknown;
  fingerprint?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Creates a new code submission in Firestore
 */
export async function createCodeSubmission(data: Omit<CodeSubmission, 'createdAt' | 'updatedAt' | 'id'> & { id: string }) {
  const db = adminDb();
  const now = new Date();
  const submissionData: CodeSubmission = {
    ...data,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = db.collection('codeSubmissions').doc(data.id);
  await docRef.set(submissionData);
  return { ...submissionData };
}

/**
 * Gets a code submission by ID
 */
export async function getCodeSubmission(id: string): Promise<CodeSubmission | null> {
  const db = adminDb();
  const docRef = db.collection('codeSubmissions').doc(id);
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as CodeSubmission;
}

/**
 * Updates a code submission status and results
 */
export async function updateCodeSubmissionStatus(id: string, status: string, results?: unknown) {
  const db = adminDb();
  const docRef = db.collection('codeSubmissions').doc(id);
  
  const updateData = {
    status,
    results: results || null,
    updatedAt: new Date()
  };
  
  await docRef.update(updateData);
  return { id, ...updateData };
}