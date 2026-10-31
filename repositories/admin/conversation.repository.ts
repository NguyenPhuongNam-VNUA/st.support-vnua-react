import { getSupabaseAdmin } from '@/utils/supabase/admin';

interface MessageRow {
  id: number;
  conversation_id: number;
  sender: 'user' | 'bot';
  content: string;
  status: string | null;
  feedback?: string | null;
  rating?: number | null;
  created_at: string;
}

export const conversationRepository = {
  // shortcut: newest `limit` answers only; a busy 30-day window gets truncated. Move aggregation to SQL if that happens.
  async listLogs(limit = 500, range: { from?: Date | null; to?: Date | null } = {}) {
    const safeLimit = Math.max(1, Math.min(1000, limit));
    let query = getSupabaseAdmin()
      .from('messages')
      .select('id, conversation_id, sender, content, status, feedback, rating, created_at')
      .order('created_at', { ascending: false })
      .limit(safeLimit * 2);
    // Start an hour early so the user question paired with the first answer is included.
    if (range.from) query = query.gte('created_at', new Date(range.from.getTime() - 60 * 60 * 1000).toISOString());
    if (range.to) query = query.lte('created_at', range.to.toISOString());
    const { data, error } = await query;

    if (error) throw new Error(`Không thể tải nhật ký hội thoại: ${error.message}`);

    const rows = ((data || []) as MessageRow[]).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const lastUserMessage = new Map<number, MessageRow>();
    const logs: Array<Record<string, unknown>> = [];

    for (const row of rows) {
      if (row.sender === 'user') {
        lastUserMessage.set(row.conversation_id, row);
        continue;
      }

      const question = lastUserMessage.get(row.conversation_id);
      logs.push({
        id: row.id,
        conversation_id: row.conversation_id,
        question: question?.content || '',
        context: '',
        answer: row.content,
        response_type: row.status || 'answered',
        feedback: row.feedback || null,
        rating: row.rating || null,
        created_at: row.created_at,
      });
    }

    const fromMs = range.from ? range.from.getTime() : -Infinity;
    return logs
      .filter((log) => new Date(String(log.created_at)).getTime() >= fromMs)
      .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
      .slice(0, safeLimit);
  },
};
