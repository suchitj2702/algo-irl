import { initializeTechCompanies } from "@/lib/company";
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