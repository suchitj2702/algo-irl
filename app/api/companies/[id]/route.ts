import { getCompanyById } from "@/lib/company";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params object before accessing properties
    const params = await context.params;
    const id = params.id;
    
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Company ID is required" },
        { status: 400 }
      );
    }
    
    const company = await getCompanyById(id);
    
    if (!company) {
      return NextResponse.json(
        { success: false, message: `Company with ID '${id}' not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: company
    });
  } catch (error) {
    console.error(`Error fetching company:`, error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch company", error: String(error) },
      { status: 500 }
    );
  }
} 