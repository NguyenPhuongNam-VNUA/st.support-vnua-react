import { getSupabaseAdmin } from '@/utils/supabase/admin';

export type QuestionStatus = 'pending' | 'approved' | 'rejected' | 'needs_edit';
export type QuestionAnswerFilter = 'answered' | 'unanswered';

export interface QuestionModel {
  id: number;
  question: string;
  answer: string | null;
  topic: string | null;
  status: QuestionStatus;
  duplicate_score: number;
  duplicate_of_question_id: number | null;
  source_document_id: number | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionListOptions {
  search?: string;
  topic?: string;
  status?: string;
  answer?: QuestionAnswerFilter;
  page?: number;
  limit?: number;
}

const QUESTION_FIELDS =
  'id, question, answer, topic, status, duplicate_score, duplicate_of_question_id, source_document_id, created_by, updated_by, created_at, updated_at';

export const questionRepository = {
  async list(options: QuestionListOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const offset = (page - 1) * limit;
    const keyword = options.search?.trim().replace(/[,%()]/g, ' ');
    let query = getSupabaseAdmin()
      .from('questions')
      .select(QUESTION_FIELDS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    if (keyword) {
      query = query.or(`question.ilike.%${keyword}%,answer.ilike.%${keyword}%`);
    }
    if (options.topic) query = query.eq('topic', options.topic);
    if (options.status) query = query.eq('status', options.status);
    if (options.answer === 'unanswered') query = query.or('answer.is.null,answer.eq.');
    if (options.answer === 'answered') query = query.not('answer', 'is', null).neq('answer', '');

    const buildCountQuery = (status?: QuestionStatus, answer?: QuestionAnswerFilter) => {
      let countQuery = getSupabaseAdmin()
        .from('questions')
        .select('id', { count: 'exact', head: true });

      if (keyword) countQuery = countQuery.or(`question.ilike.%${keyword}%,answer.ilike.%${keyword}%`);
      if (options.topic) countQuery = countQuery.eq('topic', options.topic);
      if (status) countQuery = countQuery.eq('status', status);
      if (answer === 'unanswered') countQuery = countQuery.or('answer.is.null,answer.eq.');
      if (answer === 'answered') countQuery = countQuery.not('answer', 'is', null).neq('answer', '');
      return countQuery;
    };

    const statusKeys = ['all', 'pending', 'approved', 'needs_edit', 'rejected'] as const;
    const results = await Promise.all([
      query,
      ...statusKeys.map((status) =>
        buildCountQuery(status === 'all' ? undefined : status, options.answer)
      ),
      buildCountQuery(options.status as QuestionStatus | undefined, 'answered'),
      buildCountQuery(options.status as QuestionStatus | undefined, 'unanswered'),
    ]);
    const [listResult, ...countResults] = results;
    if (listResult.error) throw new Error(`Không thể tải câu hỏi: ${listResult.error.message}`);

    const countError = countResults.find((result) => result.error)?.error;
    if (countError) throw new Error(`Không thể đếm câu hỏi: ${countError.message}`);

    const statusCounts = Object.fromEntries(
      statusKeys.map((status, index) => [status, countResults[index].count || 0])
    ) as Record<(typeof statusKeys)[number], number>;
    const answerCounts = {
      answered: countResults[statusKeys.length].count || 0,
      unanswered: countResults[statusKeys.length + 1].count || 0,
    };
    const total = listResult.count || 0;

    return {
      questions: (listResult.data || []) as QuestionModel[],
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      statusCounts,
      answerCounts,
    };
  },

  async getById(id: number): Promise<QuestionModel | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('questions')
      .select(QUESTION_FIELDS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Không thể tải câu hỏi: ${error.message}`);
    return data as QuestionModel | null;
  },

  async getManyByIds(ids: number[]): Promise<QuestionModel[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('questions')
      .select(QUESTION_FIELDS)
      .in('id', ids);
    if (error) throw new Error(`Không thể tải câu hỏi: ${error.message}`);
    return (data || []) as QuestionModel[];
  },

  async create(input: Record<string, unknown>) {
    const { data, error } = await getSupabaseAdmin()
      .from('questions')
      .insert(input)
      .select(QUESTION_FIELDS)
      .single();
    if (error) throw new Error(`Không thể tạo câu hỏi: ${error.message}`);
    return data as QuestionModel;
  },

  async createMany(input: Record<string, unknown>[]) {
    const { data, error } = await getSupabaseAdmin()
      .from('questions')
      .insert(input)
      .select(QUESTION_FIELDS);
    if (error) throw new Error(`Không thể nhập danh sách câu hỏi: ${error.message}`);
    return (data || []) as QuestionModel[];
  },

  async update(id: number, input: Record<string, unknown>) {
    const { data, error } = await getSupabaseAdmin()
      .from('questions')
      .update(input)
      .eq('id', id)
      .select(QUESTION_FIELDS)
      .single();
    if (error) throw new Error(`Không thể cập nhật câu hỏi: ${error.message}`);
    return data as QuestionModel;
  },

  async bulkUpdate(ids: number[], input: Record<string, unknown>) {
    const { data, error } = await getSupabaseAdmin()
      .from('questions')
      .update(input)
      .in('id', ids)
      .select(QUESTION_FIELDS);
    if (error) throw new Error(`Không thể cập nhật hàng loạt: ${error.message}`);
    return (data || []) as QuestionModel[];
  },

  async deleteMany(ids: number[]) {
    const { error } = await getSupabaseAdmin().from('questions').delete().in('id', ids);
    if (error) throw new Error(`Không thể xóa câu hỏi: ${error.message}`);
  },

  async addDeleteAudit(rows: QuestionModel[], actorId: number) {
    if (rows.length === 0) return;
    const auditRows = rows.map((row) => ({
      question_id: null,
      action: 'delete',
      old_value: row,
      new_value: null,
      changed_by: actorId,
    }));
    const { error } = await getSupabaseAdmin().from('question_audit_logs').insert(auditRows);
    if (error) throw new Error(`Không thể ghi audit log: ${error.message}`);
  },

  async getAuditLogs(questionId: number) {
    const { data, error } = await getSupabaseAdmin()
      .from('question_audit_logs')
      .select('id, question_id, action, old_value, new_value, changed_by, created_at')
      .eq('question_id', questionId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Không thể tải audit log: ${error.message}`);
    return data || [];
  },

  async getTopQuestions() {
    const { data, error } = await getSupabaseAdmin().rpc('get_top_questions', { p_limit: 5 });
    if (error) throw new Error(`Không thể tải top câu hỏi: ${error.message}`);
    return (data || []).map((item) => ({
      question: item.content,
      ask_count: Number(item.freq) || 0,
    }));
  },
};
