import { initializeTechCompanies, generateCompanyDataWithAI } from "@/lib/company/companyUtils";
import { NextRequest, NextResponse } from "next/server";

/**
 * Initialize tech companies in database
 * INTERNAL USE ONLY - Not accessible from external clients
 */
export async function GET() {
  try {
    await initializeTechCompanies();
    return NextResponse.json(
      { success: true, message: "Tech companies initialized successfully" }
    );
  } catch (error) {
    console.error("Error in company initialization API:", error);
    return NextResponse.json(
      { success: false, message: "Failed to initialize tech companies", error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Generate company data using AI
 * INTERNAL USE ONLY - Not accessible from external clients
 */
export async function POST(request: NextRequest) {
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

    return NextResponse.json({
      success: true,
      message: `Company ${company.name} generated and saved successfully`,
      company
    });
  } catch (error) {
    console.error("Error in company generation API:", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate company data", error: String(error) },
      { status: 500 }
    );
  }
} 