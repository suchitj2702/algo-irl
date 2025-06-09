import { initializeTechCompanies, generateCompanyDataWithAI } from "@/lib/company/companyUtils";
import { NextRequest, NextResponse } from "next/server";
import { enhancedSecurityMiddleware } from '@/lib/security/enhanced-middleware';
import { getCorsHeaders } from '@/lib/security/cors';
import { sanitizeCompanyName } from '@/lib/security/input-sanitization';

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET() {
  const corsHeaders = getCorsHeaders(null);
  
  try {
    await initializeTechCompanies();
    return NextResponse.json(
      { success: true, message: "Tech companies initialized successfully" },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error in company initialization API:", error);
    return NextResponse.json(
      { success: false, message: "Failed to initialize tech companies", error: String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  return enhancedSecurityMiddleware(request, async (req, parsedBody) => {
    try {
      const origin = req.headers.get('origin');
      const corsHeaders = getCorsHeaders(origin);
      
      // Use the parsed body from middleware instead of reading it again
      const body = parsedBody || await req.json();
      const { companyName } = body;
      
      if (!companyName) {
        return NextResponse.json(
          { success: false, message: "Company name is required" },
          { status: 400, headers: corsHeaders }
        );
      }
      
      // Sanitize company name input
      const sanitizedCompanyName = sanitizeCompanyName(companyName);
      
      const company = await generateCompanyDataWithAI(sanitizedCompanyName);
      
      // Use the wasNameCorrected property that's now included in the company object
      const wasNameCorrected = company.wasNameCorrected || false;
      
      return NextResponse.json({ 
        success: true, 
        message: wasNameCorrected 
          ? `Company "${companyName}" was corrected to "${company.name}" and saved successfully`
          : `Company ${company.name} generated and saved successfully`,
        company,
        wasNameCorrected,
        originalName: companyName
      }, { headers: corsHeaders });
    } catch (error) {
      const origin = req.headers.get('origin');
      const corsHeaders = getCorsHeaders(origin);
      
      console.error("Error in company generation API:", error);
      return NextResponse.json(
        { success: false, message: "Failed to generate company data", error: String(error) },
        { status: 500, headers: corsHeaders }
      );
    }
  }, {
    rateLimiterType: 'companyCreation',
    checkHoneypotField: true,
    requireSignature: false
  });
} 