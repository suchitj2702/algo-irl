import { NextRequest, NextResponse } from 'next/server';
import { getAllCompanies } from '@/lib/company/companyUtils';

/**
 * GET /api/companies - Get list of all companies with basic info
 * This endpoint is externally accessible (configured in middleware.ts)
 */
export async function GET(request: NextRequest) {
  try {
    // Get optional limit query parameter for pagination
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');

    let limit: number | undefined;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        return NextResponse.json(
          { error: 'Invalid limit parameter. Must be a positive integer.' },
          { status: 400 }
        );
      }
      limit = parsedLimit;
    }

    // Fetch companies from Firestore
    const companies = await getAllCompanies(limit ? { limit } : undefined);

    // Return simplified version of each company with only essential details
    const simplifiedCompanies = companies.map(company => ({
      id: company.id,
      name: company.name,
      domain: company.domain,
      description: company.description,
      logoUrl: company.logoUrl,
      technologies: company.technologies,
      products: company.products
    }));

    return NextResponse.json({
      success: true,
      data: simplifiedCompanies
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch companies' },
      { status: 500 }
    );
  }
}
