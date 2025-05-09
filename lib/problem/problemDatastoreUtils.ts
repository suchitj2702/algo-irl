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
import { LeetCode } from "leetcode-query";

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

// Function to fetch and import a single problem by URL using leetcode-query
export const fetchAndImportProblemByUrl = async (url: string): Promise<{ success: boolean; slug: string | null; error?: string }> => {
    const slug = extractSlugFromUrl(url);
    if (!slug) {
        return { success: false, slug: null, error: "Invalid LeetCode URL or could not extract slug." };
    }

    try {
        const leetcode = new LeetCode(); // Initialize the library
        const problemDetails = await leetcode.problem(slug); // Fetch problem details by slug

        // console.log("--- Raw problemDetails from leetcode-query ---");
        // console.log(JSON.stringify(problemDetails, null, 2));
        // console.log("----------------------------------------------");

        if (!problemDetails) {
             return { success: false, slug: slug, error: `Problem details not found for slug: ${slug}` };
        }

        // --- Map fetched data to our Problem interface --- 
        const problemData: Omit<Problem, 'id' | 'createdAt' | 'updatedAt'> = {
            title: problemDetails.title || "Untitled Problem",
            difficulty: (problemDetails.difficulty?.charAt(0).toUpperCase() + problemDetails.difficulty?.slice(1)) as ProblemDifficulty || "Medium",
            categories: problemDetails.topicTags?.map(tag => tag.name) || [],
            description: problemDetails.content || "No description available.", // HTML content
            constraints: [], // Constraints are usually within the HTML content, may need parsing later
            leetcodeLink: url, // Store the original URL
            isBlind75: false, // Default, can be set manually later if needed
            testCases: ((): TestCase[] => {
                if (!problemDetails.exampleTestcases) return [];
                const examples = problemDetails.exampleTestcases.trim().split(/\n\n+/);
                const parsedTestCases: TestCase[] = [];
                for (const example of examples) {
                    const lines = example.split('\n');
                    let rawInput: string | undefined;
                    let rawOutput: string | undefined;
                    for (const line of lines) {
                        if (line.toLowerCase().startsWith('input:')) {
                            rawInput = line.substring(6).trim();
                        } else if (line.toLowerCase().startsWith('output:')) {
                            rawOutput = line.substring(7).trim();
                        }
                    }
                    if (rawInput !== undefined && rawOutput !== undefined) {
                        let parsedOutput: any = rawOutput;
                        try { parsedOutput = JSON.parse(rawOutput); } catch (e) { /* keep as string */ }
                        parsedTestCases.push({ input: { raw: rawInput }, output: parsedOutput });
                    }
                }
                return parsedTestCases;
            })(),
            solutionApproach: null,
            timeComplexity: null,
            spaceComplexity: null,
        };
        // -----------------------------------------------------

        // Get Firestore document reference with converter
        const docRef = doc(problemsCollectionRef, slug).withConverter(problemConverter);

        // Save to Firestore (will add timestamps via converter)
        await setDoc(docRef, problemData);

        console.log(`Successfully fetched and imported problem: ${slug}`);
        return { success: true, slug: slug };

    } catch (error: any) {
        console.error(`Error fetching/importing problem ${slug}: `, error);
        return { success: false, slug: slug, error: error.message || "Unknown error occurred during fetch/import." };
    }
};

// Placeholder function to import multiple problems from URLs (to be implemented)
// Needs adjustment to use the updated fetchAndImportProblemByUrl
export const importProblemsFromUrls = async (urls: string[]): Promise<{ successCount: number; errors: any[] }> => {
    console.warn("importProblemsFromUrls needs review after changes to fetchAndImportProblemByUrl.");
    let successCount = 0;
    const errors: any[] = [];

    // Consider using Promise.allSettled for concurrency and rate limiting
    for (const url of urls) {
        const result = await fetchAndImportProblemByUrl(url);
        if (result.success) {
            successCount++;
        } else {
            errors.push({ url, slug: result.slug, error: result.error });
        }
        // Add a 1-second delay to avoid rate limiting issues
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { successCount, errors };
};

// --- Basic Fetch Functions (using the corrected converter) --- 

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