import {
    collection,
    doc,
    getDoc,
    getDocs,
    writeBatch, // Keep for potential batch URL imports
    serverTimestamp,
    query,
    DocumentData,
    FirestoreDataConverter,
    Timestamp,
    SetOptions,
    WithFieldValue,
    PartialWithFieldValue,
    setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";
import { Problem, TestCase, ProblemDifficulty } from "@/data-types/problem";
import { AnthropicService } from "@/lib/llmServices/anthropicService";

// Initialize Anthropic service
const anthropicService = new AnthropicService();

/**
 * Extracts the problem's title slug from a LeetCode URL.
 * Example: "https://leetcode.com/problems/two-sum/" -> "two-sum"
 * Returns null if the URL is invalid or doesn't match the pattern.
 */
export const extractSlugFromUrl = (url: string): string | null => {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname !== "leetcode.com") {
            return null;
        }
        const pathParts = parsedUrl.pathname.split('/').filter(part => part !== '');
        if (pathParts.length >= 2 && pathParts[0] === 'problems') {
            return pathParts[1];
        }
        return null;
    } catch (error) {
        console.error(`Error parsing URL ${url}:`, error);
        return null;
    }
};

// Firestore collection reference
const problemsCollectionRef = collection(db, "problems");

// Helper function for converting Problem objects to Firestore data
const convertProblemToFirestore = (
    modelObject: WithFieldValue<Problem> | PartialWithFieldValue<Problem>,
    options?: SetOptions
): DocumentData => {
    const data = { ...modelObject } as any;
    delete data.id;
    const isMerge = options &&
        ('merge' in options && options.merge ||
        ('mergeFields' in options && Array.isArray(options.mergeFields) && options.mergeFields.length > 0));
    data.updatedAt = serverTimestamp();
    if (!isMerge && !data.createdAt) {
        data.createdAt = serverTimestamp();
    }
    if (data.createdAt instanceof Date) {
        data.createdAt = Timestamp.fromDate(data.createdAt);
    }
    if (data.updatedAt instanceof Date) {
        data.updatedAt = Timestamp.fromDate(data.updatedAt);
    }
    return data;
};

// Firestore Data Converter for Problem objects
const problemConverter: FirestoreDataConverter<Problem> = {
    toFirestore(
        modelObject: WithFieldValue<Problem> | PartialWithFieldValue<Problem>,
        options?: SetOptions
    ): DocumentData {
        return convertProblemToFirestore(modelObject, options);
    },
    fromFirestore(snapshot, options): Problem {
        const data = snapshot.data(options)!;
        return {
            id: snapshot.id,
            title: typeof data.title === 'string' ? data.title : "Untitled Problem",
            difficulty: typeof data.difficulty === 'string' ? data.difficulty as ProblemDifficulty : "Medium",
            categories: Array.isArray(data.categories) ? data.categories : [],
            description: typeof data.description === 'string' ? data.description : "No description",
            constraints: Array.isArray(data.constraints) ? data.constraints : [],
            leetcodeLink: typeof data.leetcodeLink === 'string' ? data.leetcodeLink : `https://leetcode.com/problems/${snapshot.id}/`,
            isBlind75: typeof data.isBlind75 === 'boolean' ? data.isBlind75 : false,
            testCases: Array.isArray(data.testCases) ? data.testCases : [],
            solutionApproach: typeof data.solutionApproach === 'string' || data.solutionApproach === null ? data.solutionApproach : null,
            timeComplexity: typeof data.timeComplexity === 'string' || data.timeComplexity === null ? data.timeComplexity : null,
            spaceComplexity: typeof data.spaceComplexity === 'string' || data.spaceComplexity === null ? data.spaceComplexity : null,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : Timestamp.now(),
        };
    }
};

// Function to fetch and import a single problem by URL using Anthropic API
export const fetchAndImportProblemByUrl = async (url: string): Promise<{ success: boolean; slug: string | null; error?: string }> => {
    const slug = extractSlugFromUrl(url);
    if (!slug) {
        return { success: false, slug: null, error: "Invalid LeetCode URL or could not extract slug." };
    }

    try {
        // Fetch problem data using Anthropic - we already extract the slug above
        const problemData = await anthropicService.fetchProblemDataFromUrl(url);
        
        // Check if there was an error in fetching the data
        if (problemData.error) {
            return { success: false, slug, error: problemData.error };
        }

        // Log retrieved data to help debug
        console.log(`Retrieved problem data for ${slug}:`, {
            title: problemData.title,
            hasSolutionApproach: !!problemData.solutionApproach,
            hasTimeComplexity: !!problemData.timeComplexity,
            hasSpaceComplexity: !!problemData.spaceComplexity,
            solutionLength: problemData.solutionApproach ? problemData.solutionApproach.length : 0
        });

        // Process test cases to handle nested arrays (Firestore doesn't support nested arrays)
        const sanitizedTestCases = problemData.testCases.map(testCase => {
            // Create a sanitized test case with required fields
            const sanitizedTestCase: TestCase = {
                input: sanitizeFirestoreData(testCase.input),
                output: sanitizeFirestoreData(testCase.output)
            };
            
            // Add explanation if it exists
            if ('explanation' in testCase && testCase.explanation) {
                sanitizedTestCase.explanation = String(testCase.explanation);
            }
            
            return sanitizedTestCase;
        });

        // Map fetched data to our Problem interface
        const problem: Omit<Problem, 'id' | 'createdAt' | 'updatedAt'> = {
            title: problemData.title,
            difficulty: problemData.difficulty as ProblemDifficulty,
            categories: problemData.categories,
            description: problemData.description,
            constraints: problemData.constraints,
            leetcodeLink: url,
            isBlind75: false, // Default, can be set manually later if needed
            testCases: sanitizedTestCases,
            // The AnthropicService class now guarantees these fields will be populated
            solutionApproach: problemData.solutionApproach,
            timeComplexity: problemData.timeComplexity,
            spaceComplexity: problemData.spaceComplexity,
        };

        // Get Firestore document reference with converter
        const docRef = doc(problemsCollectionRef, slug).withConverter(problemConverter);

        // Save to Firestore (will add timestamps via converter)
        await setDoc(docRef, problem);

        console.log(`Successfully fetched and imported problem: ${slug}`);
        return { success: true, slug: slug };

    } catch (error: any) {
        console.error(`Error fetching/importing problem ${slug}: `, error);
        return { success: false, slug: slug, error: error.message || "Unknown error occurred during fetch/import." };
    }
};

/**
 * Sanitizes data to make it compatible with Firestore by handling nested arrays
 * Firestore doesn't support arrays within arrays
 */
const sanitizeFirestoreData = (data: any): any => {
    // If it's an array, convert it to an object with indexed keys
    if (Array.isArray(data)) {
        // Convert array to object with numbered keys
        const result: Record<string, any> = {};
        data.forEach((item, index) => {
            result[`${index}`] = sanitizeFirestoreData(item);
        });
        // Add a special field to identify this as a converted array
        result._isArray = true;
        return result;
    } 
    // If it's an object, recursively sanitize its properties
    else if (data && typeof data === 'object' && !isTimestamp(data)) {
        const result: Record<string, any> = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                result[key] = sanitizeFirestoreData(data[key]);
            }
        }
        return result;
    }
    // Primitive values can be stored directly
    return data;
};

/**
 * Check if value is a Firebase Timestamp
 */
const isTimestamp = (value: any): boolean => {
    return value && typeof value === 'object' && 
           typeof value.toDate === 'function' && 
           typeof value.toMillis === 'function';
};

// Function to import multiple problems from URLs
export const importProblemsFromUrls = async (urls: string[]): Promise<{ successCount: number; errors: any[] }> => {
    let successCount = 0;
    const errors: any[] = [];

    // Process URLs sequentially to avoid overloading the API
    for (const url of urls) {
        const result = await fetchAndImportProblemByUrl(url);
        if (result.success) {
            successCount++;
        } else {
            errors.push({ url, slug: result.slug, error: result.error });
        }
        // Add a delay to avoid rate limiting issues
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return { successCount, errors };
};

// --- Basic Fetch Functions --- 

export const getAllProblems = async (): Promise<Problem[]> => {
    try {
        const q = query(problemsCollectionRef).withConverter(problemConverter);
        const querySnapshot = await getDocs(q);
        const problems = querySnapshot.docs.map(doc => doc.data());
        return problems;
    } catch (error) {
        console.error("Error fetching all problems: ", error);
        throw new Error("Failed to fetch problems.");
    }
};

export const getProblemById = async (problemId: string): Promise<Problem | null> => {
     try {
        const docRef = doc(db, "problems", problemId).withConverter(problemConverter);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            console.log("No such problem document!");
            return null;
        }
    } catch (error) {
        console.error(`Error fetching problem ${problemId}: `, error);
        throw new Error("Failed to fetch problem.");
    }
}; 