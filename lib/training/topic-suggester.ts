// Pure helpers for the training page: no imports so `node --test` can run them directly.

export interface LabeledQuestion {
  question: string;
  topic: string;
}

export interface TopicSuggestion {
  topic: string;
  /** Cosine similarity of the closest labeled question, 0..1. */
  confidence: number;
}

/** Canonical form used to tell whether a fallback question is already in the question bank. */
export function normalizeQuestion(text: string): string {
  return (text || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Filler that appears in every topic ("... của Học viện Nông nghiệp Việt Nam như thế nào?").
// JS `\b` is ASCII-only, so phrases are matched between spaces instead.
const FILLER_PHRASES =
  /(?<= )(học viện nông nghiệp việt nam|học viện nông nghiệp|học viện|vnua|như thế nào|thế nào|ra sao|cho tôi biết|cho em hỏi|cho mình hỏi|thông tin|bao gồm những gì|những gì|là gì)(?= )/gu;

// Vietnamese words are mostly two syllables, so syllable bigrams carry the topic signal.
function features(text: string): string[] {
  const syllables = ` ${normalizeQuestion(text)} `.replace(FILLER_PHRASES, ' ').split(' ').filter(Boolean);
  const out = syllables.filter((s) => s.length > 1);
  for (let i = 0; i < syllables.length - 1; i++) out.push(`${syllables[i]} ${syllables[i + 1]}`);
  return out;
}

// Unambiguous cues, checked before the data-driven vote. The bank has gaps
// (e.g. no "tuyển sinh" question), so these cover topics the data cannot.
const KEYWORD_TOPICS: Array<[string, RegExp]> = [
  ['Tuyển sinh', /(?<= )(tuyển sinh|xét tuyển|chỉ tiêu|điểm chuẩn|thí sinh|nhập học)(?= )/u],
  ['Học phí', /(?<= )(học phí|học bổng|miễn giảm|trợ cấp|công nợ|đóng tiền)(?= )/u],
  ['Ký túc xá', /(?<= )(ký túc xá|kí túc xá|ktx|nội trú)(?= )/u],
  ['Bảo lưu', /(?<= )(bảo lưu|thôi học|nghỉ học tạm thời)(?= )/u],
  ['Đồ án', /(?<= )(đồ án|khóa luận|khoá luận|thực tập)(?= )/u],
  ['Học vụ', /(?<= )(đăng ký tín chỉ|đăng ký học phần|lịch thi|thời khóa biểu|điểm rèn luyện|học lại|thi lại)(?= )/u],
];

function keywordTopic(text: string): string | null {
  const padded = ` ${normalizeQuestion(text)} `;
  const hits = KEYWORD_TOPICS.filter(([, re]) => re.test(padded)).map(([topic]) => topic);
  return hits.length === 1 ? hits[0] : null;
}

type Vector = Map<string, number>;

function toVector(tokens: string[], idf: Map<string, number>): Vector {
  const vec: Vector = new Map();
  for (const t of tokens) {
    const w = idf.get(t);
    if (w) vec.set(t, (vec.get(t) || 0) + w);
  }
  let norm = 0;
  vec.forEach((v) => (norm += v * v));
  norm = Math.sqrt(norm) || 1;
  vec.forEach((v, k) => vec.set(k, v / norm));
  return vec;
}

function cosine(a: Vector, b: Vector): number {
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let sum = 0;
  small.forEach((v, k) => (sum += v * (large.get(k) || 0)));
  return sum;
}

/**
 * Suggests a topic by weighted vote of the k most similar labeled questions (TF-IDF cosine).
 * Falls back to `fallbackTopic` when nothing in the bank is close enough.
 */
export function buildTopicSuggester(
  bank: LabeledQuestion[],
  { k = 5, minSimilarity = 0.12, fallbackTopic = 'Khác' } = {}
): (question: string) => TopicSuggestion {
  const docs = bank.filter((q) => q.question && q.topic).map((q) => ({ topic: q.topic, tokens: features(q.question) }));
  const df = new Map<string, number>();
  for (const d of docs) new Set(d.tokens).forEach((t) => df.set(t, (df.get(t) || 0) + 1));
  const idf = new Map<string, number>();
  df.forEach((count, t) => idf.set(t, Math.log((docs.length + 1) / (count + 1)) + 1));
  const vectors = docs.map((d) => ({ topic: d.topic, vec: toVector(d.tokens, idf) }));

  return (question: string) => {
    const keyword = keywordTopic(question);
    if (keyword) return { topic: keyword, confidence: 1 };
    const query = toVector(features(question), idf);
    if (query.size === 0) return { topic: fallbackTopic, confidence: 0 };
    const neighbors = vectors
      .map((v) => ({ topic: v.topic, sim: cosine(query, v.vec) }))
      .filter((n) => n.sim > 0)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, k);
    const best = neighbors[0]?.sim || 0;
    if (best < minSimilarity) return { topic: fallbackTopic, confidence: best };

    const votes = new Map<string, number>();
    for (const n of neighbors) votes.set(n.topic, (votes.get(n.topic) || 0) + n.sim);
    const [topic] = Array.from(votes.entries()).sort((a, b) => b[1] - a[1])[0];
    return { topic, confidence: Math.round(best * 100) / 100 };
  };
}
