import fs from 'node:fs';
import path from 'node:path';
import type { ChiefComplaint, TriageLevel } from './engine';

const SEVERITIES = ['GREEN', 'YELLOW', 'RED', 'CHRONIC'] as const;

export const SEVERITY_RANK: Record<TriageLevel, number> = {
  GREEN: 0,
  CHRONIC: 1,
  YELLOW: 2,
  RED: 3,
};

export type ThresholdKey = 'yellow_threshold' | 'red_threshold' | 'chronic_threshold';
const THRESHOLD_KEYS: readonly ThresholdKey[] = [
  'yellow_threshold',
  'red_threshold',
  'chronic_threshold',
];

export type ThresholdRule = Partial<Record<ThresholdKey, number>>;
export type MappingRule = Record<string, TriageLevel>;
export type Rule = ThresholdRule | MappingRule;

export interface SettingsFile {
  complaint: ChiefComplaint;
  rules: Record<string, Rule>;
}

export function isSeverity(value: unknown): value is TriageLevel {
  return typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);
}

export function isThresholdRule(rule: Rule): rule is ThresholdRule {
  return Object.keys(rule).some((k) => (THRESHOLD_KEYS as readonly string[]).includes(k));
}

const settingsCache = new Map<ChiefComplaint, SettingsFile>();

function settingsPath(complaint: ChiefComplaint): string {
  return path.join(
    process.cwd(),
    'src',
    'data',
    'rules',
    'settings',
    `${complaint}_settings.json`,
  );
}

export function loadSettings(complaint: ChiefComplaint): SettingsFile {
  const cached = settingsCache.get(complaint);
  if (cached) return cached;
  const raw = fs.readFileSync(settingsPath(complaint), 'utf-8');
  const parsed = JSON.parse(raw) as SettingsFile;
  settingsCache.set(complaint, parsed);
  return parsed;
}

export function saveSettings(file: SettingsFile): void {
  const target = settingsPath(file.complaint);
  fs.writeFileSync(target, `${JSON.stringify(file, null, 2)}\n`, 'utf-8');
  settingsCache.set(file.complaint, file);
}

export function validateSettingsBody(body: unknown): SettingsFile | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object' };
  const { complaint, rules } = body as { complaint?: unknown; rules?: unknown };

  if (
    typeof complaint !== 'string' ||
    !['diarrhea', 'vomiting', 'skin'].includes(complaint)
  ) {
    return { error: 'complaint must be one of: diarrhea, vomiting, skin' };
  }
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    return { error: 'rules must be an object' };
  }

  const cleanRules: Record<string, Rule> = {};
  for (const [key, raw] of Object.entries(rules as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { error: `rule "${key}" must be an object` };
    }
    const entries = Object.entries(raw as Record<string, unknown>);
    const hasThreshold = entries.some(([k]) =>
      (THRESHOLD_KEYS as readonly string[]).includes(k),
    );
    const hasSeverity = entries.some(([, v]) => isSeverity(v));

    if (hasThreshold && hasSeverity) {
      return { error: `rule "${key}" mixes threshold and severity values` };
    }

    if (hasThreshold) {
      const out: ThresholdRule = {};
      for (const [k, v] of entries) {
        if (!(THRESHOLD_KEYS as readonly string[]).includes(k)) {
          return { error: `rule "${key}" has unknown threshold key "${k}"` };
        }
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          return { error: `rule "${key}.${k}" must be a finite number` };
        }
        out[k as ThresholdKey] = v;
      }
      cleanRules[key] = out;
    } else {
      const out: MappingRule = {};
      for (const [k, v] of entries) {
        if (!isSeverity(v)) {
          return { error: `rule "${key}.${k}" must be one of GREEN/YELLOW/RED/CHRONIC` };
        }
        out[k] = v;
      }
      cleanRules[key] = out;
    }
  }

  return { complaint: complaint as ChiefComplaint, rules: cleanRules };
}

export interface SettingsTriageResult {
  level: TriageLevel;
  matched: { key: string; level: TriageLevel; reason: string }[];
}

export function evaluateBySettings(
  settings: SettingsFile,
  values: Record<string, unknown>,
): SettingsTriageResult {
  let worst: TriageLevel = 'GREEN';
  const matched: SettingsTriageResult['matched'] = [];

  for (const [key, rule] of Object.entries(settings.rules)) {
    if (!(key in values)) continue;
    const v = values[key];
    let level: TriageLevel | null = null;
    let reason = '';

    if (isThresholdRule(rule)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (rule.red_threshold !== undefined && v >= rule.red_threshold) {
        level = 'RED';
        reason = `${v} ≥ RED閾値 ${rule.red_threshold}`;
      } else if (rule.yellow_threshold !== undefined && v >= rule.yellow_threshold) {
        level = 'YELLOW';
        reason = `${v} ≥ YELLOW閾値 ${rule.yellow_threshold}`;
      } else if (rule.chronic_threshold !== undefined && v >= rule.chronic_threshold) {
        level = 'CHRONIC';
        reason = `${v} ≥ CHRONIC閾値 ${rule.chronic_threshold}`;
      }
    } else {
      let lookup: string | null = null;
      if (typeof v === 'boolean') lookup = v ? 'yes' : 'no';
      else if (typeof v === 'string') lookup = v;
      if (lookup && lookup in rule) {
        level = (rule as MappingRule)[lookup];
        reason = lookup;
      }
    }

    if (level && level !== 'GREEN') {
      matched.push({ key, level, reason });
      if (SEVERITY_RANK[level] > SEVERITY_RANK[worst]) worst = level;
    }
  }

  return { level: worst, matched };
}
