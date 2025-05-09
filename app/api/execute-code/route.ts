import { NextRequest, NextResponse } from 'next/server';
import { executeCode } from '../../../lib/code-execution/codeExecution';
import type { TestCase } from '../../../data-types/problem';
import type { ExecutionResults } from '../../../data-types/execution';

export async function POST(request: NextRequest) {
  try {
    const { code, language, testCases } = await request.json();
    
    // Validate input
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }
    
    if (!language || typeof language !== 'string') {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 });
    }
    
    if (!testCases || !Array.isArray(testCases)) {
      return NextResponse.json({ error: 'Test cases are required' }, { status: 400 });
    }
    
    // Execute code
    const results = await executeCode(code, language, testCases);
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Code execution error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        passed: false,
        testCasesPassed: 0,
        testCasesTotal: 0,
        executionTime: null,
        memoryUsage: null
      }, 
      { status: 500 }
    );
  }
} 