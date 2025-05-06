import { NextResponse } from 'next/server';
import { fetchAndImportProblemByUrl } from '@/lib/firestoreUtils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid URL provided.' }, { status: 400 });
    }

    // Optional: Add more robust URL validation here if needed
    try {
      new URL(url);
    } catch (_) {
        return NextResponse.json({ success: false, error: 'Invalid URL format.' }, { status: 400 });
    }

    console.log(`API: Received request to import problem from URL: ${url}`);
    const result = await fetchAndImportProblemByUrl(url);

    if (result.success) {
      console.log(`API: Successfully imported problem ${result.slug}`);
      return NextResponse.json({ success: true, slug: result.slug });
    } else {
      console.error(`API: Failed to import problem ${result.slug || url}. Error: ${result.error}`);
      return NextResponse.json({ success: false, slug: result.slug, error: result.error }, { status: 500 });
    }

  } catch (error: any) {
    console.error("API Error in /api/import-problem: ", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
} 