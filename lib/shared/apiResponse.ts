import { NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/security/cors';

export function apiError(status: number, message: string, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error: message }, { status, headers });
}

export function apiSuccess<T>(data: T, options?: { status?: number; headers?: HeadersInit }): NextResponse {
  return NextResponse.json(data, { status: options?.status ?? 200, headers: options?.headers });
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function withCors(request: Request, body: unknown, init?: { status?: number }): NextResponse {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin, request);
  return NextResponse.json(body, { status: init?.status ?? 200, headers });
}
