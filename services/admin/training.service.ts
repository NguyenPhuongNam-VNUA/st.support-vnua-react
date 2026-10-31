import { conversationRepository } from '@/repositories/admin/conversation.repository';
import { getSupabaseAdmin } from '@/utils/supabase/admin';
import { buildTopicSuggester, LabeledQuestion, normalizeQuestion } from '@/lib/training/topic-suggester';

export interface FallbackQuestion {
  id: number;
  question: string;
  asked_count: number;
  last_asked_at: string;
  suggested_topic: string;
  topic_confidence: number;
}

interface BankRow extends LabeledQuestion {
  status: string;
}

const PAGE = 1000; // Supabase caps a single select at 1000 rows.

async function loadQuestionBank(): Promise<BankRow[]> {
  const rows: BankRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await getSupabaseAdmin()
      .from('questions')
      .select('question, topic, status')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Không thể tải ngân hàng câu hỏi: ${error.message}`);
    rows.push(...((data || []) as BankRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export const trainingService = {
  /**
   * Fallback questions still waiting for a curated answer. A question counts as handled
   * once the same text exists in the question bank (any status except rejected), so
   * publishing from the training page removes it permanently and rejecting brings it back.
   */
  async listFallbackQuestions(
    options: { limit?: number; from?: Date | null; to?: Date | null } = {}
  ): Promise<FallbackQuestion[]> {
    const [logs, bank] = await Promise.all([
      conversationRepository.listLogs(1000, { from: options.from, to: options.to }),
      loadQuestionBank(),
    ]);
    const usable = bank.filter((row) => row.status !== 'rejected');
    const handled = new Set(usable.map((row) => normalizeQuestion(row.question)));
    const suggest = buildTopicSuggester(usable);

    const groups = new Map<string, { id: number; question: string; asked_count: number; last_asked_at: string }>();
    for (const log of logs as Array<Record<string, any>>) {
      const question = String(log.question || '').trim();
      if (log.response_type !== 'not_found' || !question) continue;
      const key = normalizeQuestion(question);
      if (!key || handled.has(key)) continue;
      const group = groups.get(key);
      if (!group) {
        groups.set(key, { id: Number(log.id), question, asked_count: 1, last_asked_at: log.created_at });
      } else {
        group.asked_count += 1;
        if (new Date(log.created_at) > new Date(group.last_asked_at)) {
          group.last_asked_at = log.created_at;
          group.question = question;
        }
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => b.asked_count - a.asked_count || +new Date(b.last_asked_at) - +new Date(a.last_asked_at))
      .slice(0, options.limit ?? 200)
      .map((group) => {
        const { topic, confidence } = suggest(group.question);
        return { ...group, suggested_topic: topic, topic_confidence: confidence };
      });
  },
};
