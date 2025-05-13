import fetch from 'node-fetch'; // Assuming node-fetch is available

interface Judge0ClientOptions {
  apiUrl: string;
  apiKey: string;
  // callbackUrl is now passed per batch if needed, not globally for the client
}

interface Judge0SubmissionRequest {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  wall_time_limit?: number; // Optional: seconds
  memory_limit?: number;    // Optional: kilobytes
  // Add other Judge0 submission parameters as needed
}

// Represents the response structure for a single submission token from Judge0 batch creation
interface Judge0BatchCreationTokenResponse {
  token: string;
}

// Represents a single submission object when creating a batch
export interface Judge0BatchSubmissionItem {
  language_id: number;
  source_code: string;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;   // CPU time limit in seconds
  memory_limit?: number;     // Memory limit in KB
  wall_time_limit?: number;  // Wall time limit in seconds
  // Add any other per-submission parameters Judge0 allows in a batch
}

// Represents the structure of a submission result from Judge0
// (can be more detailed based on Judge0 API docs for submission details)
export interface Judge0SubmissionDetail {
  token: string;
  status: { id: number; description: string };
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  message?: string;
  time?: string; // e.g., "0.002"
  memory?: number; // in kilobytes
  // Add other fields like wall_time, exit_code, etc.
}

export class Judge0Client {
  private apiUrl: string;
  private apiKey: string;

  constructor(options: Judge0ClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, ''); // Remove trailing slash if any
    this.apiKey = options.apiKey;
  }

  private async request<T>(endpoint: string, method: 'GET' | 'POST' = 'POST', body?: any): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': this.apiKey,
      'X-RapidAPI-Host': new URL(this.apiUrl).host,
    };

    const config: any = {
      method,
      headers,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.apiUrl}${endpoint}`, config);

    if (!response.ok) {
      const errorData = await response.text(); // Try to get text for more detailed errors
      throw new Error(`Judge0 API error (${response.status}): ${errorData || response.statusText}`);
    }
    if (response.status === 204) { // No Content
        return undefined as T; 
    }
    return response.json() as Promise<T>;
  }

  /**
   * Submits a batch of code submissions to Judge0.
   * @param submissions Array of submission objects for the batch.
   * @param callbackUrl Optional callback URL for Judge0 to POST results to when all are processed.
   * @returns A promise that resolves to an array of token objects, each containing a submission token.
   */
  async createBatchSubmissions(
    submissions: Judge0BatchSubmissionItem[],
    callbackUrl?: string,
    base64Encoded: boolean = false // Judge0 defaults to false for source_code
  ): Promise<Judge0BatchCreationTokenResponse[]> {
    const MAX_SUBMISSIONS_PER_BATCH = 20;
    let allResults: Judge0BatchCreationTokenResponse[] = [];

    // Determine if callback should be used: Only if provided AND total submissions <= batch limit.
    const shouldUseCallback = callbackUrl && submissions.length <= MAX_SUBMISSIONS_PER_BATCH;

    if (submissions.length === 0) {
      return [];
    }

    for (let i = 0; i < submissions.length; i += MAX_SUBMISSIONS_PER_BATCH) {
      const chunk = submissions.slice(i, i + MAX_SUBMISSIONS_PER_BATCH);
      // Construct payload without callback initially
      const payload: { submissions: Judge0BatchSubmissionItem[], callback_url?: string, base64_encoded?: boolean } = {
         submissions: chunk,
         base64_encoded: base64Encoded 
      };

      // Add callback URL only if determined appropriate for the entire submission set
      if (shouldUseCallback) {
        payload.callback_url = callbackUrl;
      }
      // payload.base64_encoded = base64Encoded; // Already set above

      // The /submissions/batch endpoint expects a JSON object with a "submissions" key.
      // We assume that if a callbackUrl is provided, it should apply to all batches.
      // Judge0 might have specific behavior for multiple batch calls with the same callback;
      // this implementation assumes it handles it or that the user manages distinct callbacks if needed.
      const batchResults = await this.request<Judge0BatchCreationTokenResponse[]>(
        '/submissions/batch?base64_encoded=false&wait=false', // wait=false is typical for batching
        'POST',
        payload
      );
      allResults = allResults.concat(batchResults);
    }
    return allResults;
  }

  /**
   * Fetches the details of multiple submissions using their tokens.
   * @param tokens A comma-separated string of submission tokens.
   * @returns A promise that resolves to an object containing a list of submission details.
   */
  async getBatchSubmissionDetails(tokens: string): Promise<{ submissions: Judge0SubmissionDetail[] }> {
    if (!tokens) {
      return { submissions: [] };
    }
    // Judge0 expects tokens as a comma-separated string for batch GET.
    // Fields=* can be used to get all fields, or specify desired ones.
    return this.request<{ submissions: Judge0SubmissionDetail[] }>(
      `/submissions/batch?tokens=${tokens}&fields=*&base64_encoded=false`,
      'GET'
    );
  }

  /**
   * Fetches the details of a single submission using its token.
   * @param token The submission token.
   * @returns A promise that resolves to the submission details.
   */
  async getSubmissionDetails(token: string): Promise<Judge0SubmissionDetail> {
    return this.request<Judge0SubmissionDetail>(
      `/submissions/${token}?fields=*&base64_encoded=false`,
      'GET'
    );
  }
} 