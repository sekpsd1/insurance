import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

export async function GET() {
  const file = await readFile(join(process.cwd(), 'public', 'forms', 'tokio-marine-credit-card-form.pdf'));

  return new NextResponse(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="tokio-marine-credit-card-form.pdf"',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
}
