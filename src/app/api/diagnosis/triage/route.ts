import type { NextRequest } from 'next/server';
import { isChiefComplaint, loadRule } from '@/lib/diagnosis/engine';
import { evaluateBySettings, loadSettings } from '@/lib/diagnosis/settings';
import { ruleLabel, valueLabel } from '@/lib/diagnosis/labels';

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

  const { chief_complaint, values } = body as {
    chief_complaint?: unknown;
    values?: unknown;
  };

  if (!isChiefComplaint(chief_complaint)) {
    return Response.json(
      { error: 'chief_complaint must be one of: diarrhea, vomiting, skin' },
      { status: 400 },
    );
  }

  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return Response.json(
      { error: 'values must be an object of rule keys to user inputs' },
      { status: 400 },
    );
  }

  try {
    const settings = loadSettings(chief_complaint);
    const rule = loadRule(chief_complaint);
    const { level, matched } = evaluateBySettings(
      settings,
      values as Record<string, unknown>,
    );
    const tier = rule.triage[level];

    return Response.json({
      triage: level,
      matched_conditions: matched.map(
        (m) => `${ruleLabel(m.key)}: ${valueLabel(m.reason) || m.reason} → ${m.level}`,
      ),
      initial_actions: tier.initial_actions,
      followup_hours: tier.followup_hours,
      refer_to_center: tier.refer_to_center,
    });
  } catch (err) {
    console.error('[POST /api/diagnosis/triage]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
