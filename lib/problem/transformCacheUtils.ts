import { adminDb } from '../firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { ProblemTransformation } from '@/data-types/problem';
import { RoleFamily } from '@/data-types/role';

/**
 * Transform Cache Utilities for Problem Transformations
 *
 * This module implements a comprehensive caching strategy for AI-generated problem transformations.
 * The cache uses Firestore to persist transformations and includes special handling for function
 * name mappings that may contain Firestore-incompatible characters.
 *
 * Caching Strategy:
 * - Key: Combination of problemId, companyId, and optional roleFamily
 * - Storage: Firestore collection 'problemTransformations-v2'
 * - Expiration: Manual invalidation (transformations are generally stable)
 * - Sanitization: Special handling for function names with double underscores
 */

/**
 * Converts ProblemTransformation objects to Firestore-compatible data format.
 * This function handles sanitization of function mapping keys that may contain
 * characters incompatible with Firestore field naming conventions.
 * 
 * Sanitization Algorithm:
 * 1. Identify function names with double underscores (Python dunder methods)
 * 2. Replace "__name__" format with "dunder_name_dunder" for Firestore compatibility
 * 3. Preserve all other transformation data as-is
 * 4. Add default values for missing optional fields
 * 
 * @param transformation - Partial transformation object to convert
 * @returns Firestore-compatible data object
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
 * Converts Firestore document data back to ProblemTransformation objects.
 * This function reverses the sanitization process applied during storage,
 * restoring original function names with double underscores.
 * 
 * Restoration Algorithm:
 * 1. Extract data from Firestore document snapshot
 * 2. Restore function mapping keys from "dunder_name_dunder" to "__name__"
 * 3. Provide default values for any missing context information
 * 4. Return properly typed ProblemTransformation object
 * 
 * @param doc - Firestore document snapshot containing cached transformation
 * @returns Restored ProblemTransformation object
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
 * Generates a consistent document ID for caching problem transformations.
 * This function creates a deterministic cache key based on the problem, company, and optionally role.
 *
 * @param problemId - Unique identifier for the problem
 * @param companyId - Unique identifier for the company
 * @param roleFamily - Optional role family for role-specific caching
 * @returns Consistent document ID for Firestore storage
 */
function getTransformationDocId(problemId: string, companyId: string, roleFamily?: RoleFamily): string {
  return roleFamily ? `${problemId}_${companyId}_${roleFamily}` : `${problemId}_${companyId}`;
}

/**
 * Retrieves a cached problem transformation from Firestore.
 * This function implements the cache lookup logic for problem transformations.
 *
 * Cache Lookup Process:
 * 1. Generate deterministic document ID from problemId, companyId, and optional roleFamily
 * 2. Query Firestore collection for existing transformation
 * 3. If found, deserialize and restore function mappings
 * 4. Return null if not found or on error
 *
 * @param problemId - Unique identifier for the problem
 * @param companyId - Unique identifier for the company
 * @param roleFamily - Optional role family for role-specific cache lookup
 * @returns Cached transformation or null if not found
 */
export async function getTransformation(problemId: string, companyId: string, roleFamily?: RoleFamily): Promise<ProblemTransformation | null> {
  try {
    const db = adminDb();
    const docId = getTransformationDocId(problemId, companyId, roleFamily);
    const docRef = db.collection('problemTransformations-v2').doc(docId);
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
 * Saves a problem transformation to the Firestore cache.
 * This function implements the cache storage logic with smart update handling.
 *
 * Cache Storage Strategy:
 * 1. Generate document ID from problem, company identifiers, and optional role
 * 2. Check if transformation already exists in cache
 * 3. If exists, update with new data while preserving creation timestamp
 * 4. If new, create with both creation and update timestamps
 * 5. Apply Firestore sanitization for function mappings
 *
 * @param transformation - Complete transformation data to cache (without timestamps)
 * @param roleFamily - Optional role family for role-specific caching
 * @throws Error if save operation fails
 */
export async function saveTransformation(
  transformation: Omit<ProblemTransformation, 'createdAt' | 'updatedAt'>,
  roleFamily?: RoleFamily
): Promise<void> {
  try {
    const db = adminDb();
    const docId = getTransformationDocId(transformation.problemId, transformation.companyId, roleFamily);
    const docRef = db.collection('problemTransformations-v2').doc(docId);

    // Check if the document already exists
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      // Update existing document while preserving creation timestamp
      const existingData = convertFirestoreToTransformation(docSnap);
      await docRef.set(
        convertTransformationToFirestore({
          ...transformation,
          updatedAt: Timestamp.now(),
          createdAt: existingData.createdAt,
        })
      );
    } else {
      // Create new document with fresh timestamps
      await docRef.set(
        convertTransformationToFirestore({
          ...transformation,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        })
      );
    }
  } catch (error) {
    console.error('Error saving transformation:', error);
    throw new Error(`Failed to save transformation: ${error instanceof Error ? error.message : String(error)}`);
  }
} 