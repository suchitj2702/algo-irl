import { NextResponse } from 'next/server';
import { importProblemsFromUrls } from '@/lib/problem/problemDatastoreUtils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { urls } = body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid or empty URLs array provided.' }, { status: 400 });
    }

    // Optional: Validate individual URLs in the array
    for (const url of urls) {
        if (typeof url !== 'string') {
             return NextResponse.json({ success: false, error: 'URLs array contains non-string elements.' }, { status: 400 });
        }
        try {
            new URL(url); // Basic format check
        } catch {
            return NextResponse.json({ success: false, error: `Invalid URL format found in array: ${url}` }, { status: 400 });
        }
    }

    console.log(`API: Received request to import ${urls.length} problems.`);
    const result = await importProblemsFromUrls(urls);

    console.log(`API: Batch import completed. Success: ${result.successCount}, Errors: ${result.errors.length}`);
    // Always return success status code, but include details in the body
    return NextResponse.json({
      success: result.errors.length === 0,
      successCount: result.successCount,
      errors: result.errors
    });

  } catch (error: unknown) {
    console.error("API Error in /api/problem/import-batch: ", error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : String(error)) || 'Internal Server Error' }, { status: 500 });
  }
} 