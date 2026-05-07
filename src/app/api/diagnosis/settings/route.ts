import type { NextRequest } from 'next/server';
import { isChiefComplaint } from '@/lib/diagnosis/engine';
import { loadSettings, saveSettings, validateSettingsBody } from '@/lib/diagnosis/settings';

export async function GET(request: NextRequest) {
  const complaint = request.nextUrl.searchParams.get('complaint');
  if (!isChiefComplaint(complaint)) {
    return Response.json(
      { error: 'complaint query parameter must be one of: diarrhea, vomiting, skin' },
      { status: 400 },
    );
  }

  try {
    const settings = loadSettings(complaint);
    return Response.json(settings);
  } catch (err) {
    console.error('[GET /api/diagnosis/settings]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = validateSettingsBody(body);
  if ('error' in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  try {
    saveSettings(result);
    return Response.json({ ok: true, complaint: result.complaint });
  } catch (err) {
    console.error('[POST /api/diagnosis/settings]', err);
    return Response.json({ error: 'Failed to write settings file' }, { status: 500 });
  }
}
