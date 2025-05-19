import fetch from 'node-fetch'; // Assuming node-fetch is available

interface Judge0ClientOptions {
  apiUrl: string;
  apiKey: string;
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
}

export class Judge0Client {
  private apiUrl: string;
  private apiKey: string;

  constructor(options: Judge0ClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, ''); // Remove trailing slash if any
    this.apiKey = options.apiKey;
  }

  /**
   * Helper function to delay execution
   * @param ms milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Makes a request with retry logic for rate limiting
   */
  private async requestWithRetry<T>(
    endpoint: string, 
    method: 'GET' | 'POST' = 'POST', 
    body?: any, 
    maxRetries: number = 3,
    initialDelayMs: number = 100
  ): Promise<T> {
    let retries = 0;
    let delayMs = initialDelayMs;

    while (true) {
      try {
        return await this.request<T>(endpoint, method, body);
      } catch (error) {
        // If it's a rate limit error (429) and we have retries left
        if (error instanceof Error && 
            error.message.includes('429') && 
            retries < maxRetries) {
          
          retries++;
          console.log(`Rate limited (429). Retry ${retries}/${maxRetries} after ${delayMs}ms delay`);
          
          // Wait before retrying with exponential backoff
          await this.delay(delayMs);
          
          // Exponential backoff with jitter
          delayMs = delayMs * 2 * (0.8 + Math.random() * 0.4);
        } else {
          // Either not a rate limit error or we're out of retries
          throw error;
        }
      }
    }
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

    const url = `${this.apiUrl}${endpoint}`;
    console.log(`Making ${method} request to: ${url}`);
    
    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}): ${errorText}`);
        throw new Error(`Judge0 API error (${response.status}): ${errorText || response.statusText}`);
      }
      
      if (response.status === 204) { // No Content
        return undefined as T; 
      }
      
      const responseData = await response.json();
      return responseData as T;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Request failed: ${error.message}`);
        if (body && method === 'POST') {
          // Log first item in submissions array if it exists (for debugging)
          if (body.submissions && Array.isArray(body.submissions) && body.submissions.length > 0) {
            console.log(`First submission in batch: ${JSON.stringify(body.submissions[0]).substring(0, 200)}...`);
            console.log(`Batch size: ${body.submissions.length}`);
          }
        }
      }
      throw error;
    }
  }

  /**
   * Submits a single code submission to Judge0.
   * @param submission A single submission object
   * @returns A promise that resolves to a token response
   */
  async createSingleSubmission(
    submission: Judge0BatchSubmissionItem,
    base64Encoded: boolean = false
  ): Promise<Judge0BatchCreationTokenResponse> {
    const endpoint = `/submissions?base64_encoded=${base64Encoded}&wait=false`;
    
    try {
      // For single submissions, we submit directly without the "submissions" wrapper
      return await this.requestWithRetry<Judge0BatchCreationTokenResponse>(
        endpoint,
        'POST',
        submission
      );
    } catch (error) {
      console.error(`Error in single submission:`, error);
      throw error;
    }
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
    base64Encoded: boolean = false, // Judge0 defaults to false for source_code
    forceSingleMode: boolean = false // Force single submission mode
  ): Promise<Judge0BatchCreationTokenResponse[]> {
    const MAX_SUBMISSIONS_PER_BATCH = 20;
    let allResults: Judge0BatchCreationTokenResponse[] = [];

    if (submissions.length === 0) {
      return [];
    }

    // Log total submission count
    console.log(`Processing ${submissions.length} submissions in batches of max ${MAX_SUBMISSIONS_PER_BATCH}`);

    // If forced single mode or only one submission, use single submission mode
    if (forceSingleMode || submissions.length === 1) {
      console.log(`Using single submission mode for ${submissions.length} submissions`);
      
      for (let i = 0; i < submissions.length; i++) {
        try {
          const result = await this.createSingleSubmission(submissions[i], base64Encoded);
          allResults.push(result);
          
          // Add a small delay between submissions to avoid rate limiting
          if (i < submissions.length - 1) {
            await this.delay(100);
          }
        } catch (error) {
          console.error(`Error in single submission mode at index ${i}:`, error);
          throw error;
        }
      }
      
      return allResults;
    }

    // Process submissions in chunks of MAX_SUBMISSIONS_PER_BATCH
    let batchError = false;
    
    try {
      for (let i = 0; i < submissions.length && !batchError; i += MAX_SUBMISSIONS_PER_BATCH) {
        const chunk = submissions.slice(i, i + MAX_SUBMISSIONS_PER_BATCH);
        
        // CRITICAL: Verify chunk size is within limits
        if (chunk.length > MAX_SUBMISSIONS_PER_BATCH) {
          console.error(`Chunk size (${chunk.length}) exceeds maximum allowed (${MAX_SUBMISSIONS_PER_BATCH}). Truncating.`);
          chunk.length = MAX_SUBMISSIONS_PER_BATCH; // Force truncate if somehow exceeded
        }
        
        console.log(`Submitting batch ${Math.floor(i/MAX_SUBMISSIONS_PER_BATCH) + 1} with ${chunk.length} submissions`);
        
        // Only add callback URL to the payload if provided
        const payload: { submissions: Judge0BatchSubmissionItem[], callback_url?: string } = {
          submissions: chunk
        };

        if (callbackUrl) {
          payload.callback_url = callbackUrl;
        }

        // Build the URL with the base64_encoded parameter
        const endpoint = `/submissions/batch?base64_encoded=${base64Encoded}&wait=false`;
        
        try {
          // For debugging - log the payload size
          console.log(`Payload size: ${JSON.stringify(payload).length} characters`);
          
          const batchResults = await this.requestWithRetry<Judge0BatchCreationTokenResponse[]>(
            endpoint,
            'POST',
            payload
          );
          
          if (batchResults && Array.isArray(batchResults)) {
            console.log(`Successfully received ${batchResults.length} tokens for batch`);
            allResults = allResults.concat(batchResults);
            
            // Add a delay between batches to avoid rate limiting
            if (i + MAX_SUBMISSIONS_PER_BATCH < submissions.length) {
              const delayMs = 100;
              console.log(`Adding ${delayMs}ms delay between batches to avoid rate limiting`);
              await this.delay(delayMs);
            }
          } else {
            console.warn(`Unexpected batch result format:`, batchResults);
            batchError = true;
          }
        } catch (error) {
          console.error(`Error in batch at index ${i} (batch size: ${chunk.length}):`, error);
          batchError = true;
          break;
        }
      }
    } catch (error) {
      console.error("Batch mode failed, falling back to single mode");
      batchError = true;
    }
    
    // If batch mode failed, try again with single mode
    if (batchError && !forceSingleMode) {
      console.log("Retrying with single submission mode");
      return this.createBatchSubmissions(submissions, callbackUrl, base64Encoded, true);
    }
    
    console.log(`Total tokens received: ${allResults.length}`);
    return allResults;
  }

  /**
   * Fetches the details of multiple submissions using their tokens.
   * @param tokens A comma-separated string of submission tokens or an array of tokens.
   * @returns A promise that resolves to an object containing a list of submission details.
   */
  async getBatchSubmissionDetails(
    tokens: string | string[]
  ): Promise<{ submissions: Judge0SubmissionDetail[] }> {
    // Convert tokens to array if it's a string
    const tokenArray = typeof tokens === 'string' 
      ? tokens.split(',').filter(token => token.trim() !== '')
      : tokens;

    if (!tokenArray || tokenArray.length === 0) {
      return { submissions: [] };
    }

    console.log(`Fetching details for ${tokenArray.length} submissions in batches of max 20`);
    
    const MAX_TOKENS_PER_BATCH = 20;
    let allSubmissions: Judge0SubmissionDetail[] = [];

    // Process tokens in batches of MAX_TOKENS_PER_BATCH
    for (let i = 0; i < tokenArray.length; i += MAX_TOKENS_PER_BATCH) {
      const chunk = tokenArray.slice(i, i + MAX_TOKENS_PER_BATCH);
      const chunkTokensString = chunk.join(',');
      
      console.log(`Fetching batch ${Math.floor(i/MAX_TOKENS_PER_BATCH) + 1} with ${chunk.length} tokens`);
      
      try {
        // Judge0 expects tokens as a comma-separated string for batch GET.
        const endpoint = `/submissions/batch?tokens=${chunkTokensString}&fields=*&base64_encoded=false`;
        const batchResult = await this.requestWithRetry<{ submissions: Judge0SubmissionDetail[] }>(
          endpoint, 
          'GET',
          undefined,
          5, // More retries for status checks
          1500 // Longer initial delay for status checks
        );
        
        if (batchResult && batchResult.submissions) {
          allSubmissions = allSubmissions.concat(batchResult.submissions);
          console.log(`Successfully received details for ${batchResult.submissions.length} submissions`);
          
          // Add a delay between batches to avoid rate limiting
          if (i + MAX_TOKENS_PER_BATCH < tokenArray.length) {
            const delayMs = 100;
            console.log(`Adding ${delayMs}ms delay between status check batches to avoid rate limiting`);
            await this.delay(delayMs);
          }
        } else {
          console.warn('Unexpected batch result format for status check:', batchResult);
        }
      } catch (error) {
        console.error(`Error fetching details for batch starting at token ${i}:`, error);
        throw error;
      }
    }

    return { submissions: allSubmissions };
  }

  /**
   * Fetches the details of a single submission using its token.
   * @param token The submission token.
   * @returns A promise that resolves to the submission details.
   */
  async getSubmissionDetails(token: string): Promise<Judge0SubmissionDetail> {
    return this.requestWithRetry<Judge0SubmissionDetail>(
      `/submissions/${token}?fields=*&base64_encoded=false`,
      'GET'
    );
  }
} 