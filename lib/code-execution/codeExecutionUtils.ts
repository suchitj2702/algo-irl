import { collection, addDoc, getDoc, doc, updateDoc, query, where, orderBy, getDocs, DocumentData, Query, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/firebase';

export interface CodeSubmission {
  id?: string;
  userId?: string;
  problemId?: string;
  code: string;
  language: string;
  judge0Tokens: string[];
  status: 'pending' | 'processing' | 'completed' | 'error';
  testCases: any[];
  results?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Prepares user-defined code for submission by applying reverse function mapping
 * @param userCode - The user-provided code containing the company-specific function names
 * @param problemDetails - Details containing the function mapping
 * @returns The transformed code with original function names
 */
export function prepareCodeForSubmission(
  userCode: string,
  problemDetails: {
    functionMapping?: Record<string, string>;
  }
) {
  try {
    const { functionMapping } = problemDetails;
    
    // If no function mapping is provided, return the original code
    if (!functionMapping || Object.keys(functionMapping).length === 0) {
      return userCode;
    }
    
    // Create reverse mapping (company-specific to original)
    const reverseMapping: Record<string, string> = {};
    Object.entries(functionMapping).forEach(([original, companySpecific]) => {
      reverseMapping[companySpecific] = original;
    });
    
    // Sort by length in descending order to avoid partial replacements
    const sortedMappings = Object.entries(reverseMapping)
      .sort(([a], [b]) => b.length - a.length);
    
    // Apply the reverse mappings
    let processedCode = userCode;
    for (const [companySpecific, original] of sortedMappings) {
      // Escape special regex characters
      const escapedName = companySpecific.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Create a regex that matches the exact word boundaries
      const regex = new RegExp(`\\b${escapedName}\\b`, 'g');
      processedCode = processedCode.replace(regex, original);
    }
    
    return processedCode;
  } catch (error) {
    console.error('Error preparing code for submission:', error);
    throw error;
  }
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
export async function updateCodeSubmissionStatus(id: string, status: string, results?: any) {
  const docRef = doc(db, 'codeSubmissions', id);
  
  const updateData = {
    status,
    results: results || null,
    updatedAt: new Date()
  };
  
  await updateDoc(docRef, updateData);
  return { id, ...updateData };
}

/**
 * Lists submissions by user ID and optionally problem ID
 */
export async function listUserCodeSubmissions(userId: string, problemId?: string) {
  let q: Query<DocumentData> = collection(db, 'codeSubmissions');
  
  if (userId) {
    q = query(q, where('userId', '==', userId));
  }
  
  if (problemId) {
    q = query(q, where('problemId', '==', problemId));
  }
  
  q = query(q, orderBy('createdAt', 'desc'));
  
  const querySnapshot = await getDocs(q);
  const submissions: CodeSubmission[] = [];
  
  querySnapshot.forEach(doc => {
    submissions.push({ id: doc.id, ...doc.data() } as CodeSubmission);
  });
  
  return submissions;
} 