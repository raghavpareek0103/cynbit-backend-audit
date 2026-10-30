/**
 * Recommended baseline for public form endpoints (report section 7).
 * Not a finding: forms were not submitted during the passive audit.
 *
 * Covers: server-side validation, body-size limit, rate limiting,
 * honeypot spam check, uniform error envelope, no stack-trace leakage,
 * request-ID logging.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const MAX_BODY_BYTES = 10 * 1024;

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 submissions / 15 min / IP
  prefix: 'rl:contact',
});

const ContactSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    company: z.string().trim().max(120).optional(),
    message: z.string().trim().min(10).max(2000),
    website: z.string().max(0).optional(), // honeypot: real users leave it empty
  })
  .strict(); // reject unknown fields

type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'METHOD_NOT_ALLOWED'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL';

function error(status: number, code: ErrorCode, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-vercel-id') ?? crypto.randomUUID();

  try {
    // 1) Rate limit by client IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { success, reset } = await ratelimit.limit(ip);
    if (!success) {
      const res = error(429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
      res.headers.set('Retry-After', String(Math.ceil((reset - Date.now()) / 1000)));
      return res;
    }

    // 2) Content type + size limits
    if (!req.headers.get('content-type')?.includes('application/json')) {
      return error(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json');
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return error(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
    }

    // 3) Parse + validate
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return error(400, 'BAD_REQUEST', 'Invalid JSON');
    }
    const parsed = ContactSchema.safeParse(body);
    if (!parsed.success) {
      return error(422, 'VALIDATION_FAILED', 'Invalid input', parsed.error.flatten().fieldErrors);
    }

    // 4) Silently accept bot submissions (honeypot filled) without processing
    if (parsed.data.website) {
      return NextResponse.json({ ok: true }, { status: 202 });
    }

    // 5) Business logic: persist / queue email (keep it idempotent & async)
    // await db.contactRequests.insert({ ...parsed.data, ip, requestId });
    // await queue.publish('contact.created', { requestId });

    console.info(JSON.stringify({ level: 'info', event: 'contact.created', requestId }));
    return NextResponse.json({ ok: true, requestId }, { status: 201 });
  } catch (err) {
    // Log full detail server-side, return a generic message to the client
    console.error(JSON.stringify({ level: 'error', event: 'contact.failed', requestId, err: String(err) }));
    return error(500, 'INTERNAL', 'Something went wrong. Please try again.');
  }
}

export function GET() {
  const res = error(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  res.headers.set('Allow', 'POST');
  return res;
}
