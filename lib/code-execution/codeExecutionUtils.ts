import { adminDb } from '../firebase/firebaseAdmin';
import { TestCase } from '../../data-types/problem';
import { ExecutionResults } from '../../data-types/execution';

/**
 * Represents a code submission stored in the database.
 * Used to track the lifecycle of code execution requests from submission to completion.
 */
export interface CodeSubmission {
  id?: string;
  code: string;
  language: string;
  judge0Tokens: string[]; // Judge0 submission tokens for tracking batch execution
  status: 'pending' | 'processing' | 'completed' | 'error';
  testCases: TestCase[];
  results?: ExecutionResults;
  fingerprint?: string; // Security fingerprint for rate limiting and abuse prevention
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Creates a new code submission record in Firestore.
 * This function initializes the submission tracking system for async code execution.
 * 
 * @param data - Complete submission data including ID, code, language, and test cases
 * @returns Promise resolving to the created submission with timestamps
 * @throws Error if Firestore write operation fails
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
 * Retrieves a code submission by its unique ID from Firestore.
 * Used to check submission status and retrieve results after async execution.
 * 
 * @param id - Unique submission identifier (UUID)
 * @returns Promise resolving to submission data or null if not found
 * @throws Error if Firestore read operation fails
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
 * Updates a code submission's status and execution results.
 * Called when Judge0 execution completes (via callback or polling) to store final results.
 * 
 * @param id - Unique submission identifier
 * @param status - New status ('processing', 'completed', 'error')
 * @param results - Optional execution results with test case outcomes
 * @returns Promise resolving to update confirmation with timestamp
 * @throws Error if Firestore update operation fails or document doesn't exist
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