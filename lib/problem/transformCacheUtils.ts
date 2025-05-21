import { collection, doc, getDoc, setDoc, FirestoreDataConverter, DocumentData, WithFieldValue, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { ProblemTransformation } from '@/data-types/problem';

/**
 * Firestore collection reference for problem transformations
 */
const transformationsCollection = collection(db, 'problemTransformations');

/**
 * Helper function for converting ProblemTransformation objects to Firestore data
 */
const convertTransformationToFirestore = (
  transformation: WithFieldValue<ProblemTransformation>,
): DocumentData => {
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
 * Firestore Data Converter for ProblemTransformation objects
 */
const transformationConverter: FirestoreDataConverter<ProblemTransformation> = {
  toFirestore(
    modelObject: WithFieldValue<ProblemTransformation>,
  ): DocumentData {
    return convertTransformationToFirestore(modelObject);
  },
  fromFirestore(snapshot: QueryDocumentSnapshot): ProblemTransformation {
    const data = snapshot.data();
    
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
  }
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
    const docId = getTransformationDocId(problemId, companyId);
    const docRef = doc(transformationsCollection, docId).withConverter(transformationConverter);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
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
    const docId = getTransformationDocId(transformation.problemId, transformation.companyId);
    const docRef = doc(transformationsCollection, docId).withConverter(transformationConverter);
    
    // Check if the document already exists
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      // Update existing document
      await setDoc(docRef, {
        ...transformation,
        updatedAt: Timestamp.now(),
        createdAt: docSnap.data().createdAt
      });
    } else {
      // Create new document
      await setDoc(docRef, {
        ...transformation,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    }
  } catch (error) {
    console.error('Error saving transformation:', error);
    throw new Error(`Failed to save transformation: ${error instanceof Error ? error.message : String(error)}`);
  }
} 