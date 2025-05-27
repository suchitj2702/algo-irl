import { initializeTechCompanies, generateCompanyDataWithAI } from "@/lib/company/companyUtils";
import { NextResponse } from "next/server";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
  'Access-Control-Max-Age': '86400',
};

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET() {
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName } = body;
    
    if (!companyName) {
      return NextResponse.json(
        { success: false, message: "Company name is required" },
        { status: 400, headers: corsHeaders }
      );
    }
    
    const company = await generateCompanyDataWithAI(companyName);
    
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
    console.error("Error in company generation API:", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate company data", error: String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
} 