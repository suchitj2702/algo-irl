/**
 * Test script for study plan API
 * Tests various combinations of companies and parameters
 */

import * as fs from 'fs';
import * as path from 'path';

const API_ENDPOINT = 'http://localhost:3000/api/study-plan/generate';

interface TestCase {
  name: string;
  companyId: string;
  roleFamily: string;
  timeline: number;
  hoursPerDay: number;
  difficultyPreference?: {
    easy?: boolean;
    medium?: boolean;
    hard?: boolean;
  };
  topicFocus?: string[];
}

const testCases: TestCase[] = [
  // Bloomberg - Backend Systems with tight timeline
  {
    name: 'bloomberg_backend_tight',
    companyId: 'bloomberg',
    roleFamily: 'backend',
    timeline: 14,
    hoursPerDay: 3,
    difficultyPreference: { medium: true, hard: true }
  },

  // Bloomberg - ML/Data with longer timeline
  {
    name: 'bloomberg_ml_extended',
    companyId: 'bloomberg',
    roleFamily: 'ml',
    timeline: 30,
    hoursPerDay: 2,
    topicFocus: ['arrays', 'dynamic-programming', 'graphs']
  },

  // Coinbase - Backend Systems (crypto focus)
  {
    name: 'coinbase_backend',
    companyId: 'coinbase',
    roleFamily: 'backend',
    timeline: 21,
    hoursPerDay: 2.5,
    difficultyPreference: { medium: true, hard: true }
  },

  // Coinbase - Security/Reliability
  {
    name: 'coinbase_security',
    companyId: 'coinbase',
    roleFamily: 'security',
    timeline: 28,
    hoursPerDay: 2,
    topicFocus: ['strings', 'trees', 'graphs']
  },

  // Spotify - Backend Systems (music streaming)
  {
    name: 'spotify_backend',
    companyId: 'spotify',
    roleFamily: 'backend',
    timeline: 21,
    hoursPerDay: 2,
    difficultyPreference: { easy: true, medium: true, hard: true }
  },

  // Spotify - Frontend/Fullstack
  {
    name: 'spotify_frontend',
    companyId: 'spotify',
    roleFamily: 'frontend',
    timeline: 14,
    hoursPerDay: 3,
    topicFocus: ['arrays', 'hash-tables', 'strings']
  },

  // Apple - Infrastructure/Platform
  {
    name: 'apple_infrastructure',
    companyId: 'apple',
    roleFamily: 'infrastructure',
    timeline: 30,
    hoursPerDay: 2.5,
    difficultyPreference: { medium: true, hard: true }
  },

  // Apple - ML/Data
  {
    name: 'apple_ml',
    companyId: 'apple',
    roleFamily: 'ml',
    timeline: 21,
    hoursPerDay: 3,
    topicFocus: ['arrays', 'dynamic-programming', 'trees']
  },

  // DoorDash - Backend Systems (delivery/logistics)
  {
    name: 'doordash_backend',
    companyId: 'doordash',
    roleFamily: 'backend',
    timeline: 21,
    hoursPerDay: 2,
    difficultyPreference: { medium: true, hard: true }
  },

  // DoorDash - Frontend/Fullstack
  {
    name: 'doordash_frontend',
    companyId: 'doordash',
    roleFamily: 'frontend',
    timeline: 14,
    hoursPerDay: 3,
    topicFocus: ['arrays', 'graphs', 'greedy']
  }
];

async function callAPI(testCase: TestCase): Promise<any> {
  console.log(`\nTesting: ${testCase.name}`);
  console.log(`Company: ${testCase.companyId}, Role: ${testCase.roleFamily}`);
  console.log(`Timeline: ${testCase.timeline} days, Hours/day: ${testCase.hoursPerDay}`);

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      companyId: testCase.companyId,
      roleFamily: testCase.roleFamily,
      timeline: testCase.timeline,
      hoursPerDay: testCase.hoursPerDay,
      difficultyPreference: testCase.difficultyPreference,
      topicFocus: testCase.topicFocus
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API Error (${response.status}): ${JSON.stringify(error)}`);
  }

  return await response.json();
}

async function runTests() {
  const outputDir = path.join(process.cwd(), 'test-outputs', 'study-plan');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = [];

  for (const testCase of testCases) {
    try {
      const result = await callAPI(testCase);

      // Save raw output
      const outputPath = path.join(outputDir, `${testCase.name}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

      console.log(`✓ Success - saved to ${outputPath}`);
      console.log(`  Total problems: ${result.totalProblems}`);
      console.log(`  Schedule days: ${result.schedule?.length || 0}`);

      results.push({
        testCase: testCase.name,
        success: true,
        outputPath
      });
    } catch (error) {
      console.error(`✗ Failed: ${error instanceof Error ? error.message : String(error)}`);

      results.push({
        testCase: testCase.name,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Save summary
  const summaryPath = path.join(outputDir, '_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTests: testCases.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  }, null, 2));

  console.log(`\n\n=== Test Summary ===`);
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log(`\nResults saved to: ${outputDir}`);
}

runTests().catch(console.error);
