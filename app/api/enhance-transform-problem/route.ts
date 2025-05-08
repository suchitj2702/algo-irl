import { NextResponse } from 'next/server';
import anthropicService from '@/lib/anthropicService';
import { createEnhancedPromptContext, generateEnhancedPrompt } from '@/lib/promptEnhancerUtil';
import { getProblemById } from '@/lib/firestoreUtils';
import { getCompanyById } from '@/lib/company';

export async function POST(request: Request) {
  try {
    const { problemId, companyId, useCache = true } = await request.json();

    // Validate required fields
    if (!problemId || !companyId) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          requiredFields: ['problemId', 'companyId']
        }, 
        { status: 400 }
      );
    }

    // Retrieve problem and company data
    const problem = await getProblemById(problemId);
    const company = await getCompanyById(companyId);

    if (!problem) {
      return NextResponse.json(
        { 
          error: 'Problem not found',
          problemId
        }, 
        { status: 404 }
      );
    }

    if (!company) {
      return NextResponse.json(
        { 
          error: 'Company not found',
          companyId
        }, 
        { status: 404 }
      );
    }

    // Create enhanced prompt context
    const enhancedContext = await createEnhancedPromptContext(problemId, companyId);
    
    if (!enhancedContext) {
      return NextResponse.json(
        { 
          error: 'Failed to create enhanced context'
        }, 
        { status: 500 }
      );
    }

    // Generate enhanced prompt
    const enhancedPrompt = generateEnhancedPrompt(enhancedContext);

    // Create a cache key based on problem ID and company ID
    const cacheKey = `enhanced-${problemId}-${companyId}`.toLowerCase().replace(/\s+/g, '-');

    // Use the direct prompt transformation method instead of going through the standard flow
    // This avoids creating a duplicate prompt from our enhanced prompt
    const scenarioText = await anthropicService.transformWithCustomPrompt({
      customPrompt: enhancedPrompt,
      cacheKey,
      useCache
    });

    // Return the enhanced context and transformed scenario
    return NextResponse.json({ 
      scenario: scenarioText,
      enhancedContext: {
        relevanceScore: enhancedContext.relevanceScore,
        suggestedAnalogyPoints: enhancedContext.suggestedAnalogyPoints,
        detectedAlgorithms: enhancedContext.problem.coreAlgorithms,
        detectedDataStructures: enhancedContext.problem.dataStructures
      }
    });
  } catch (error) {
    console.error('Error transforming problem with enhanced context:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to transform problem',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 