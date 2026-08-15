import { getSupabaseAdmin } from '@/utils/supabase/admin';

interface MessageRow {
  id: number;
  conversation_id: number;
  sender: 'user' | 'bot';
  content: string;
  status: string | null;
  created_at: string;
}

export const conversationRepository = {
  async listLogs(limit = 500) {
    const safeLimit = Math.max(1, Math.min(1000, limit));
    const { data, error } = await getSupabaseAdmin()
      .from('messages')
      .select('id, conversation_id, sender, content, status, created_at')
      .order('created_at', { ascending: false })
      .limit(safeLimit * 2);

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
        created_at: row.created_at,
      });
    }

    return logs
      .sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime())
      .slice(0, safeLimit);
  },
};
