import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/security/cors';

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    const body = await request.json();
    
    console.log('=== SIGNATURE FAILURE DEBUG ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Endpoint:', body.endpoint);
    console.log('Client Timestamp:', body.clientTimestamp);
    console.log('Server Time:', Date.now());
    console.log('Time Difference (ms):', Date.now() - parseInt(body.clientTimestamp));
    console.log('Debug Headers:', JSON.stringify(body.debugHeaders, null, 2));
    console.log('Payload Preview:', body.payloadSnapshot);
    console.log('Request Headers:');
    request.headers.forEach((value, key) => {
      if (key.startsWith('x-debug-')) {
        console.log(`  ${key}: ${value}`);
      }
    });
    console.log('===============================');
    
    return NextResponse.json({ logged: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to log debug information' },
      { status: 500, headers: corsHeaders }
    );
  }
} 