import type { NextRequest } from 'next/server';
import { isChiefComplaint, loadRule } from '@/lib/diagnosis/engine';

export async function GET(request: NextRequest) {
  const complaint = request.nextUrl.searchParams.get('complaint');

  if (!isChiefComplaint(complaint)) {
    return Response.json(
      { error: 'complaint query parameter must be one of: diarrhea, vomiting, skin' },
      { status: 400 },
    );
  }

  try {
    const rule = loadRule(complaint);
    return Response.json({
      nurse: rule.interview.nurse,
      vet: rule.interview.vet,
    });
  } catch (err) {
    console.error('[GET /api/diagnosis/interview]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
