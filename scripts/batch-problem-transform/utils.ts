/**
 * Shared utilities for batch problem transformation
 */

import * as fs from 'fs';
import * as path from 'path';
import { BatchMetadata } from './types';

// Directory paths
export const SCRIPT_DIR = path.resolve(__dirname);
export const INPUT_DIR = path.join(SCRIPT_DIR, 'input');
export const OUTPUT_DIR = path.join(SCRIPT_DIR, 'output');
export const BATCH_PROMPTS_DIR = path.join(OUTPUT_DIR, 'batch_prompts');
export const BATCH_JOBS_DIR = path.join(OUTPUT_DIR, 'batch_jobs');
export const BATCH_RESULTS_DIR = path.join(OUTPUT_DIR, 'batch_results');

/**
 * Ensure all required directories exist
 */
export function ensureDirectories(): void {
  const dirs = [
    INPUT_DIR,
    OUTPUT_DIR,
    BATCH_PROMPTS_DIR,
    BATCH_JOBS_DIR,
    BATCH_RESULTS_DIR,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Read problem IDs from input file
 */
export function readProblemIds(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

/**
 * Read company IDs from input file
 */
export function readCompanyIds(filePath: string): string[] {
  return readProblemIds(filePath); // Same logic
}

/**
 * Generate custom ID for batch request
 * Format: {problemId}_{companyId}_{roleFamily}_{6-digit-index}
 */
export function generateCustomId(
  problemId: string,
  companyId: string,
  roleFamily: string,
  index: number
): string {
  const indexStr = index.toString().padStart(6, '0');
  return `${problemId}_${companyId}_${roleFamily}_${indexStr}`;
}

/**
 * Parse custom ID back into components
 */
export function parseCustomId(customId: string): {
  problemId: string;
  companyId: string;
  roleFamily: string;
  index: number;
} | null {
  // Format: {problemId}_{companyId}_{roleFamily}_{6-digit-index}
  const parts = customId.split('_');

  if (parts.length < 4) {
    return null;
  }

  // Last part is index, second-to-last is roleFamily
  const index = parseInt(parts[parts.length - 1], 10);
  const roleFamily = parts[parts.length - 2];
  const companyId = parts[parts.length - 3];

  // Everything before companyId is problemId (may contain underscores)
  const problemId = parts.slice(0, parts.length - 3).join('_');

  if (isNaN(index)) {
    return null;
  }

  return { problemId, companyId, roleFamily, index };
}

/**
 * Generate batch name with timestamp
 * Format: batch_{number}_{YYYYMMDD}_{HHMMSS}
 */
export function generateBatchName(batchNumber: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const batchNum = String(batchNumber).padStart(3, '0');
  const dateStr = `${year}${month}${day}`;
  const timeStr = `${hours}${minutes}${seconds}`;

  return `batch_${batchNum}_${dateStr}_${timeStr}`;
}

/**
 * Get next batch index by checking existing files
 */
export function getNextBatchIndex(): number {
  if (!fs.existsSync(BATCH_PROMPTS_DIR)) {
    return 1;
  }

  const files = fs.readdirSync(BATCH_PROMPTS_DIR);
  const batchFiles = files.filter(f => f.startsWith('batch_') && f.endsWith('.jsonl'));

  if (batchFiles.length === 0) {
    return 1;
  }

  // Extract batch numbers from filenames
  const batchNumbers = batchFiles.map(filename => {
    const match = filename.match(/^batch_(\d+)_/);
    return match ? parseInt(match[1], 10) : 0;
  });

  return Math.max(...batchNumbers) + 1;
}

/**
 * Format timestamp to ISO string
 */
export function formatTimestamp(date?: Date): string {
  return (date || new Date()).toISOString();
}

/**
 * Save batch metadata to JSON file
 */
export function saveBatchMetadata(metadata: BatchMetadata): void {
  const filename = `${metadata.batch_name}_metadata.json`;
  const filePath = path.join(BATCH_JOBS_DIR, filename);

  fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * Load batch metadata from JSON file
 */
export function loadBatchMetadata(batchName: string): BatchMetadata | null {
  const filename = `${batchName}_metadata.json`;
  const filePath = path.join(BATCH_JOBS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as BatchMetadata;
  } catch (error) {
    console.error(`Error loading metadata from ${filePath}:`, error);
    return null;
  }
}

/**
 * Get all batch metadata files
 */
export function getAllBatchMetadata(): BatchMetadata[] {
  if (!fs.existsSync(BATCH_JOBS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(BATCH_JOBS_DIR);
  const metadataFiles = files.filter(f => f.endsWith('_metadata.json'));

  const allMetadata: BatchMetadata[] = [];

  for (const file of metadataFiles) {
    const filePath = path.join(BATCH_JOBS_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const metadata = JSON.parse(content) as BatchMetadata;
      allMetadata.push(metadata);
    } catch (error) {
      console.error(`Error loading metadata from ${file}:`, error);
    }
  }

  return allMetadata;
}

/**
 * Discover unsubmitted batch prompt files
 * (JSONL files in batch_prompts/ that don't have corresponding metadata)
 */
export function discoverUnsubmittedBatchFiles(): string[] {
  if (!fs.existsSync(BATCH_PROMPTS_DIR)) {
    return [];
  }

  const promptFiles = fs.readdirSync(BATCH_PROMPTS_DIR);
  const jsonlFiles = promptFiles.filter(f => f.endsWith('.jsonl'));

  const unsubmitted: string[] = [];

  for (const file of jsonlFiles) {
    const batchName = path.basename(file, '.jsonl');
    const metadata = loadBatchMetadata(batchName);

    if (!metadata) {
      unsubmitted.push(path.join(BATCH_PROMPTS_DIR, file));
    }
  }

  return unsubmitted;
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

/**
 * Logging utility with colored output
 */
export function log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info'): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}]`;

  switch (level) {
    case 'info':
      console.log(`${prefix} ℹ️  ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} ⚠️  ${message}`);
      break;
    case 'error':
      console.error(`${prefix} ❌ ${message}`);
      break;
    case 'success':
      console.log(`${prefix} ✅ ${message}`);
      break;
  }
}

/**
 * System prompt for transformation
 */
export const TRANSFORMATION_SYSTEM_PROMPT = `You are an expert technical interviewer who specializes in creating algorithm and data structure problems for software engineering interviews.
Your task is to transform coding problems into realistic company-specific interview scenarios while preserving their algorithmic essence.
Your scenarios should feel like actual questions a candidate would receive in a technical interview, with appropriate domain-specific framing that aligns with the company's business and technology.`;
