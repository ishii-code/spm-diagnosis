import type { NextRequest } from 'next/server';
import { findBestTest, isChiefComplaint, loadRule } from '@/lib/diagnosis/engine';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Body must be a JSON object' }, { status: 400 });
  }

  const { chief_complaint, situation } = body as {
    chief_complaint?: unknown;
    situation?: unknown;
  };

  if (!isChiefComplaint(chief_complaint)) {
    return Response.json(
      { error: 'chief_complaint must be one of: diarrhea, vomiting, skin' },
      { status: 400 },
    );
  }

  if (typeof situation !== 'string' || situation.trim().length === 0) {
    return Response.json(
      { error: 'situation must be a non-empty string' },
      { status: 400 },
    );
  }

  try {
    const rule = loadRule(chief_complaint);
    const match = findBestTest(rule, situation);
    if (!match) {
      return Response.json(
        { error: 'No matching test situation found for the given input' },
        { status: 404 },
      );
    }
    return Response.json({
      recommended_tests: match.items,
      decision_point: match.decision_point,
    });
  } catch (err) {
    console.error('[POST /api/diagnosis/tests]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
