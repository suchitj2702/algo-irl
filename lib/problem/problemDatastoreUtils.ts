import {
    collection,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    query,
    DocumentData,
    FirestoreDataConverter,
    Timestamp,
    SetOptions,
    WithFieldValue,
    PartialWithFieldValue,
    setDoc,
    where
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";
import { Problem, TestCase, ProblemDifficulty, LanguageSpecificProblemDetails } from "@/data-types/problem";
import { TestCaseResult } from '../../data-types/execution';
import { Judge0Client, Judge0BatchSubmissionItem, Judge0SubmissionDetail } from '../code-execution/judge0Client';
import { 
    getLanguageId, 
    combineUserCodeWithBoilerplate, 
    aggregateBatchResults, 
    TestResult,
    orchestrateJudge0Submission,
    OrchestratedSubmissionInput
} from '../code-execution/codeExecution';
import judge0DefaultConfig from '../code-execution/judge0Config';

// LLM Service Imports
import {
    getProblemDataGenerationPrompt,
    parseAndProcessProblemData,
    PROBLEM_GENERATION_SYSTEM_PROMPT,
    ProcessedProblemData,
    executeLlmTask
} from "@/lib/llmServices/llmUtils";

// Define a custom error for verification failures
class VerificationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "VerificationError";
    }
}

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
            testCases: Array.isArray(data.testCases) ? data.testCases.map((tc: any) => ({
                stdin: tc.stdin || '',
                expectedStdout: tc.expectedStdout || '',
                explanation: tc.explanation,
                isSample: typeof tc.isSample === 'boolean' ? tc.isSample : false,
            })) : [],
            solutionApproach: typeof data.solutionApproach === 'string' || data.solutionApproach === null ? data.solutionApproach : null,
            timeComplexity: typeof data.timeComplexity === 'string' || data.timeComplexity === null ? data.timeComplexity : null,
            spaceComplexity: typeof data.spaceComplexity === 'string' || data.spaceComplexity === null ? data.spaceComplexity : null,
            languageSpecificDetails: data.languageSpecificDetails || { 
                python: { 
                    solutionFunctionNameOrClassName: 'fallback_func', 
                    solutionStructureHint:'', 
                    defaultUserCode: '', 
                    boilerplateCodeWithPlaceholder: '',
                    optimizedSolutionCode: ''
                } 
            },
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : Timestamp.now(),
        };
    }
};

// Function to fetch and import a single problem by URL, dispatching to configured LLM service
export const fetchAndImportProblemByUrl = async (url: string): Promise<{ success: boolean; slug: string | null; error?: string }> => {
    const slug = extractSlugFromUrl(url);
    if (!slug) {
        return { success: false, slug: null, error: "Invalid LeetCode URL or could not extract slug." };
    }
    const problemName = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    let problemData: ProcessedProblemData;

    try {
        // 1. Generate the prompt for problem data generation
        const problemGenPrompt = getProblemDataGenerationPrompt(problemName, slug);
        
        // 2. Execute the LLM task to get raw response string
        console.log(`Fetching raw problem data for ${slug} using problemGeneration task...`);
        const rawLlmResponse = await executeLlmTask(
            'problemGeneration', 
            problemGenPrompt, 
            PROBLEM_GENERATION_SYSTEM_PROMPT
        );

        // 3. Parse and process the raw response
        problemData = parseAndProcessProblemData(rawLlmResponse, problemName);

        if (problemData.error) {
            console.error(`Error processing LLM response for ${slug}: ${problemData.error}`);
            return { success: false, slug, error: `Failed to process LLM response: ${problemData.error}` };
        }

        // --- Test Case Verification Step (using problemData) ---
        const primaryLanguage = 'python'; 
        const langDetails = problemData.languageSpecificDetails?.[primaryLanguage];

        if (langDetails && langDetails.optimizedSolutionCode && langDetails.boilerplateCodeWithPlaceholder && problemData.testCases && problemData.testCases.length > 0) {
            try {
                // Instantiate Judge0Client once
                const judge0Client = new Judge0Client({
                    apiUrl: judge0DefaultConfig.apiUrl,
                    apiKey: judge0DefaultConfig.apiKey,
                });

                const allTestCases: TestCase[] = problemData.testCases;

                // Prepare input for orchestrateJudge0Submission
                const submissionInput: OrchestratedSubmissionInput = {
                    code: langDetails.optimizedSolutionCode,
                    language: primaryLanguage,
                    testCases: allTestCases,
                    boilerplateCode: langDetails.boilerplateCodeWithPlaceholder,
                };
                
                // Call orchestrateJudge0Submission
                const orchestrationOutput = await orchestrateJudge0Submission(judge0Client, submissionInput);

                if (!orchestrationOutput.judge0Tokens || orchestrationOutput.judge0Tokens.length === 0) {
                    throw new VerificationError("Failed to create verification batch submissions using orchestration.");
                }
                const tokensStr = orchestrationOutput.judge0Tokens.map(tr => tr.token).join(',');
                
                // Poll for results using the same client
                const submissionDetails = await pollForResults(judge0Client, tokensStr, allTestCases.length);
                const aggregatedResults = aggregateBatchResults(submissionDetails, allTestCases);

                if (!aggregatedResults.passed) {
                    console.warn(`Verification failed for problem ${slug}. AI Solution did not pass all AI test cases. Overall Error: ${aggregatedResults.error || 'One or more test cases failed.'}`);
                    if (aggregatedResults.testResults) { // Check if testResults is defined
                        // Log details based on the available TestCaseResult fields
                        aggregatedResults.testResults.forEach((tr: TestCaseResult) => { 
                            if (!tr.passed) {
                                // Access fields available on TestCaseResult and its nested testCase
                                const inputSnippet = JSON.stringify(tr.testCase.stdin).substring(0, 100);
                                const expectedSnippet = JSON.stringify(tr.testCase.expectedStdout).substring(0, 100);
                                const actualSnippet = JSON.stringify(tr.actualOutput).substring(0, 100);
                                console.warn(` - Test Case (Input: ${inputSnippet}...): Failed. Expected: ${expectedSnippet}..., Actual: ${actualSnippet}...`);
                            }
                        });
                    }
                    // Use the overall error message from aggregatedResults for the final return
                    return { success: false, slug, error: `AI-generated test cases failed verification. ${aggregatedResults.error || 'Output mismatch'}` };
                }
                 console.log(`Successfully verified AI-generated test cases against its solution for problem: ${slug}`);

            } catch (verificationError: any) {
                console.error(`Error during test case verification for ${slug}: `, verificationError);
                // If it's a known error type like LanguageNotSupported, propagate it.
                // Replaced LanguageNotSupportedError check with a more general one for now
                if (verificationError.name === "LanguageNotSupportedError" || verificationError.message.includes("Unsupported language") || verificationError.message.includes("orchestration")) {
                     return { success: false, slug, error: `Verification failed: ${verificationError.message}` };
                }
                // Use the custom VerificationError for other verification specific issues if applicable
                if (verificationError instanceof VerificationError) {
                    return { success: false, slug, error: verificationError.message };
                }
                return { success: false, slug, error: `An unexpected error occurred during test case verification: ${verificationError.message}` };
            }
        } else {
            console.warn(`Skipping test case verification for ${slug} due to missing Python details, solution, boilerplate, or test cases.`);
        }
        // --- End of Test Case Verification ---

        const processedTestCases: TestCase[] = Array.isArray(problemData.testCases) ? problemData.testCases.map(tc => ({
            stdin: tc.stdin,
            expectedStdout: tc.expectedStdout,
            explanation: tc.explanation,
            isSample: typeof tc.isSample === 'boolean' ? tc.isSample : false,
        })) : [];

        const problem: Omit<Problem, 'id' | 'createdAt' | 'updatedAt'> = {
            title: problemData.title,
            difficulty: problemData.difficulty as ProblemDifficulty,
            categories: problemData.categories,
            description: problemData.description,
            constraints: problemData.constraints,
            leetcodeLink: url,
            isBlind75: false,
            testCases: processedTestCases,
            solutionApproach: problemData.solutionApproach,
            timeComplexity: problemData.timeComplexity,
            spaceComplexity: problemData.spaceComplexity,
            languageSpecificDetails: problemData.languageSpecificDetails || { 
                python: { 
                    solutionFunctionNameOrClassName: 'fallback_func', 
                    solutionStructureHint:'', 
                    defaultUserCode: '', 
                    boilerplateCodeWithPlaceholder: '',
                    optimizedSolutionCode: ''
                } 
            },
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

// Helper function for polling (extracted from previous logic)
async function pollForResults(client: Judge0Client, tokens: string, expectedCount: number): Promise<Judge0SubmissionDetail[]> {
    let submissionDetails: Judge0SubmissionDetail[] = [];
    let attempts = 0;
    const maxPollingAttempts = 15; 
    const pollingIntervalMs = 2000; 

    while (attempts < maxPollingAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollingIntervalMs));
        const batchDetailsResponse = await client.getBatchSubmissionDetails(tokens);
        
        if (batchDetailsResponse && batchDetailsResponse.submissions) {
            const allProcessed = batchDetailsResponse.submissions.every(s => s.status.id > 2);
            if (allProcessed && batchDetailsResponse.submissions.length === expectedCount) {
                submissionDetails = batchDetailsResponse.submissions;
                break;
            }
        }
        attempts++;
    }

    if (submissionDetails.length !== expectedCount) {
        throw new VerificationError(`Polling timeout or results incomplete. Expected ${expectedCount}, got ${submissionDetails.length}.`);
    }
    return submissionDetails;
}

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

export const getProblemsbyDifficulty = async (difficulty: ProblemDifficulty): Promise<Problem[]> => {
    try {
        const q = query(
            problemsCollectionRef,
            // Filter problems by the specified difficulty
            where("difficulty", "==", difficulty)
        ).withConverter(problemConverter);
        const querySnapshot = await getDocs(q);
        const problems = querySnapshot.docs.map(doc => doc.data());
        return problems;
    } catch (error) {
        console.error(`Error fetching problems with difficulty ${difficulty}: `, error);
        throw new Error(`Failed to fetch ${difficulty} problems.`);
    }
};

export const getBlind75Problems = async (): Promise<Problem[]> => {
    try {
        const q = query(
            problemsCollectionRef,
            // Filter problems where isBlind75 is true
            where("isBlind75", "==", true)
        ).withConverter(problemConverter);
        const querySnapshot = await getDocs(q);
        const problems = querySnapshot.docs.map(doc => doc.data());
        return problems;
    } catch (error) {
        console.error("Error fetching Blind 75 problems: ", error);
        throw new Error("Failed to fetch Blind 75 problems.");
    }
};

export const getFilteredProblems = async (
    isBlind75: boolean, 
    difficulty: ProblemDifficulty | null
): Promise<Problem[]> => {
    try {
        let q;
        
        if (difficulty) {
            // Filter by both isBlind75 and difficulty
            q = query(
                problemsCollectionRef,
                where("isBlind75", "==", isBlind75),
                where("difficulty", "==", difficulty)
            ).withConverter(problemConverter);
        } else {
            // Filter by isBlind75 only
            q = query(
                problemsCollectionRef,
                where("isBlind75", "==", isBlind75)
            ).withConverter(problemConverter);
        }
        
        const querySnapshot = await getDocs(q);
        const problems = querySnapshot.docs.map(doc => doc.data());
        return problems;
    } catch (error) {
        console.error(`Error fetching filtered problems (isBlind75=${isBlind75}, difficulty=${difficulty}): `, error);
        throw new Error("Failed to fetch filtered problems.");
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