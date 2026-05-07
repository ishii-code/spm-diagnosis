export const RULE_LABELS: Record<string, string> = {
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

export const VALUE_LABELS: Record<string, string> = {
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

export const THRESHOLD_LABELS: Record<string, string> = {
  yellow_threshold: 'YELLOW閾値',
  red_threshold: 'RED閾値',
  chronic_threshold: 'CHRONIC閾値',
};

export const RULE_UNITS: Record<string, string> = {
  vomiting_count: '回',
  duration_days: '日',
  last_vomiting_hours: '時間',
  cat_no_food_hours: '時間',
  itch_score: 'スコア',
};

export function ruleLabel(key: string): string {
  return RULE_LABELS[key] ?? key;
}

export function valueLabel(key: string): string {
  return VALUE_LABELS[key] ?? key;
}

export function thresholdLabel(key: string): string {
  return THRESHOLD_LABELS[key] ?? key;
}

export function ruleUnit(key: string): string {
  return RULE_UNITS[key] ?? '';
}
