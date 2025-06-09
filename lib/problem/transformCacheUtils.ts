import { adminDb } from '../firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { ProblemTransformation } from '@/data-types/problem';

/**
 * Helper function for converting ProblemTransformation objects to Firestore data
 */
const convertTransformationToFirestore = (
  transformation: Partial<ProblemTransformation>,
): Record<string, unknown> => {
  // Sanitize function mapping keys that start and end with double underscores
  const sanitizedFunctionMapping: Record<string, string> = {};
  if (transformation.functionMapping) {
    Object.entries(transformation.functionMapping).forEach(([key, value]) => {
      // Replace double underscores with a Firestore-safe alternative
      const sanitizedKey = key.replace(/^__(.+)__$/, 'dunder_$1_dunder');
      sanitizedFunctionMapping[sanitizedKey] = value;
    });
  }

  return {
    problemId: transformation.problemId,
    companyId: transformation.companyId,
    scenario: transformation.scenario,
    functionMapping: sanitizedFunctionMapping || {},
    contextInfo: transformation.contextInfo || {
      detectedAlgorithms: [],
      detectedDataStructures: [],
      relevanceScore: 0,
      suggestedAnalogyPoints: []
    },
    createdAt: transformation.createdAt || Timestamp.now(),
    updatedAt: transformation.updatedAt || Timestamp.now()
  };
};

/**
 * Helper function for converting Firestore data to ProblemTransformation objects
 */
const convertFirestoreToTransformation = (doc: FirebaseFirestore.DocumentSnapshot): ProblemTransformation => {
  const data = doc.data()!;
  
  // Restore original double underscore format in function mapping
  const restoredFunctionMapping: Record<string, string> = {};
  if (data.functionMapping) {
    Object.entries(data.functionMapping).forEach(([key, value]) => {
      // Convert sanitized keys back to double underscore format
      const originalKey = key.replace(/^dunder_(.+)_dunder$/, '__$1__');
      restoredFunctionMapping[originalKey] = value as string;
    });
  }
  
  return {
    problemId: data.problemId,
    companyId: data.companyId,
    scenario: data.scenario,
    functionMapping: restoredFunctionMapping || {},
    contextInfo: {
      detectedAlgorithms: data.contextInfo?.detectedAlgorithms || [],
      detectedDataStructures: data.contextInfo?.detectedDataStructures || [],
      relevanceScore: data.contextInfo?.relevanceScore || 0,
      suggestedAnalogyPoints: data.contextInfo?.suggestedAnalogyPoints || []
    },
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
};

/**
 * Generate a document ID for a problem transformation
 */
function getTransformationDocId(problemId: string, companyId: string): string {
  return `${problemId}_${companyId}`;
}

/**
 * Get a problem transformation from Firestore by problemId and companyId
 */
export async function getTransformation(problemId: string, companyId: string): Promise<ProblemTransformation | null> {
  try {
    const db = adminDb();
    const docId = getTransformationDocId(problemId, companyId);
    const docRef = db.collection('problemTransformations').doc(docId);
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      return convertFirestoreToTransformation(docSnap);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting transformation:', error);
    return null;
  }
}

/**
 * Save a problem transformation to Firestore
 */
export async function saveTransformation(transformation: Omit<ProblemTransformation, 'createdAt' | 'updatedAt'>): Promise<void> {
  try {
    const db = adminDb();
    const docId = getTransformationDocId(transformation.problemId, transformation.companyId);
    const docRef = db.collection('problemTransformations').doc(docId);
    
    // Check if the document already exists
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      // Update existing document
      const existingData = convertFirestoreToTransformation(docSnap);
      await docRef.set(convertTransformationToFirestore({
        ...transformation,
        updatedAt: Timestamp.now(),
        createdAt: existingData.createdAt
      }));
    } else {
      // Create new document
      await docRef.set(convertTransformationToFirestore({
        ...transformation,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }));
    }
  } catch (error) {
    console.error('Error saving transformation:', error);
    throw new Error(`Failed to save transformation: ${error instanceof Error ? error.message : String(error)}`);
  }
} 