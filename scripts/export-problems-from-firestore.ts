#!/usr/bin/env tsx
/**
 * Export all problems from Firestore to local JSON files
 *
 * Usage: npx tsx scripts/export-problems-from-firestore.ts
 *
 * This script:
 * 1. Connects to Firestore using Firebase Admin SDK
 * 2. Fetches all documents from the 'problems' collection
 * 3. Converts Firestore Timestamps to ISO strings for JSON compatibility
 * 4. Writes each problem as a separate JSON file named {problemId}.json
 * 5. Saves files to scripts/firestore-exports/problems/ (git-ignored)
 */

import * as fs from 'fs';
import * as path from 'path';
import { adminDb } from '../lib/firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

// Configuration
const EXPORT_DIR = path.join(__dirname, 'firestore-exports', 'problems');
const COLLECTION_NAME = 'problems';

/**
 * Ensure export directory exists
 */
function ensureExportDirectory(): void {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    console.log(`✓ Created export directory: ${EXPORT_DIR}`);
  }
}

/**
 * Convert Firestore Timestamps to ISO strings for JSON serialization
 */
function convertTimestampsToISO(data: any): any {
  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(item => convertTimestampsToISO(item));
  }

  if (data !== null && typeof data === 'object') {
    const result: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        result[key] = convertTimestampsToISO(data[key]);
      }
    }
    return result;
  }

  return data;
}

/**
 * Export a single problem document to JSON file
 */
function exportProblemToFile(problemId: string, data: any): void {
  const fileName = `${problemId}.json`;
  const filePath = path.join(EXPORT_DIR, fileName);

  // Convert Timestamps to ISO strings
  const serializedData = convertTimestampsToISO(data);

  // Add the document ID to the exported data
  const exportData = {
    id: problemId,
    ...serializedData,
  };

  // Write to file with pretty formatting
  fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
}

/**
 * Main export function
 */
async function exportProblemsFromFirestore(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Firestore Problems Export Tool');
  console.log('='.repeat(60));
  console.log();

  try {
    // Ensure export directory exists
    ensureExportDirectory();

    // Connect to Firestore
    console.log(`📦 Connecting to Firestore collection: ${COLLECTION_NAME}`);
    const db = adminDb();
    const problemsRef = db.collection(COLLECTION_NAME);

    // Fetch all documents
    console.log('⏳ Fetching all problems from Firestore...');
    const querySnapshot = await problemsRef.get();

    const totalProblems = querySnapshot.size;
    console.log(`✓ Found ${totalProblems} problems to export`);
    console.log();

    if (totalProblems === 0) {
      console.log('⚠ No problems found in Firestore. Exiting.');
      return;
    }

    // Export each problem
    console.log('📝 Exporting problems to JSON files...');
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const doc of querySnapshot.docs) {
      try {
        const problemId = doc.id;
        const data = doc.data();

        exportProblemToFile(problemId, data);
        successCount++;

        // Log progress every 10 problems
        if (successCount % 10 === 0) {
          console.log(`  ✓ Exported ${successCount}/${totalProblems} problems...`);
        }
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ id: doc.id, error: errorMessage });
        console.error(`  ✗ Failed to export ${doc.id}: ${errorMessage}`);
      }
    }

    // Final summary
    console.log();
    console.log('='.repeat(60));
    console.log('Export Summary');
    console.log('='.repeat(60));
    console.log(`Total problems:     ${totalProblems}`);
    console.log(`Successfully exported: ${successCount}`);
    console.log(`Failed:             ${errorCount}`);
    console.log(`Export directory:   ${EXPORT_DIR}`);
    console.log();

    if (errors.length > 0) {
      console.log('Errors:');
      errors.forEach(({ id, error }) => {
        console.log(`  - ${id}: ${error}`);
      });
      console.log();
    }

    if (successCount > 0) {
      console.log(`✓ Export complete! ${successCount} problems saved to:`);
      console.log(`  ${EXPORT_DIR}`);
      console.log();
      console.log('Example files:');
      const files = fs.readdirSync(EXPORT_DIR).slice(0, 5);
      files.forEach(file => {
        console.log(`  - ${file}`);
      });
      if (totalProblems > 5) {
        console.log(`  ... and ${totalProblems - 5} more`);
      }
    }

  } catch (error) {
    console.error('✗ Fatal error during export:');
    console.error(error);
    process.exit(1);
  }
}

// Run the export
if (require.main === module) {
  exportProblemsFromFirestore()
    .then(() => {
      console.log();
      console.log('✓ Export process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error();
      console.error('✗ Export process failed:');
      console.error(error);
      process.exit(1);
    });
}

export { exportProblemsFromFirestore };
