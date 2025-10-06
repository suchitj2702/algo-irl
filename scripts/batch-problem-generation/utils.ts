/**
 * Shared utilities for batch problem generation scripts
 */

import * as fs from 'fs';
import * as path from 'path';
import { BatchMetadata } from './types';

/**
 * Base directory for batch problem generation
 */
export const BASE_DIR = path.join(__dirname);
export const INPUT_DIR = path.join(BASE_DIR, 'input');
export const OUTPUT_DIR = path.join(BASE_DIR, 'output');
export const BATCH_PROMPTS_DIR = path.join(OUTPUT_DIR, 'batch-prompts');
export const BATCH_JOBS_DIR = path.join(OUTPUT_DIR, 'batch-jobs');
export const BATCH_RESULTS_DIR = path.join(OUTPUT_DIR, 'batch-results');

/**
 * Ensure all required directories exist
 */
export function ensureDirectories(): void {
  [INPUT_DIR, OUTPUT_DIR, BATCH_PROMPTS_DIR, BATCH_JOBS_DIR, BATCH_RESULTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Read problem URLs from input file
 */
export function readProblemUrls(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#')); // Filter empty lines and comments
}

/**
 * Save batch metadata to JSON file
 */
export function saveBatchMetadata(metadata: BatchMetadata): void {
  const filePath = path.join(BATCH_JOBS_DIR, `${metadata.batch_name}_metadata.json`);
  fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * Load batch metadata from JSON file
 */
export function loadBatchMetadata(batchName: string): BatchMetadata | null {
  const filePath = path.join(BATCH_JOBS_DIR, `${batchName}_metadata.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as BatchMetadata;
}

/**
 * Get all batch metadata files
 */
export function getAllBatchMetadata(): BatchMetadata[] {
  if (!fs.existsSync(BATCH_JOBS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(BATCH_JOBS_DIR)
    .filter(file => file.endsWith('_metadata.json'));

  return files.map(file => {
    const content = fs.readFileSync(path.join(BATCH_JOBS_DIR, file), 'utf-8');
    return JSON.parse(content) as BatchMetadata;
  });
}

/**
 * Discover all batch prompt files that haven't been submitted yet
 */
export function discoverUnsubmittedBatchFiles(): string[] {
  if (!fs.existsSync(BATCH_PROMPTS_DIR)) {
    return [];
  }

  const promptFiles = fs.readdirSync(BATCH_PROMPTS_DIR)
    .filter(file => file.endsWith('.jsonl'))
    .map(file => path.join(BATCH_PROMPTS_DIR, file));

  // Check which ones don't have metadata yet
  const existingMetadata = getAllBatchMetadata();
  const submittedFiles = new Set(existingMetadata.map(m => m.prompt_file));

  return promptFiles.filter(file => !submittedFiles.has(file));
}

/**
 * Generate batch name from index
 */
export function generateBatchName(index: number): string {
  return `batch_${String(index).padStart(3, '0')}`;
}

/**
 * Get next available batch index
 */
export function getNextBatchIndex(): number {
  if (!fs.existsSync(BATCH_PROMPTS_DIR)) {
    return 1;
  }

  const files = fs.readdirSync(BATCH_PROMPTS_DIR)
    .filter(file => file.startsWith('batch_') && file.endsWith('.jsonl'));

  if (files.length === 0) {
    return 1;
  }

  const indices = files.map(file => {
    const match = file.match(/batch_(\d+)\.jsonl/);
    return match ? parseInt(match[1], 10) : 0;
  });

  return Math.max(...indices) + 1;
}

/**
 * Format timestamp for logging
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Log with timestamp
 */
export function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '✓',
    warn: '⚠',
    error: '✗'
  }[level];

  console.log(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Count lines in JSONL file
 */
export function countJsonlLines(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').filter(line => line.trim()).length;
}

// Re-export problem generation utilities from problemDatastoreUtils
// This keeps all problem-specific logic centralized in one place
export {
  PROBLEM_GENERATION_SYSTEM_PROMPT,
  getProblemDataGenerationPrompt,
  extractSlugFromUrl,
  slugToProblemName,
} from '../../lib/problem/problemDatastoreUtils';
