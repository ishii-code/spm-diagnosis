'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type ChiefComplaint = 'diarrhea' | 'vomiting' | 'skin';
type TriageLevel = 'GREEN' | 'YELLOW' | 'RED' | 'CHRONIC';

type ThresholdRule = Partial<Record<'yellow_threshold' | 'red_threshold' | 'chronic_threshold', number>>;
type MappingRule = Record<string, TriageLevel>;
type Rule = ThresholdRule | MappingRule;

interface SettingsFile {
  complaint: ChiefComplaint;
  rules: Record<string, Rule>;
}

const COMPLAINT_TABS: { id: ChiefComplaint; label: string; icon: string }[] = [
  { id: 'diarrhea', label: '下痢', icon: '💩' },
  { id: 'vomiting', label: '嘔吐', icon: '🤮' },
  { id: 'skin', label: '皮膚症状', icon: '🐾' },
];

const SEVERITIES: TriageLevel[] = ['GREEN', 'YELLOW', 'RED', 'CHRONIC'];
const THRESHOLD_KEYS = ['yellow_threshold', 'red_threshold', 'chronic_threshold'] as const;

const RULE_LABELS: Record<string, string> = {
  vomiting_count: '嘔吐回数',
  duration_days: '発症からの日数',
  last_vomiting_hours: '最終嘔吐からの時間',
  energy: '元気',
  appetite: '食欲',
  dehydration: '脱水',
  vomiting: '嘔吐',
  blood_in_stool: '血便',
  blood_in_vomit: '血様嘔吐',
  aspiration_suspected: '誤食疑い',
  abdominal_pain: '腹痛',
  abdominal_distension: '腹部膨満',
  cat_no_food_hours: '猫の絶食時間',
  urethral_obstruction_suspected: '尿道閉塞疑い',
  lesion_area: '病変範囲',
  itch_score: 'かゆみスコア',
  fever: '発熱',
  severe_pain: '重度疼痛',
  rapid_necrosis: '急速進行壊死',
  pustules_or_crusts: '膿疱・痂皮',
  ear_symptoms: '耳症状',
  recurrence: '再発',
};

const VALUE_LABELS: Record<string, string> = {
  yes: 'あり',
  no: 'なし',
  normal: 'あり/正常',
  decreased: '低下',
  absent: '廃絶',
  none: 'なし',
  mild: '軽度',
  moderate: '中等度',
  severe: '重度',
  single: '単発',
  repeated: '反復',
  persistent: '持続',
  yes_stable: 'あり（安定）',
  yes_unstable: 'あり（不安定）',
  local: '局所',
  widespread: '広範囲',
};

const THRESHOLD_LABELS: Record<string, string> = {
  yellow_threshold: 'YELLOW閾値',
  red_threshold: 'RED閾値',
  chronic_threshold: 'CHRONIC閾値',
};

const RULE_UNITS: Record<string, string> = {
  vomiting_count: '回',
  duration_days: '日',
  last_vomiting_hours: '時間',
  cat_no_food_hours: '時間',
  itch_score: '点',
};

function isThresholdRule(rule: Rule): rule is ThresholdRule {
  return Object.keys(rule).some((k) => (THRESHOLD_KEYS as readonly string[]).includes(k));
}

function severityBg(level: TriageLevel): string {
  switch (level) {
    case 'GREEN':
      return 'bg-triage-green text-white';
    case 'YELLOW':
      return 'bg-triage-yellow text-white';
    case 'RED':
      return 'bg-triage-red text-white';
    case 'CHRONIC':
      return 'bg-text-secondary text-white';
  }
}

function Spinner() {
  return (
    <div
      className="inline-block size-6 animate-spin rounded-full border-3 border-white/30 border-t-white"
      role="status"
      aria-label="Loading"
    />
  );
}

function Toast({
  message,
  variant,
  onClose,
}: {
  message: string;
  variant: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <div
        className={`flex max-w-md items-center gap-3 rounded-xl px-5 py-4 text-base font-medium text-white shadow-lg ${
          variant === 'success' ? 'bg-triage-green' : 'bg-triage-red'
        }`}
      >
        <span aria-hidden>{variant === 'success' ? '✅' : '⚠️'}</span>
        <span>{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 flex size-8 items-center justify-center rounded-full hover:bg-white/20"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    setIsAuthorized(isAdmin);
  }, []);

  if (isAuthorized === false) {
    return <AdminLoginPrompt onLogin={() => setIsAuthorized(true)} />;
  }

  if (isAuthorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return <SettingsContent />;
}

function AdminLoginPrompt({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  function handleSubmit() {
    if (password === 'peco2026') {
      localStorage.setItem('isAdmin', 'true');
      onLogin();
    } else {
      setError(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
            P
          </div>
        </div>
        <h2 className="mb-6 text-center text-xl font-bold text-primary">管理者ログイン</h2>
        <input
          type="password"
          placeholder="パスワードを入力"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          className="mb-3 min-h-12 w-full rounded-xl border-2 border-text-secondary/20 px-4 text-base outline-none focus:border-primary"
        />
        {error && (
          <p className="mb-3 text-sm text-triage-red">パスワードが違います</p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          className="min-h-14 w-full rounded-xl bg-primary text-base font-bold text-white shadow-md active:scale-[0.99] active:bg-primary-dark hover:bg-primary-dark"
        >
          ログイン
        </button>
        <div className="mt-4 text-center">
          <Link
            href="/diagnosis"
            className="text-sm text-text-secondary hover:text-primary"
          >
            ← 診断画面に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

function SettingsContent() {
  const [active, setActive] = useState<ChiefComplaint>('diarrhea');
  const [original, setOriginal] = useState<SettingsFile | null>(null);
  const [draft, setDraft] = useState<SettingsFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/diagnosis/settings?complaint=${active}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`設定の読み込みに失敗 (${res.status})`);
        return (await res.json()) as SettingsFile;
      })
      .then((data) => {
        if (cancelled) return;
        setOriginal(data);
        setDraft(structuredClone(data));
      })
      .catch((err) =>
        setToast({
          message: err instanceof Error ? err.message : '設定取得エラー',
          variant: 'error',
        }),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const dirty = useMemo(() => {
    if (!original || !draft) return false;
    return JSON.stringify(original) !== JSON.stringify(draft);
  }, [original, draft]);

  function switchTab(next: ChiefComplaint) {
    if (next === active) return;
    if (dirty) {
      const ok = window.confirm('未保存の変更があります。破棄して切り替えますか？');
      if (!ok) return;
    }
    setActive(next);
  }

  function updateThreshold(ruleKey: string, thrKey: string, raw: string) {
    if (!draft) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const rule = { ...(next.rules[ruleKey] as ThresholdRule) };
      if (raw === '') {
        delete rule[thrKey as keyof ThresholdRule];
      } else {
        const num = Number(raw);
        if (Number.isFinite(num)) rule[thrKey as keyof ThresholdRule] = num;
      }
      next.rules[ruleKey] = rule;
      return next;
    });
  }

  function updateMapping(ruleKey: string, valueKey: string, level: TriageLevel) {
    if (!draft) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const rule = { ...(next.rules[ruleKey] as MappingRule) };
      rule[valueKey] = level;
      next.rules[ruleKey] = rule;
      return next;
    });
  }

  async function save() {
    if (!draft || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch('/api/diagnosis/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `保存に失敗 (${res.status})`);
      }
      setOriginal(structuredClone(draft));
      setToast({ message: '設定を保存しました', variant: 'success' });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : '保存エラー',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32 text-text-primary">
      <header className="sticky top-0 z-30 bg-primary text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="トップページへ"
              className="flex items-center gap-3 rounded-xl px-1 py-1 hover:bg-white/10"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-white text-primary text-xl font-bold">
                P
              </div>
              <div>
                <div className="text-2xl font-bold leading-none tracking-wide">PECO</div>
                <div className="text-xs opacity-90">トリアージ設定 · 管理者専用</div>
              </div>
            </Link>
          </div>
          <Link
            href="/diagnosis"
            className="hidden min-h-12 items-center rounded-xl bg-white/15 px-4 text-base font-semibold hover:bg-white/25 md:flex"
          >
            ← 診断画面
          </Link>
        </div>
        <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-6 pb-4">
          {COMPLAINT_TABS.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={`flex min-h-12 items-center gap-2 rounded-full px-5 text-base font-semibold transition ${
                  isActive
                    ? 'bg-white text-primary-dark shadow-sm'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                <span aria-hidden>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {loading || !draft ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl bg-surface">
            <div className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(draft.rules).map(([key, rule]) => (
              <RuleCard
                key={key}
                ruleKey={key}
                rule={rule}
                onThresholdChange={(thrKey, raw) => updateThreshold(key, thrKey, raw)}
                onMappingChange={(valueKey, level) => updateMapping(key, valueKey, level)}
              />
            ))}
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-text-secondary/10 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="text-sm text-text-secondary">
            {dirty ? (
              <span className="font-semibold text-accent">未保存の変更があります</span>
            ) : (
              '変更なし'
            )}
          </div>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={save}
            className="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-primary px-8 text-lg font-bold text-white shadow-md active:scale-[0.99] active:bg-primary-dark hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-text-secondary/30 disabled:text-white/80"
          >
            {saving ? <Spinner /> : '💾 設定を保存'}
          </button>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

function RuleCard({
  ruleKey,
  rule,
  onThresholdChange,
  onMappingChange,
}: {
  ruleKey: string;
  rule: Rule;
  onThresholdChange: (thrKey: string, raw: string) => void;
  onMappingChange: (valueKey: string, level: TriageLevel) => void;
}) {
  const label = RULE_LABELS[ruleKey] ?? ruleKey;
  const unit = RULE_UNITS[ruleKey] ?? '';
  const isThreshold = isThresholdRule(rule);

  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 bg-primary px-6 py-3 text-white">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden>{isThreshold ? '🔢' : '🎯'}</span>
          <span>{label}</span>
        </div>
        <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold">
          {isThreshold ? '数値条件' : '選択条件'}
        </span>
      </div>
      <div className="p-5">
        {isThreshold ? (
          <ThresholdEditor
            rule={rule}
            unit={unit}
            onChange={onThresholdChange}
          />
        ) : (
          <MappingEditor rule={rule} onChange={onMappingChange} />
        )}
      </div>
    </div>
  );
}

function ThresholdEditor({
  rule,
  unit,
  onChange,
}: {
  rule: ThresholdRule;
  unit: string;
  onChange: (thrKey: string, raw: string) => void;
}) {
  const present = THRESHOLD_KEYS.filter((k) => k in rule);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {present.map((thrKey) => {
        const value = rule[thrKey];
        return (
          <div key={thrKey} className="rounded-xl bg-background p-4">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-block size-3 rounded-full ${
                  thrKey === 'red_threshold'
                    ? 'bg-triage-red'
                    : thrKey === 'yellow_threshold'
                      ? 'bg-triage-yellow'
                      : 'bg-text-secondary'
                }`}
                aria-hidden
              />
              <span className="text-sm font-semibold text-text-secondary">
                {THRESHOLD_LABELS[thrKey]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={value ?? ''}
                onChange={(e) => onChange(thrKey, e.target.value)}
                className="min-h-12 w-full rounded-lg border-2 border-text-secondary/20 bg-white px-3 text-lg font-semibold text-text-primary focus:border-primary focus:outline-none"
                placeholder="未設定"
              />
              {unit && (
                <span className="shrink-0 text-base font-medium text-text-secondary">{unit}</span>
              )}
            </div>
            <div className="mt-2 text-xs text-text-secondary">
              入力値が {THRESHOLD_LABELS[thrKey].replace('閾値', '')} 以上で発火
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MappingEditor({
  rule,
  onChange,
}: {
  rule: MappingRule;
  onChange: (valueKey: string, level: TriageLevel) => void;
}) {
  return (
    <div className="space-y-3">
      {Object.entries(rule).map(([valueKey, level]) => (
        <div
          key={valueKey}
          className="flex flex-col gap-3 rounded-xl bg-background p-3 md:flex-row md:items-center md:justify-between"
        >
          <div className="text-base font-semibold text-text-primary md:w-40">
            {VALUE_LABELS[valueKey] ?? valueKey}
          </div>
          <div className="flex flex-wrap gap-2">
            {SEVERITIES.map((sev) => {
              const active = level === sev;
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => onChange(valueKey, sev)}
                  className={`min-h-12 min-w-20 rounded-full px-4 text-sm font-bold transition ${
                    active
                      ? `${severityBg(sev)} shadow-sm`
                      : 'border-2 border-text-secondary/20 bg-white text-text-secondary hover:border-primary/40'
                  }`}
                >
                  {sev}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
