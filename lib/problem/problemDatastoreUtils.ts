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
    parseAndProcessProblemData,
    ProcessedProblemData,
    executeLlmTask
} from "@/lib/llmServices/llmUtils";

// Re-export parseAndProcessProblemData for convenience
export { parseAndProcessProblemData } from "@/lib/llmServices/llmUtils";

/**
 * System prompt for algorithm problem generation.
 * This prompt instructs the AI to generate comprehensive problem data
 * including test cases, solution approaches, and language-specific details.
 */
export const PROBLEM_GENERATION_SYSTEM_PROMPT = `You are a specialized data generator for algorithm problems.
You know the details of common LeetCode problems.
When given a problem name/slug, generate realistic, detailed problem data.
IMPORTANT: You MUST include comprehensive solution approaches for every problem, providing multiple approaches when applicable.
Your solution approaches should be detailed, including code examples and explanations of how the solutions work. ` +
`Every field requested in the prompt MUST be included in your response. Make the problem description detailed ` +
`and the test cases realistic.`;

/**
 * Generates a comprehensive prompt for LeetCode problem data generation.
 * This function creates detailed instructions for AI to generate complete problem data
 * including test cases, constraints, solution approaches, and language-specific code.
 *
 * @param problemName - The display name of the LeetCode problem
 * @param problemSlug - The URL slug identifier for the problem
 * @returns Comprehensive prompt string for AI problem generation
 */
export function getProblemDataGenerationPrompt(problemName: string, problemSlug: string): string {
    // If language/version specific details are needed later, pass context object
    const pythonVersionString = '3.8'; // Use a generic placeholder if needed in string
    return `Generate structured data for the LeetCode problem "${problemName}" (slug: "${problemSlug}").

Based on your knowledge of this common algorithmic problem, provide the following in a valid JSON format only:
{
  "title": "(string) The full title of the problem.",
  "difficulty": "(string) Easy, Medium, or Hard.",
  "categories": ["(string) Array", "(string) Hash Table"],
  "description": "(string) A detailed problem description. This MUST clearly state the expected function signature or class structure ` +
    `(e.g., for Python using \`typing.List\`): \`from typing import List; def twoSum(nums: List[int], target: int) -> List[int]:\`). ` +
    `Include any helper class definitions (like TreeNode) standard for the problem. If providing code examples within the description, ` +
    `ensure they are formatted as valid JSON strings (e.g., newlines as \\\\n, quotes as \\\\\\", etc.).",
  "constraints": ["(string) 2 <= nums.length <= 10^4", "(string) -10^9 <= nums[i] <= 10^9"],
  "testCases": [
    {
      "stdin": "(string) A JSON string representing the input. Example: {\\\\\\\"nums\\\\\\\": [2, 7, 11, 15], \\\\\\\"target\\\\\\\": 9}",
      "expectedStdout": "(string) A JSON string representing the array of expected output. Example: [0, 1]. If there are multiple correct values for a test case, the expectedStdout should be an array of the correct values.",
      "isSample": true
    }
  ],
  "solutionApproach": "(string) Detailed explanation of efficient solution approaches. Must not be null or empty. No need to include code.",
  "timeComplexity": "(string) Big O time complexity of optimal solution (e.g., O(n)). Must not be null or empty.",
  "spaceComplexity": "(string) Big O space complexity of optimal solution (e.g., O(1) or O(n)). Must not be null or empty.",
  "languageSpecificDetails": {
    "python": {
      "solutionFunctionNameOrClassName": "(string) e.g., twoSum or Solution",
      "solutionStructureHint": "(string) Python (${pythonVersionString}): Example for Python 3.8 compatibility - \`from typing import List; ` +
        `def twoSum(nums: List[int], target: int) -> List[int]:\` or \`from typing import List; class Solution:\\\\n    ` +
        `def twoSum(self, nums: List[int], target: int) -> List[int]:\`",
      "defaultUserCode": "(string) The MINIMAL skeleton code for the user, compatible with ${pythonVersionString}. ` +
        `For type hints, use the 'typing' module. E.g., \`from typing import List; def twoSum(nums: List[int], target: int) -> List[int]:\\\\n    pass\` ` +
        `or \`from typing import List; class Solution:\\\\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\\\\n        pass\`. ` +
        `NO helper classes or solution logic here.",
      "boilerplateCodeWithPlaceholder": "(string) COMPLETE runnable Python script for Judge0, compatible with ${pythonVersionString}. ` +
        `It MUST include imports like \`from typing import List, Dict, Optional\` if type hints such as \`List[int]\` are used. ` +
        `Also include other standard imports (json, sys), helper classes (e.g., TreeNode if relevant for the problem), ` +
        `the placeholder \`%%USER_CODE_PYTHON%%\`, robust stdin/stdout JSON handling, and error handling. Example for Two Sum using \`typing.List\`: ` +
        `import json; import sys; from typing import List; %%USER_CODE_PYTHON%% if __name__ == '__main__': try: input_str = sys.stdin.read(); ` +
        `data = json.loads(input_str); nums_arg = data['nums']; target_arg = data['target']; ` +
        `# Ensure function (e.g. twoSum) is defined by user code; result = twoSum(nums_arg, target_arg); print(json.dumps(result)); ` +
        `except Exception as e: print(f'Execution Error: {str(e)}', file=sys.stderr); sys.exit(1)\\"",
      "optimizedSolutionCode": "(string) The COMPLETE and correct solution code for the function/class specified in solutionFunctionNameOrClassName, ` +
        `compatible with ${pythonVersionString}. This code should be ready to be inserted into the boilerplate placeholder and pass all test cases."
    }
  }
}

IMPORTANT INSTRUCTIONS FOR AI:
1.  The entire response MUST be a single, valid JSON object. Do not include any text, explanations, or markdown formatting like \`\`\`json ` +
    `before or after the JSON object.
2.  Every field specified in the structure above MUST be included.
3.  For the 'testCases' field: Generate 10 diverse test cases. It MUST be a valid JSON array of objects. Each object must be ` +
    `a complete JSON object, and array elements correctly comma-separated. NO TRAILING COMMAS. 'stdin' and 'expectedStdout' fields must be ` +
    `valid JSON STRINGS, meaning special characters (like quotes, newlines) within these strings must be properly escaped ` +
    `(e.g., use \\\\\\\\\\\" for a quote inside the string). Example of a test case object: {\\\"stdin\\\": \\\"{\\\\\\\\\\\"root\\\\\\\\\\\\\": [1,2,3,null,null,4,5]}\\\", ` +
    `\\\"expectedStdout\\\": \\\"[[1],[2,3],[4,5]]\\\", \\\"isSample\\\": true}.
4. CRITICAL: The 'testCases' you generate MUST be correct. Verify that the 'expectedStdout' for each test case is the actual output ` +
    `produced when the corresponding 'stdin' is processed by the 'optimizedSolutionCode' you provide for the primary language (Python). ` +
    `Incorrect test cases are unacceptable.
5. For each test case generated, perform a dry run of the 'optimizedSolutionCode' with the 'stdin' to ensure it is correct. IF IT IS NOT CORRECT, REMOVE IT;`  +
`6. If there are multiple correct values for a test case, the expectedStdout should be an array of the correct values.`;
}

// Define a custom error for verification failures
class VerificationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "VerificationError";
    }
}

/**
 * Extracts the problem's title slug from a LeetCode URL or validates a slug.
 * Supports both formats:
 * - Full URL: "https://leetcode.com/problems/two-sum/" -> "two-sum"
 * - Slug only: "two-sum" -> "two-sum"
 * Returns null if the input is invalid.
 */
export function extractSlugFromUrl(input: string): string | null {
    const trimmedInput = input.trim().replace(/\/$/, ''); // Remove trailing slash

    // First, check if input is already a slug (no protocol, no slashes)
    // Slug format: lowercase letters, numbers, and hyphens only
    if (!trimmedInput.includes('://') && !trimmedInput.includes('/')) {
        if (/^[a-z0-9-]+$/.test(trimmedInput)) {
            return trimmedInput;
        }
        // Invalid slug format
        return null;
    }

    // Try to parse as URL
    try {
        const parsedUrl = new URL(input);
        if (parsedUrl.hostname !== 'leetcode.com') {
            return null;
        }
        const pathParts = parsedUrl.pathname.split('/').filter(part => part !== '');
        if (pathParts.length >= 2 && pathParts[0] === 'problems') {
            return pathParts[1];
        }
        return null;
    } catch {
        // URL parsing failed and it's not a valid slug
        return null;
    }
}

/**
 * Converts a problem slug to a human-readable problem name.
 * Example: "two-sum" -> "Two Sum"
 */
export function slugToProblemName(slug: string): string {
    return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Helper function for converting Problem objects to Firestore data (Admin SDK).
 * Exported for use in batch scripts and API routes.
 */
export function convertProblemToFirestore(
    modelObject: Partial<Problem>
): Record<string, unknown> {
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
}

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
/**
 * Helper function to poll Judge0 for batch submission results.
 * Exported for use in batch scripts and API routes.
 */
export async function pollForResults(client: Judge0Client, tokens: string, expectedCount: number): Promise<Judge0SubmissionDetail[]> {
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