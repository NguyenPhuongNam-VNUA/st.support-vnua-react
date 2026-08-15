import {
  questionRepository,
  QuestionListOptions,
  QuestionModel,
  QuestionStatus,
} from '@/repositories/admin/question.repository';

const TOPICS = ['Học vụ', 'Học phí', 'Ký túc xá', 'Tuyển sinh', 'Bảo lưu', 'Đồ án', 'Khác'];
const STATUSES: QuestionStatus[] = ['pending', 'approved', 'rejected', 'needs_edit'];

export class QuestionServiceError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'QuestionServiceError';
  }
}

function assertId(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new QuestionServiceError('ID câu hỏi không hợp lệ', 400);
  }
}

function normalizeIds(value: unknown): number[] {
  if (!Array.isArray(value)) throw new QuestionServiceError('Danh sách ID không hợp lệ', 422);
  const ids = [...new Set(value.map(Number))];
  if (ids.length === 0 || ids.length > 100 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new QuestionServiceError('Chỉ cho phép xử lý từ 1 đến 100 ID hợp lệ', 422);
  }
  return ids;
}

function normalizeCreateInput(input: unknown, actorId: number) {
  if (!input || typeof input !== 'object') {
    throw new QuestionServiceError('Dữ liệu câu hỏi không hợp lệ', 422);
  }
  const source = input as Record<string, unknown>;
  const question = typeof source.question === 'string' ? source.question.trim() : '';
  const answer = typeof source.answer === 'string' ? source.answer.trim() : '';
  const topic = typeof source.topic === 'string' ? source.topic.trim() : 'Khác';
  const status = typeof source.status === 'string' ? source.status : 'pending';

  if (!question || question.length > 2000) {
    throw new QuestionServiceError('Câu hỏi phải từ 1 đến 2000 ký tự', 422);
  }
  if (answer.length > 10000) throw new QuestionServiceError('Câu trả lời quá dài', 422);
  if (!TOPICS.includes(topic)) throw new QuestionServiceError('Chủ đề không hợp lệ', 422);
  if (!STATUSES.includes(status as QuestionStatus)) {
    throw new QuestionServiceError('Trạng thái không hợp lệ', 422);
  }
  if (status === 'approved' && !answer) {
    throw new QuestionServiceError('Cần thêm câu trả lời trước khi duyệt', 422);
  }

  return {
    question,
    answer: answer || null,
    topic,
    status,
    duplicate_score: 0,
    created_by: actorId,
    updated_by: actorId,
  };
}

export const questionService = {
  list(options: QuestionListOptions) {
    if (options.status && !STATUSES.includes(options.status as QuestionStatus)) {
      throw new QuestionServiceError('Trạng thái lọc không hợp lệ', 422);
    }
    return questionRepository.list(options);
  },

  async getById(id: number) {
    assertId(id);
    const question = await questionRepository.getById(id);
    if (!question) throw new QuestionServiceError('Không tìm thấy câu hỏi', 404);
    return question;
  },

  create(input: unknown, actorId: number) {
    return questionRepository.create(normalizeCreateInput(input, actorId));
  },

  async createMany(rows: unknown[], actorId: number) {
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 1000) {
      throw new QuestionServiceError('File phải có từ 1 đến 1000 dòng dữ liệu', 422);
    }
    const normalized = rows.map((row) => normalizeCreateInput(row, actorId));
    return questionRepository.createMany(normalized);
  },

  async update(id: number, input: unknown, actorId: number) {
    const current = await this.getById(id);
    if (!input || typeof input !== 'object') {
      throw new QuestionServiceError('Dữ liệu cập nhật không hợp lệ', 422);
    }
    const source = input as Record<string, unknown>;
    const update: Record<string, unknown> = { updated_by: actorId };

    if (typeof source.question === 'string') {
      const value = source.question.trim();
      if (!value || value.length > 2000) throw new QuestionServiceError('Câu hỏi không hợp lệ', 422);
      update.question = value;
    }
    if (typeof source.answer === 'string' || source.answer === null) {
      const value = typeof source.answer === 'string' ? source.answer.trim() : '';
      if (value.length > 10000) throw new QuestionServiceError('Câu trả lời quá dài', 422);
      update.answer = value || null;
    }
    if (typeof source.topic === 'string') {
      if (!TOPICS.includes(source.topic)) throw new QuestionServiceError('Chủ đề không hợp lệ', 422);
      update.topic = source.topic;
    }
    if (typeof source.status === 'string') {
      if (!STATUSES.includes(source.status as QuestionStatus)) {
        throw new QuestionServiceError('Trạng thái không hợp lệ', 422);
      }
      update.status = source.status;
    }
    const nextStatus = (update.status || current.status) as QuestionStatus;
    const nextAnswer = update.answer !== undefined ? update.answer : current.answer;
    if (nextStatus === 'approved' && (typeof nextAnswer !== 'string' || !nextAnswer.trim())) {
      throw new QuestionServiceError('Cần thêm câu trả lời trước khi duyệt', 422);
    }
    return questionRepository.update(id, update);
  },

  async bulkUpdate(input: unknown, actorId: number) {
    if (!input || typeof input !== 'object') throw new QuestionServiceError('Dữ liệu không hợp lệ', 422);
    const source = input as Record<string, unknown>;
    const ids = normalizeIds(source.ids);
    if (!STATUSES.includes(source.status as QuestionStatus)) {
      throw new QuestionServiceError('Trạng thái không hợp lệ', 422);
    }
    if (source.status === 'approved') {
      const rows = await questionRepository.getManyByIds(ids);
      if (rows.some((row) => !row.answer?.trim())) {
        throw new QuestionServiceError(
          'Không thể duyệt hàng loạt: có câu hỏi chưa có câu trả lời',
          422
        );
      }
    }
    return questionRepository.bulkUpdate(ids, { status: source.status, updated_by: actorId });
  },

  async deleteMany(value: unknown, actorId: number) {
    const ids = normalizeIds(value);
    const rows = await questionRepository.getManyByIds(ids);
    if (rows.length !== ids.length) throw new QuestionServiceError('Có câu hỏi không còn tồn tại', 404);
    await questionRepository.deleteMany(ids);
    await questionRepository.addDeleteAudit(rows, actorId);
  },

  async getAuditLogs(id: number) {
    await this.getById(id);
    return questionRepository.getAuditLogs(id);
  },

  getTopQuestions() {
    return questionRepository.getTopQuestions();
  },
};
