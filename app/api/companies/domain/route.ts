import { getCompaniesByDomain } from "@/lib/company";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get domain parameter from query string
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain");
    
    if (!domain) {
      return NextResponse.json(
        { success: false, message: "Domain parameter is required" },
        { status: 400 }
      );
    }
    
    const companies = await getCompaniesByDomain(domain);
    
    return NextResponse.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error("Error fetching companies by domain:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch companies by domain", error: String(error) },
      { status: 500 }
    );
  }
} 