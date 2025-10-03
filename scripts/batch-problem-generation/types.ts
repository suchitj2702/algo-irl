/**
 * Shared types for batch problem generation scripts
 */

/**
 * Claude Batch API request format
 * @see https://docs.anthropic.com/en/api/creating-message-batches
 */
export interface ClaudeBatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    thinking?: {
      type: 'enabled';
      budget_tokens?: number;
    };
    system: string;
    messages: Array<{
      role: 'user';
      content: string;
    }>;
  };
}

/**
 * Batch job metadata stored in JSON files
 */
export interface BatchMetadata {
  batch_id: string;
  batch_name: string;
  prompt_file: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'canceled';
  request_count: number;
  created_at: string;
  last_checked: string;
  completed_at?: string;
  request_counts?: {
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
  results?: {
    total_processed: number;
    successfully_verified: number;
    verification_failed: number;
    uploaded_to_firestore: number;
  };
  error?: string;
}

/**
 * Result from processing a single problem in a batch
 */
export interface ProblemProcessingResult {
  custom_id: string;
  slug: string;
  success: boolean;
  error?: string;
  verified?: boolean;
}

/**
 * Summary statistics for batch processing
 */
export interface BatchProcessingSummary {
  total_problems: number;
  successful_parsing: number;
  failed_parsing: number;
  successful_verification: number;
  failed_verification: number;
  uploaded_to_firestore: number;
  errors: Array<{
    slug: string;
    error: string;
  }>;
}
