import { initializeTechCompanies, generateCompanyDataWithAI } from "@/lib/company/companyUtils";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await initializeTechCompanies();
    return NextResponse.json({ success: true, message: "Tech companies initialized successfully" });
  } catch (error) {
    console.error("Error in company initialization API:", error);
    return NextResponse.json(
      { success: false, message: "Failed to initialize tech companies", error: String(error) },
      { status: 500 }
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
        { status: 400 }
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
    });
  } catch (error) {
    console.error("Error in company generation API:", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate company data", error: String(error) },
      { status: 500 }
    );
  }
} 