import { adminDb } from "@/lib/firebase/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";
import { Problem, TestCase, ProblemDifficulty } from "@/data-types/problem";
import { TestCaseResult } from '../../data-types/execution';
import { Judge0Client, Judge0SubmissionDetail } from '../code-execution/judge0Client';
import {
    aggregateBatchResults,
    orchestrateJudge0Submission,
    OrchestratedSubmissionInput
} from '../code-execution/codeExecution';
import judge0DefaultConfig from '../code-execution/judge0Config';
import { getCachedProblem, cacheProblem } from './requestCache';

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

// Helper function for converting Problem objects to Firestore data (Admin SDK)
const convertProblemToFirestore = (
    modelObject: Partial<Problem>
): Record<string, unknown> => {
    const data = { ...modelObject } as Partial<Problem>;
    delete data.id;
    
    data.updatedAt = Timestamp.now();
    if (!data.createdAt) {
        data.createdAt = Timestamp.now();
    }
    
    if (data.createdAt instanceof Date) {
        data.createdAt = Timestamp.fromDate(data.createdAt);
    }
    if (data.updatedAt instanceof Date) {
        data.updatedAt = Timestamp.fromDate(data.updatedAt);
    }
    return data as Record<string, unknown>;
};

// Helper function for converting Firestore data to Problem objects (Admin SDK)
const convertFirestoreToProblem = (doc: FirebaseFirestore.DocumentSnapshot): Problem => {
    const data = doc.data()!;
    return {
        id: doc.id,
        title: typeof data.title === 'string' ? data.title : "Untitled Problem",
        difficulty: typeof data.difficulty === 'string' ? data.difficulty as ProblemDifficulty : "Medium",
        categories: Array.isArray(data.categories) ? data.categories : [],
        description: typeof data.description === 'string' ? data.description : "No description",
        constraints: Array.isArray(data.constraints) ? data.constraints : [],
        leetcodeLink: typeof data.leetcodeLink === 'string' ? data.leetcodeLink : `https://leetcode.com/problems/${doc.id}/`,
        isBlind75: typeof data.isBlind75 === 'boolean' ? data.isBlind75 : false,
        testCases: Array.isArray(data.testCases) ? data.testCases.map((tc: Record<string, unknown>) => ({
            stdin: (tc.stdin as string) || '',
            expectedStdout: (tc.expectedStdout as string) || '',
            explanation: tc.explanation as string | undefined,
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

            } catch (verificationError: unknown) {
                console.error(`Error during test case verification for ${slug}: `, verificationError);
                // If it's a known error type like LanguageNotSupported, propagate it.
                // Replaced LanguageNotSupportedError check with a more general one for now
                if (verificationError instanceof Error && (verificationError.name === "LanguageNotSupportedError" || verificationError.message.includes("Unsupported language") || verificationError.message.includes("orchestration"))) {
                     return { success: false, slug, error: `Verification failed: ${verificationError.message}` };
                }
                // Use the custom VerificationError for other verification specific issues if applicable
                if (verificationError instanceof VerificationError) {
                    return { success: false, slug, error: verificationError.message };
                }
                return { success: false, slug, error: `An unexpected error occurred during test case verification: ${(verificationError instanceof Error ? verificationError.message : String(verificationError))}` };
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
        const db = adminDb();
        const docRef = db.collection("problems").doc(slug);

        // Save to Firestore (will add timestamps via converter)
        await docRef.set(convertProblemToFirestore(problem));

        console.log(`Successfully fetched and imported problem: ${slug}`);
        return { success: true, slug: slug };

    } catch (error: unknown) {
        console.error(`Error fetching/importing problem ${slug}: `, error);
        return { success: false, slug: slug, error: (error instanceof Error ? error.message : String(error)) || "Unknown error occurred during fetch/import." };
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

// --- Basic Fetch Functions --- 

export const getAllProblems = async (): Promise<Problem[]> => {
    try {
        const db = adminDb();
        const problemsCollectionRef = db.collection("problems");
        const querySnapshot = await problemsCollectionRef.get();
        const problems = querySnapshot.docs.map((doc: FirebaseFirestore.DocumentSnapshot) => convertFirestoreToProblem(doc));
        return problems;
    } catch (error) {
        console.error("Error fetching all problems: ", error);
        throw new Error("Failed to fetch problems.");
    }
};

export const getProblemsbyDifficulty = async (difficulty: ProblemDifficulty): Promise<Problem[]> => {
    try {
        const db = adminDb();
        const problemsCollectionRef = db.collection("problems");
        const querySnapshot = await problemsCollectionRef.where("difficulty", "==", difficulty).get();
        const problems = querySnapshot.docs.map((doc: FirebaseFirestore.DocumentSnapshot) => convertFirestoreToProblem(doc));
        return problems;
    } catch (error) {
        console.error(`Error fetching problems with difficulty ${difficulty}: `, error);
        throw new Error(`Failed to fetch ${difficulty} problems.`);
    }
};

export const getBlind75Problems = async (): Promise<Problem[]> => {
    try {
        const db = adminDb();
        const problemsCollectionRef = db.collection("problems");
        const querySnapshot = await problemsCollectionRef.where("isBlind75", "==", true).get();
        const problems = querySnapshot.docs.map((doc: FirebaseFirestore.DocumentSnapshot) => convertFirestoreToProblem(doc));
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
        const db = adminDb();
        const collection = db.collection("problems");
        
        let querySnapshot;
        if (difficulty) {
            // Filter by both isBlind75 and difficulty
            querySnapshot = await collection.where("isBlind75", "==", isBlind75).where("difficulty", "==", difficulty).get();
        } else {
            // Filter by isBlind75 only
            querySnapshot = await collection.where("isBlind75", "==", isBlind75).get();
        }
        const problems = querySnapshot.docs.map((doc: FirebaseFirestore.DocumentSnapshot) => convertFirestoreToProblem(doc));
        return problems;
    } catch (error) {
        console.error(`Error fetching filtered problems (isBlind75=${isBlind75}, difficulty=${difficulty}): `, error);
        throw new Error("Failed to fetch filtered problems.");
    }
};

export const getProblemById = async (problemId: string): Promise<Problem | null> => {
     try {
        // Check request-level cache first (latency optimization)
        const cachedProblem = getCachedProblem(problemId);
        if (cachedProblem) {
            return cachedProblem;
        }

        // Cache miss - fetch from Firestore
        const db = adminDb();
        const docRef = db.collection("problems").doc(problemId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const problem = convertFirestoreToProblem(docSnap);
            // Cache the result for subsequent requests
            cacheProblem(problemId, problem);
            return problem;
        } else {
            console.log("No such problem document!");
            return null;
        }
    } catch (error) {
        console.error(`Error fetching problem ${problemId}: `, error);
        throw new Error("Failed to fetch problem.");
    }
}; 