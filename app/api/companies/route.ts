import { getAllCompanies } from "@/lib/company";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get limit parameter from query string
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : undefined;
    
    // Get companies with optional limit
    const companies = await getAllCompanies({ limit });
    
    return NextResponse.json({
      success: true,
      data: companies
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch companies", error: String(error) },
      { status: 500 }
    );
  }
} 