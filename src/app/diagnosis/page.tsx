'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type ChiefComplaint = 'diarrhea' | 'vomiting' | 'skin';
type TriageLevel = 'GREEN' | 'YELLOW' | 'RED' | 'CHRONIC';

type ThresholdRule = Partial<
  Record<'yellow_threshold' | 'red_threshold' | 'chronic_threshold', number>
>;
type MappingRule = Record<string, TriageLevel>;
type Rule = ThresholdRule | MappingRule;

interface SettingsFile {
  complaint: ChiefComplaint;
  rules: Record<string, Rule>;
}

interface ComplaintMeta {
  id: ChiefComplaint;
  label: string;
  icon: string;
  description: string;
}

interface TriageResponse {
  triage: TriageLevel;
  matched_conditions: string[];
  initial_actions: string[];
  followup_hours: number;
  refer_to_center: boolean;
}

interface TestsResponse {
  recommended_tests: string[];
  decision_point: string;
}

interface Drug {
  name: string;
  dose: string;
  duration: string;
}

interface TreatmentResponse {
  treatment: string;
  drugs: Drug[];
  refer_to_center: boolean;
}

type FormValue = number | string | boolean | undefined;

const COMPLAINTS: ComplaintMeta[] = [
  {
    id: 'diarrhea',
    label: '下痢',
    icon: '💩',
    description: '便回数の増加、軟便・水様便、血便、しぶり等',
  },
  {
    id: 'vomiting',
    label: '嘔吐',
    icon: '🤮',
    description: '吐物の排出、空嘔吐、食後嘔吐、血様嘔吐等',
  },
  {
    id: 'skin',
    label: '皮膚症状',
    icon: '🐾',
    description: '掻痒、脱毛、発赤、膿疱、痂皮、腫瘤等',
  },
];

const TEST_SITUATIONS: Record<ChiefComplaint, string[]> = {
  diarrhea: [
    'GREEN急性下痢',
    '血便あり全身安定',
    '嘔吐併発・腹痛・脱水',
    '14日以上/反復',
  ],
  vomiting: [
    '単発嘔吐で全身安定',
    '反復嘔吐/食欲低下',
    '腹痛・異物疑い',
    '猫の嘔吐・食欲不振',
    '慢性/体重減少',
  ],
  skin: [
    'かゆみ・赤み',
    '膿疱・痂皮・表皮小環',
    '脱毛・フケ・環状病変',
    '慢性/再発性掻痒',
    '皮膚腫瘤',
  ],
};

const TREATMENT_SITUATIONS: Record<ChiefComplaint, string[]> = {
  diarrhea: [
    '大きな異常なし/GREEN',
    '血便あり全身安定',
    '嘔吐併発',
    '寄生虫陽性',
    'Giardia/抗原虫',
    '脱水・電解質異常',
    '慢性/反復',
  ],
  vomiting: [
    '閉塞が否定的な急性嘔吐',
    '胃内容停滞疑い',
    '吐血・メレナ・NSAIDs関連',
    '脱水・電解質異常',
    '異物・閉塞・強い腹痛',
  ],
  skin: [
    '細胞診：球菌少数/表在性・限局',
    '細胞診：細菌多数、広範囲、深部',
    'マラセチア陽性',
    '外部寄生虫',
    '感染・寄生虫評価後の強い掻痒（犬）',
    '慢性アトピー管理',
    '急性炎症で感染が否定的',
  ],
};

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

const RULE_UNITS: Record<string, string> = {
  vomiting_count: '回',
  duration_days: '日',
  last_vomiting_hours: '時間',
  cat_no_food_hours: '時間',
  itch_score: '点',
};

const THRESHOLD_KEYS = ['yellow_threshold', 'red_threshold', 'chronic_threshold'] as const;

function isThresholdRule(rule: Rule): rule is ThresholdRule {
  return Object.keys(rule).some((k) => (THRESHOLD_KEYS as readonly string[]).includes(k));
}

function isYesNoRule(rule: MappingRule): boolean {
  const keys = Object.keys(rule);
  return keys.length === 2 && keys.every((k) => k === 'yes' || k === 'no');
}

function formatFollowupHours(h: number): string {
  if (h <= 0) return '即時対応';
  if (h < 24) return `${h}時間以内`;
  if (h % 24 === 0) {
    const days = h / 24;
    if (days >= 14) return `${Math.round(days / 7)}週間以内`;
    return `${days}日以内`;
  }
  return `${h}時間以内`;
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

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <div className="flex max-w-md items-center gap-3 rounded-xl bg-triage-red px-5 py-4 text-base font-medium text-white shadow-lg">
        <span aria-hidden>⚠️</span>
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

export default function DiagnosisPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [complaint, setComplaint] = useState<ChiefComplaint | null>(null);
  const [settings, setSettings] = useState<SettingsFile | null>(null);
  const [values, setValues] = useState<Record<string, FormValue>>({});
  const [triage, setTriage] = useState<TriageResponse | null>(null);
  const [testSituation, setTestSituation] = useState<string | null>(null);
  const [tests, setTests] = useState<TestsResponse | null>(null);
  const [treatmentSituation, setTreatmentSituation] = useState<string | null>(null);
  const [treatment, setTreatment] = useState<TreatmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complaintLabel = useMemo(
    () => COMPLAINTS.find((c) => c.id === complaint)?.label ?? '',
    [complaint],
  );

  function reset() {
    setStep(1);
    setComplaint(null);
    setSettings(null);
    setValues({});
    setTriage(null);
    setTestSituation(null);
    setTests(null);
    setTreatmentSituation(null);
    setTreatment(null);
    setError(null);
  }

  async function selectComplaint(c: ChiefComplaint) {
    setComplaint(c);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/diagnosis/settings?complaint=${c}`);
      if (!res.ok) throw new Error(`設定の取得に失敗しました (${res.status})`);
      const data = (await res.json()) as SettingsFile;
      setSettings(data);
      setValues({});
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : '設定取得エラー');
    } finally {
      setLoading(false);
    }
  }

  function setValue(key: string, value: FormValue) {
    setValues((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  async function runTriage() {
    if (!complaint) return;
    setLoading(true);
    setError(null);
    try {
      const submitValues: Record<string, number | string | boolean> = {};
      for (const [k, v] of Object.entries(values)) {
        if (v !== undefined) submitValues[k] = v;
      }
      const res = await fetch('/api/diagnosis/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chief_complaint: complaint, values: submitValues }),
      });
      if (!res.ok) throw new Error(`トリアージ判定に失敗しました (${res.status})`);
      const data = (await res.json()) as TriageResponse;
      setTriage(data);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'トリアージ判定エラー');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTests(situation: string) {
    if (!complaint) return;
    setTestSituation(situation);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnosis/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chief_complaint: complaint, situation }),
      });
      if (!res.ok) throw new Error(`検査提案の取得に失敗しました (${res.status})`);
      const data = (await res.json()) as TestsResponse;
      setTests(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '検査提案エラー');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTreatment(situation: string) {
    if (!complaint) return;
    setTreatmentSituation(situation);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/diagnosis/treatment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chief_complaint: complaint, situation }),
      });
      if (!res.ok) throw new Error(`治療提案の取得に失敗しました (${res.status})`);
      const data = (await res.json()) as TreatmentResponse;
      setTreatment(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '治療提案エラー');
    } finally {
      setLoading(false);
    }
  }

  function goToTests() {
    if (!complaint) return;
    setStep(4);
    setTests(null);
    void fetchTests(TEST_SITUATIONS[complaint][0]);
  }

  function goToTreatment() {
    if (!complaint) return;
    setStep(5);
    setTreatment(null);
    void fetchTreatment(TREATMENT_SITUATIONS[complaint][0]);
  }

  return (
    <div className="min-h-screen bg-background pb-24 text-text-primary">
      <header className="sticky top-0 z-30 bg-primary text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
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
              <div className="text-xs opacity-90">動物医療センター 診断支援</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <StepIndicator step={step} />
            <Link
              href="/diagnosis/settings"
              aria-label="トリアージ設定（管理者）"
              title="トリアージ設定（管理者）"
              className="flex size-12 items-center justify-center rounded-full bg-white/15 text-xl hover:bg-white/25 active:scale-95"
            >
              ⚙️
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {step === 1 && <Step1 onSelect={selectComplaint} loading={loading} />}
        {step === 2 && settings && (
          <Step2
            complaintLabel={complaintLabel}
            settings={settings}
            values={values}
            onChange={setValue}
            onSubmit={runTriage}
            onBack={() => setStep(1)}
            loading={loading}
          />
        )}
        {step === 3 && triage && (
          <Step3
            triage={triage}
            onNext={goToTests}
            onBack={() => setStep(2)}
            loading={loading}
          />
        )}
        {step === 4 && complaint && (
          <Step4
            complaint={complaint}
            tests={tests}
            currentSituation={testSituation}
            onPick={fetchTests}
            onNext={goToTreatment}
            onBack={() => setStep(3)}
            loading={loading}
          />
        )}
        {step === 5 && complaint && (
          <Step5
            complaint={complaint}
            treatment={treatment}
            currentSituation={treatmentSituation}
            onPick={fetchTreatment}
            onRestart={reset}
            onBack={() => setStep(4)}
            loading={loading}
          />
        )}
      </main>

      {error && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="hidden items-center gap-2 md:flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`flex size-9 items-center justify-center rounded-full text-sm font-bold ${
            n === step
              ? 'bg-white text-primary'
              : n < step
                ? 'bg-white/40 text-white'
                : 'bg-white/15 text-white/70'
          }`}
        >
          {n}
        </div>
      ))}
    </div>
  );
}

function Step1({
  onSelect,
  loading,
}: {
  onSelect: (c: ChiefComplaint) => void;
  loading: boolean;
}) {
  return (
    <section>
      <h1 className="mb-2 text-3xl font-bold">主訴を選択</h1>
      <p className="mb-8 text-base text-text-secondary">
        主訴をタップしてトリアージ入力に進んでください
      </p>
      <div className="flex flex-col gap-4">
        {COMPLAINTS.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={loading}
            onClick={() => onSelect(c.id)}
            className="group flex min-h-32 w-full items-center gap-6 rounded-2xl border-2 border-transparent bg-surface p-6 text-left shadow-sm transition active:scale-[0.99] active:bg-primary-light hover:border-primary disabled:opacity-60"
          >
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-5xl">
              {c.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-2xl font-bold text-text-primary">{c.label}</div>
              <div className="mt-1 text-base text-text-secondary">{c.description}</div>
            </div>
            <div className="shrink-0 text-3xl text-primary group-hover:translate-x-1 transition">
              →
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function Step2({
  complaintLabel,
  settings,
  values,
  onChange,
  onSubmit,
  onBack,
  loading,
}: {
  complaintLabel: string;
  settings: SettingsFile;
  values: Record<string, FormValue>;
  onChange: (key: string, value: FormValue) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const setCount = Object.keys(values).filter((k) => values[k] !== undefined).length;
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">トリアージ入力</h1>
          <p className="mt-1 text-base text-text-secondary">
            主訴: <span className="font-semibold text-primary">{complaintLabel}</span>
            ・該当する項目を入力 ({setCount}件入力中)
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-xl border-2 border-text-secondary/20 bg-surface px-5 text-base font-semibold text-text-secondary active:bg-background"
        >
          ← 戻る
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(settings.rules).map(([key, rule]) => (
          <RuleInput
            key={key}
            ruleKey={key}
            rule={rule}
            value={values[key]}
            onChange={(v) => onChange(key, v)}
          />
        ))}
      </div>

      <div className="sticky bottom-4 mt-8">
        <button
          type="button"
          disabled={loading}
          onClick={onSubmit}
          className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-xl font-bold text-white shadow-lg active:scale-[0.99] active:bg-primary-dark hover:bg-primary-dark disabled:opacity-60"
        >
          {loading ? <Spinner /> : <>トリアージ判定 →</>}
        </button>
      </div>
    </section>
  );
}

function RuleInput({
  ruleKey,
  rule,
  value,
  onChange,
}: {
  ruleKey: string;
  rule: Rule;
  value: FormValue;
  onChange: (v: FormValue) => void;
}) {
  const label = RULE_LABELS[ruleKey] ?? ruleKey;
  const unit = RULE_UNITS[ruleKey] ?? '';

  if (isThresholdRule(rule)) {
    const numeric = typeof value === 'number' ? value : '';
    return (
      <div className="rounded-2xl bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden>🔢</span>
            <span>{label}</span>
          </div>
          <ThresholdHints rule={rule} unit={unit} />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            value={numeric}
            onChange={(e) =>
              onChange(e.target.value === '' ? undefined : Number(e.target.value))
            }
            className="min-h-14 w-full max-w-48 rounded-xl border-2 border-text-secondary/20 bg-background px-4 text-2xl font-semibold text-text-primary focus:border-primary focus:outline-none"
            placeholder="未入力"
          />
          {unit && <span className="text-lg font-medium text-text-secondary">{unit}</span>}
          {value !== undefined && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="ml-auto min-h-12 rounded-xl border-2 border-text-secondary/20 bg-surface px-4 text-sm font-semibold text-text-secondary active:bg-background"
            >
              クリア
            </button>
          )}
        </div>
      </div>
    );
  }

  // Mapping rule
  const mapping = rule as MappingRule;
  const yesNo = isYesNoRule(mapping);

  if (yesNo) {
    const isYes = value === true;
    const isNo = value === false;
    return (
      <div className="rounded-2xl bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-lg font-bold">
          <span aria-hidden>✅</span>
          <span>{label}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <SegmentedButton
            label={`なし (${mapping.no})`}
            level={mapping.no}
            active={isNo}
            onClick={() => onChange(isNo ? undefined : false)}
          />
          <SegmentedButton
            label={`あり (${mapping.yes})`}
            level={mapping.yes}
            active={isYes}
            onClick={() => onChange(isYes ? undefined : true)}
          />
        </div>
      </div>
    );
  }

  // Multi-choice mapping
  const choices = Object.entries(mapping);
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-lg font-bold">
        <span aria-hidden>🎯</span>
        <span>{label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {choices.map(([choiceKey, level]) => {
          const active = value === choiceKey;
          return (
            <SegmentedButton
              key={choiceKey}
              label={`${VALUE_LABELS[choiceKey] ?? choiceKey} (${level})`}
              level={level}
              active={active}
              onClick={() => onChange(active ? undefined : choiceKey)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ThresholdHints({ rule, unit }: { rule: ThresholdRule; unit: string }) {
  const hints: string[] = [];
  if (rule.chronic_threshold !== undefined)
    hints.push(`CHRONIC≥${rule.chronic_threshold}${unit}`);
  if (rule.yellow_threshold !== undefined)
    hints.push(`YELLOW≥${rule.yellow_threshold}${unit}`);
  if (rule.red_threshold !== undefined) hints.push(`RED≥${rule.red_threshold}${unit}`);
  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {hints.map((h) => (
        <span
          key={h}
          className="rounded-full bg-primary-light px-2 py-1 font-semibold text-primary-dark"
        >
          {h}
        </span>
      ))}
    </div>
  );
}

function levelTone(level: TriageLevel, active: boolean): string {
  if (!active) {
    return 'border-2 border-text-secondary/15 bg-background text-text-primary hover:border-primary/40';
  }
  switch (level) {
    case 'GREEN':
      return 'bg-triage-green text-white shadow-sm';
    case 'YELLOW':
      return 'bg-triage-yellow text-white shadow-sm';
    case 'RED':
      return 'bg-triage-red text-white shadow-sm';
    case 'CHRONIC':
      return 'bg-text-secondary text-white shadow-sm';
  }
}

function SegmentedButton({
  label,
  level,
  active,
  onClick,
}: {
  label: string;
  level: TriageLevel;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-14 rounded-xl px-5 text-base font-semibold transition active:scale-[0.98] ${levelTone(level, active)}`}
    >
      {label}
    </button>
  );
}

const TRIAGE_STYLE: Record<TriageLevel, { bg: string; label: string; sub: string }> = {
  GREEN: { bg: 'bg-triage-green', label: 'GREEN', sub: '軽度・経過観察可' },
  YELLOW: { bg: 'bg-triage-yellow', label: 'YELLOW', sub: '要検査・補液考慮' },
  RED: { bg: 'bg-triage-red', label: 'RED', sub: '緊急・要紹介' },
  CHRONIC: { bg: 'bg-text-secondary', label: 'CHRONIC', sub: '慢性経過' },
};

function Step3({
  triage,
  onNext,
  onBack,
  loading,
}: {
  triage: TriageResponse;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const style = TRIAGE_STYLE[triage.triage];
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">トリアージ結果</h1>
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-xl border-2 border-text-secondary/20 bg-surface px-5 text-base font-semibold text-text-secondary active:bg-background"
        >
          ← 戻る
        </button>
      </div>

      <div className={`mb-6 rounded-3xl ${style.bg} p-8 text-white shadow-lg`}>
        <div className="text-sm font-semibold uppercase tracking-widest opacity-90">
          Triage
        </div>
        <div className="mt-2 text-6xl font-black tracking-wider">{style.label}</div>
        <div className="mt-2 text-xl font-medium opacity-95">{style.sub}</div>
      </div>

      {triage.refer_to_center && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl bg-triage-red px-6 py-5 text-white shadow-md">
          <span className="text-3xl" aria-hidden>🏥</span>
          <div>
            <div className="text-lg font-bold">センター病院へ紹介</div>
            <div className="text-base opacity-95">
              紹介前に酸素・保温・IV確保・初期評価を実施してください
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title="一致した条件" emoji="📋">
          {triage.matched_conditions.length === 0 ? (
            <p className="text-text-secondary">
              該当する重症度条件はありません（GREEN既定）
            </p>
          ) : (
            <ul className="space-y-2">
              {triage.matched_conditions.map((c) => (
                <li key={c} className="flex items-start gap-2 text-base">
                  <span className="text-primary">●</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
        </InfoCard>

        <InfoCard title="初動アクション" emoji="⚡">
          <ul className="space-y-2">
            {triage.initial_actions.map((a) => (
              <li key={a} className="flex items-start gap-2 text-base">
                <span className="text-accent">▸</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </InfoCard>

        <InfoCard title="フォローアップ" emoji="⏰">
          <div className="text-2xl font-bold text-primary">
            {formatFollowupHours(triage.followup_hours)}
          </div>
          <div className="mt-1 text-sm text-text-secondary">
            ({triage.followup_hours} 時間)
          </div>
        </InfoCard>

        <InfoCard title="センター紹介" emoji="🏥">
          <div
            className={`text-2xl font-bold ${triage.refer_to_center ? 'text-triage-red' : 'text-triage-green'}`}
          >
            {triage.refer_to_center ? '必要' : '不要'}
          </div>
        </InfoCard>
      </div>

      <div className="sticky bottom-4 mt-8">
        <button
          type="button"
          disabled={loading}
          onClick={onNext}
          className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-xl font-bold text-white shadow-lg active:scale-[0.99] active:bg-primary-dark hover:bg-primary-dark disabled:opacity-60"
        >
          {loading ? <Spinner /> : <>検査提案を見る →</>}
        </button>
      </div>
    </section>
  );
}

function InfoCard({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-lg font-bold text-text-primary">
        <span aria-hidden>{emoji}</span>
        <span>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function SituationPicker({
  label,
  options,
  current,
  onPick,
  disabled,
}: {
  label: string;
  options: string[];
  current: string | null;
  onPick: (s: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mb-6">
      <div className="mb-2 text-sm font-semibold text-text-secondary">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt === current;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onPick(opt)}
              disabled={disabled}
              className={`min-h-12 rounded-full border-2 px-4 py-2 text-base font-medium transition active:scale-[0.98] disabled:opacity-60 ${
                active
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-primary/30 bg-surface text-primary-dark hover:border-primary'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step4({
  complaint,
  tests,
  currentSituation,
  onPick,
  onNext,
  onBack,
  loading,
}: {
  complaint: ChiefComplaint;
  tests: TestsResponse | null;
  currentSituation: string | null;
  onPick: (s: string) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const options = TEST_SITUATIONS[complaint];
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">検査提案</h1>
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-xl border-2 border-text-secondary/20 bg-surface px-5 text-base font-semibold text-text-secondary active:bg-background"
        >
          ← 戻る
        </button>
      </div>

      <SituationPicker
        label="状況を選択"
        options={options}
        current={currentSituation}
        onPick={onPick}
        disabled={loading}
      />

      {loading && !tests ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl bg-surface">
          <div className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      ) : tests ? (
        <>
          <div className="mb-4 rounded-2xl bg-surface p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-lg font-bold">
              <span aria-hidden>🔬</span>
              <span>推奨検査項目</span>
              <span className="ml-auto rounded-full bg-primary-light px-3 py-0.5 text-sm font-semibold text-primary-dark">
                {tests.recommended_tests.length}件
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {tests.recommended_tests.map((t) => (
                <div
                  key={t}
                  className="flex items-start gap-3 rounded-xl bg-primary-light px-4 py-3 text-base text-primary-dark"
                >
                  <span className="mt-0.5 text-primary">✓</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative ml-2 mb-6 rounded-2xl bg-accent/10 p-5 text-base text-text-primary">
            <div
              className="absolute -top-2 left-6 size-4 rotate-45 bg-accent/10"
              aria-hidden
            />
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-accent">
              <span aria-hidden>💡</span>
              <span>判断ポイント</span>
            </div>
            <p className="leading-relaxed">{tests.decision_point}</p>
          </div>
        </>
      ) : null}

      <div className="sticky bottom-4 mt-8">
        <button
          type="button"
          disabled={loading || !tests}
          onClick={onNext}
          className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-xl font-bold text-white shadow-lg active:scale-[0.99] active:bg-primary-dark hover:bg-primary-dark disabled:opacity-60"
        >
          治療提案を見る →
        </button>
      </div>
    </section>
  );
}

function Step5({
  complaint,
  treatment,
  currentSituation,
  onPick,
  onRestart,
  onBack,
  loading,
}: {
  complaint: ChiefComplaint;
  treatment: TreatmentResponse | null;
  currentSituation: string | null;
  onPick: (s: string) => void;
  onRestart: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const options = TREATMENT_SITUATIONS[complaint];
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">治療提案</h1>
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-xl border-2 border-text-secondary/20 bg-surface px-5 text-base font-semibold text-text-secondary active:bg-background"
        >
          ← 戻る
        </button>
      </div>

      <SituationPicker
        label="状況を選択"
        options={options}
        current={currentSituation}
        onPick={onPick}
        disabled={loading}
      />

      {loading && !treatment ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl bg-surface">
          <div className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        </div>
      ) : treatment ? (
        <>
          {treatment.refer_to_center && (
            <div className="mb-6 flex items-center gap-4 rounded-2xl bg-triage-red px-6 py-5 text-white shadow-md">
              <span className="text-3xl" aria-hidden>🚨</span>
              <div>
                <div className="text-lg font-bold">センター病院への紹介が必要</div>
                <div className="text-base opacity-95">
                  初期安定化後、速やかに高度医療を提供できる施設へ転送してください
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 rounded-2xl bg-surface p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-lg font-bold">
              <span aria-hidden>💊</span>
              <span>治療内容</span>
            </div>
            <p className="text-base leading-relaxed text-text-primary">{treatment.treatment}</p>
          </div>

          {treatment.drugs.length > 0 && (
            <div className="mb-6 rounded-2xl bg-surface p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold">
                <span aria-hidden>📦</span>
                <span>処方薬剤</span>
                <span className="ml-auto rounded-full bg-primary-light px-3 py-0.5 text-sm font-semibold text-primary-dark">
                  {treatment.drugs.length}剤
                </span>
              </div>
              <div className="space-y-3">
                {treatment.drugs.map((d, i) => (
                  <div
                    key={`${d.name}-${i}`}
                    className="overflow-hidden rounded-xl border-2 border-primary-light"
                  >
                    <div className="bg-primary-light px-4 py-2 text-base font-bold text-primary-dark">
                      {d.name}
                    </div>
                    <div className="grid grid-cols-1 divide-y divide-primary-light/60 md:grid-cols-2 md:divide-x md:divide-y-0">
                      <DrugCell label="用量・用法" value={d.dose} />
                      <DrugCell label="期間" value={d.duration} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      <div className="sticky bottom-4 mt-8 grid gap-3 md:grid-cols-[1fr_2fr]">
        <button
          type="button"
          onClick={onBack}
          className="min-h-16 rounded-2xl border-2 border-primary/30 bg-surface px-6 text-lg font-bold text-primary-dark active:scale-[0.99] active:bg-primary-light"
        >
          ← 検査に戻る
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-primary px-6 text-xl font-bold text-white shadow-lg active:scale-[0.99] active:bg-primary-dark hover:bg-primary-dark"
        >
          🔄 最初に戻る
        </button>
      </div>
    </section>
  );
}

function DrugCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </div>
      <div className="mt-1 text-base text-text-primary">{value}</div>
    </div>
  );
}
