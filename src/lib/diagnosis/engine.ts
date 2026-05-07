import fs from 'node:fs';
import path from 'node:path';

export type ChiefComplaint = 'diarrhea' | 'vomiting' | 'skin';
export type TriageLevel = 'GREEN' | 'YELLOW' | 'RED' | 'CHRONIC';

export interface Drug {
  name: string;
  dose: string;
  duration: string;
}

export interface TriageEntry {
  conditions: string[];
  initial_actions: string[];
  followup_hours: number;
  refer_to_center: boolean;
}

export interface TestEntry {
  situation: string;
  items: string[];
  decision_point: string;
}

export interface TreatmentEntry {
  situation: string;
  treatment: string;
  refer_to_center: boolean;
  drugs: Drug[];
}

export interface FollowupEntry {
  category: string;
  timing: string;
  checkpoints: string[];
}

export interface Rule {
  id: ChiefComplaint;
  label_ja: string;
  interview: { nurse: string[]; vet: string[] };
  triage: Record<TriageLevel, TriageEntry>;
  tests: TestEntry[];
  treatments: TreatmentEntry[];
  followup: FollowupEntry[];
}

const VALID_COMPLAINTS: readonly ChiefComplaint[] = ['diarrhea', 'vomiting', 'skin'];

export function isChiefComplaint(value: unknown): value is ChiefComplaint {
  return typeof value === 'string' && (VALID_COMPLAINTS as readonly string[]).includes(value);
}

const ruleCache = new Map<ChiefComplaint, Rule>();

export function loadRule(complaint: ChiefComplaint): Rule {
  const cached = ruleCache.get(complaint);
  if (cached) return cached;

  const file = path.join(process.cwd(), 'src', 'data', 'rules', `${complaint}.json`);
  const raw = fs.readFileSync(file, 'utf-8');
  const rule = JSON.parse(raw) as Rule;
  ruleCache.set(complaint, rule);
  return rule;
}

const TRIAGE_PRIORITY: readonly TriageLevel[] = ['RED', 'YELLOW', 'CHRONIC', 'GREEN'];

function bidirectionalSubstring(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export interface TriageResult {
  triage: TriageLevel;
  matched_conditions: string[];
  initial_actions: string[];
  followup_hours: number;
  refer_to_center: boolean;
}

export function evaluateTriage(rule: Rule, symptoms: string[]): TriageResult {
  const cleaned = symptoms.map((s) => s.trim()).filter((s) => s.length > 0);

  for (const level of TRIAGE_PRIORITY) {
    const entry = rule.triage[level];
    if (!entry) continue;
    const matched = entry.conditions.filter((cond) =>
      cleaned.some((sym) => bidirectionalSubstring(cond.trim(), sym)),
    );
    if (matched.length > 0) {
      return {
        triage: level,
        matched_conditions: matched,
        initial_actions: entry.initial_actions,
        followup_hours: entry.followup_hours,
        refer_to_center: entry.refer_to_center,
      };
    }
  }

  const green = rule.triage.GREEN;
  return {
    triage: 'GREEN',
    matched_conditions: [],
    initial_actions: green.initial_actions,
    followup_hours: green.followup_hours,
    refer_to_center: green.refer_to_center,
  };
}

function scoreSituation(candidate: string, query: string): number {
  const c = candidate.trim();
  const q = query.trim();
  if (!c || !q) return 0;
  if (c === q) return 10_000;
  if (c.includes(q)) return 5_000 + q.length;
  if (q.includes(c)) return 4_000 + c.length;

  let overlap = 0;
  const seen = new Set<string>();
  for (const ch of c) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    if (q.includes(ch)) overlap += 1;
  }
  return overlap;
}

function findBestBySituation<T extends { situation: string }>(
  entries: readonly T[],
  situation: string,
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const entry of entries) {
    const score = scoreSituation(entry.situation, situation);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore > 0 ? best : null;
}

export function findBestTest(rule: Rule, situation: string): TestEntry | null {
  return findBestBySituation(rule.tests, situation);
}

export function findBestTreatment(rule: Rule, situation: string): TreatmentEntry | null {
  return findBestBySituation(rule.treatments, situation);
}
