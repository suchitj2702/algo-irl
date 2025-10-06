/**
 * Type definitions for batch problem transformation
 */

import { RoleFamily } from '../../data-types/role';

/**
 * OpenAI Batch API request format
 * @see https://platform.openai.com/docs/api-reference/batch
 */
export interface OpenAIBatchRequest {
  custom_id: string;
  method: 'POST';
  url: '/v1/chat/completions';
  body: {
    model: string;
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
    max_tokens: number;
  };
}

/**
 * Batch job metadata stored locally
 */
export interface BatchMetadata {
  /** OpenAI batch job ID */
  batch_id: string;

  /** Human-readable batch name (e.g., "batch_001_20250103_143022") */
  batch_name: string;

  /** Path to the prompt JSONL file */
  prompt_file: string;

  /** Current status of the batch job */
  status: 'pending' | 'validating' | 'in_progress' | 'finalizing' | 'completed' | 'failed' | 'expired' | 'cancelling' | 'cancelled';

  /** Number of transformation requests in this batch */
  request_count: number;

  /** ISO timestamp when batch was created */
  created_at: string;

  /** ISO timestamp when status was last checked */
  last_checked: string;

  /** ISO timestamp when batch completed (if completed) */
  completed_at?: string;

  /** Path to downloaded results file (if completed) */
  result_file?: string;

  /** OpenAI file ID for the input file */
  input_file_id?: string;

  /** OpenAI file ID for the output file */
  output_file_id?: string;

  /** Request count breakdown (from OpenAI API) */
  request_counts?: {
    total: number;
    completed: number;
    failed: number;
  };
}

/**
 * Parsed transformation result from batch output
 */
export interface TransformationResult {
  /** Custom ID from the request */
  custom_id: string;

  /** Parsed problem ID */
  problem_id: string;

  /** Parsed company ID */
  company_id: string;

  /** Parsed role family */
  role_family: RoleFamily;

  /** Raw LLM response content */
  scenario_text: string;

  /** Whether the result was successfully processed */
  success: boolean;

  /** Error message if processing failed */
  error?: string;
}

/**
 * Transformation cache entry to be saved to Firestore
 */
export interface TransformationCacheEntry {
  problemId: string;
  companyId: string;
  roleFamily: RoleFamily;
  scenario: string;
  functionMapping: Record<string, string>;
  contextInfo: {
    detectedAlgorithms: string[];
    detectedDataStructures: string[];
    relevanceScore: number;
    suggestedAnalogyPoints: string[];
  };
}

/**
 * Summary of batch processing results
 */
export interface BatchProcessingSummary {
  /** Total results processed */
  total_processed: number;

  /** Successfully saved to cache */
  successfully_cached: number;

  /** Failed to process */
  failed: number;

  /** Parsing errors */
  parsing_errors: number;

  /** Error details */
  errors: Array<{
    custom_id: string;
    error_type: string;
    error_message: string;
  }>;
}

/**
 * Configuration for prompt generation
 */
export interface PromptGenerationConfig {
  /** OpenAI model to use */
  model: string;

  /** Maximum tokens for response */
  max_tokens: number;

  /** System prompt template */
  system_prompt: string;
}
