import { createHash, randomUUID } from 'node:crypto';
import {
  documentRepository,
  DocumentListOptions,
  DocumentPipelineStage,
} from '@/repositories/admin/document.repository';
import { getSupabaseAdmin } from '@/utils/supabase/admin';

const DOCUMENT_BUCKET = 'documents';
const MAX_PDF_SIZE = 15 * 1024 * 1024;
const MAX_MARKDOWN_SIZE = 10 * 1024 * 1024;
const DOCUMENT_TYPES = new Set(['quy_che', 'quyet_dinh', 'thong_bao', 'huong_dan', 'quy_trinh', 'phu_luc', 'other']);
const PIPELINE_STAGES: DocumentPipelineStage[] = [
  'uploading',
  'chunking',
  'embedding',
  'needs_review',
  'ready',
  'error',
];

function optionalText(formData: FormData, name: string, maxLength = 250) {
  const value = String(formData.get(name) || '').trim();
  if (value.length > maxLength) {
    throw new DocumentServiceError(`${name} vượt quá ${maxLength} ký tự`, 422);
  }
  return value || null;
}

function optionalDate(formData: FormData, name: string) {
  const value = optionalText(formData, name, 10);
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = match ? new Date(`${value}T00:00:00Z`) : null;
  if (
    !match
    || !parsed
    || Number.isNaN(parsed.getTime())
    || parsed.getUTCFullYear() !== Number(match[1])
    || parsed.getUTCMonth() + 1 !== Number(match[2])
    || parsed.getUTCDate() !== Number(match[3])
  ) {
    throw new DocumentServiceError(`${name} phải có định dạng YYYY-MM-DD`, 422);
  }
  return value;
}

function optionalList(formData: FormData, name: string) {
  const values = String(formData.get(name) || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length > 30 || values.some((value) => value.length > 100)) {
    throw new DocumentServiceError(`${name} chứa quá nhiều giá trị hoặc giá trị quá dài`, 422);
  }
  return [...new Set(values)];
}

export class DocumentServiceError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'DocumentServiceError';
  }
}

function parseDocumentId(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new DocumentServiceError('ID tài liệu không hợp lệ', 400);
  }
}

export const documentService = {
  list(options: DocumentListOptions) {
    return documentRepository.list(options);
  },

  async getById(id: number) {
    parseDocumentId(id);
    const document = await documentRepository.getById(id);
    if (!document) throw new DocumentServiceError('Không tìm thấy tài liệu', 404);
    return document;
  },

  async upload(formData: FormData, actorId: number) {
    const title = String(formData.get('title') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const validity = String(formData.get('validity') || 'Còn hiệu lực').trim();
    const version = String(formData.get('version') || 'v1.0').trim();
    const documentType = String(formData.get('document_type') || 'other').trim();
    const issuedDate = optionalDate(formData, 'issued_date');
    const validFrom = optionalDate(formData, 'valid_from');
    const validTo = optionalDate(formData, 'valid_to');
    const file = formData.get('file');

    if (!title || title.length > 250) {
      throw new DocumentServiceError('Tiêu đề tài liệu phải từ 1 đến 250 ký tự', 422);
    }
    if (!(file instanceof File)) {
      throw new DocumentServiceError('Vui lòng chọn file PDF', 422);
    }
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      throw new DocumentServiceError('Chỉ chấp nhận file PDF', 415);
    }
    if (file.size <= 0 || file.size > MAX_PDF_SIZE) {
      throw new DocumentServiceError('File PDF phải nhỏ hơn hoặc bằng 15 MB', 413);
    }
    if (!DOCUMENT_TYPES.has(documentType)) {
      throw new DocumentServiceError('Loại tài liệu không hợp lệ', 422);
    }
    if (validFrom && validTo && validFrom > validTo) {
      throw new DocumentServiceError('Ngày hết hiệu lực phải sau ngày bắt đầu hiệu lực', 422);
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
    const storagePath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
    const supabase = getSupabaseAdmin();
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      throw new DocumentServiceError(`Không thể tải PDF lên Storage: ${uploadError.message}`, 500);
    }

    try {
      return await documentRepository.create({
        title,
        description: description || null,
        version: version || 'v1.0',
        validity: validity || null,
        is_active: true,
        pipeline_stage: 'uploading',
        progress: 0,
        file_path: storagePath,
        created_by: actorId,
        document_number: optionalText(formData, 'document_number', 100),
        document_type: documentType,
        issuer: optionalText(formData, 'issuer', 250),
        issuing_unit: optionalText(formData, 'issuing_unit', 250),
        signed_by: optionalText(formData, 'signed_by', 150),
        signed_date: optionalDate(formData, 'signed_date'),
        issued_date: issuedDate,
        valid_from: validFrom,
        valid_to: validTo,
        validity_status: validity.toLowerCase().includes('hết') ? 'expired' : 'effective',
        academic_year: optionalText(formData, 'academic_year', 20),
        semester: optionalText(formData, 'semester', 30),
        audiences: optionalList(formData, 'audiences'),
        education_levels: optionalList(formData, 'education_levels'),
        study_modes: optionalList(formData, 'study_modes'),
        faculties: optionalList(formData, 'faculties'),
        programs: optionalList(formData, 'programs'),
        campuses: optionalList(formData, 'campuses'),
        cohorts: optionalList(formData, 'cohorts'),
        original_filename: file.name.replace(/[\u0000-\u001f\u007f]/g, '').slice(-255),
        markdown_path: null,
        markdown_sha256: null,
        markdown_content: null,
        review_status: 'pending',
      });
    } catch (error) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
      throw error;
    }
  },

  async update(id: number, input: unknown) {
    const current = await this.getById(id);
    if (!input || typeof input !== 'object') {
      throw new DocumentServiceError('Dữ liệu cập nhật không hợp lệ', 422);
    }

    const source = input as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    if (typeof source.title === 'string') {
      const title = source.title.trim();
      if (!title || title.length > 250) throw new DocumentServiceError('Tiêu đề không hợp lệ', 422);
      update.title = title;
    }
    if (typeof source.description === 'string' || source.description === null) {
      update.description = typeof source.description === 'string' ? source.description.trim() || null : null;
    }
    if (typeof source.version === 'string') update.version = source.version.trim();
    if (typeof source.validity === 'string' || source.validity === null) update.validity = source.validity;
    if (typeof source.is_active === 'boolean') update.is_active = source.is_active;
    if (typeof source.pipeline_stage === 'string') {
      if (!PIPELINE_STAGES.includes(source.pipeline_stage as DocumentPipelineStage)) {
        throw new DocumentServiceError('Trạng thái pipeline không hợp lệ', 422);
      }
      update.pipeline_stage = source.pipeline_stage;
    }
    if (typeof source.review_status === 'string') {
      if (!['pending', 'needs_review', 'approved', 'rejected'].includes(source.review_status)) {
        throw new DocumentServiceError('Trạng thái duyệt OCR không hợp lệ', 422);
      }
      update.review_status = source.review_status;
    }
    for (const field of ['document_number', 'issuer', 'issuing_unit', 'signed_by', 'academic_year', 'semester'] as const) {
      if (typeof source[field] === 'string' || source[field] === null) {
        const value = typeof source[field] === 'string' ? source[field].trim() : null;
        if (value && value.length > 250) throw new DocumentServiceError(`${field} quá dài`, 422);
        update[field] = value || null;
      }
    }
    if (typeof source.document_type === 'string') {
      if (!DOCUMENT_TYPES.has(source.document_type)) throw new DocumentServiceError('Loại tài liệu không hợp lệ', 422);
      update.document_type = source.document_type;
    }
    if (typeof source.progress === 'number') {
      if (!Number.isInteger(source.progress) || source.progress < 0 || source.progress > 100) {
        throw new DocumentServiceError('Tiến độ phải là số nguyên từ 0 đến 100', 422);
      }
      update.progress = source.progress;
    }

    if (Object.keys(update).length === 0) return current;
    return documentRepository.update(id, update);
  },

  async delete(id: number) {
    const document = await this.getById(id);
    await documentRepository.delete(id);
    const { error } = await getSupabaseAdmin().storage
      .from(DOCUMENT_BUCKET)
      .remove([document.file_path]);
    if (error) console.warn('Không thể dọn file Storage sau khi xóa tài liệu:', error.message);
  },

  async getSignedFileUrl(id: number) {
    const document = await this.getById(id);
    const { data, error } = await getSupabaseAdmin().storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(document.file_path, 5 * 60);
    if (error || !data?.signedUrl) {
      throw new DocumentServiceError('Không thể tạo liên kết xem PDF', 500);
    }
    return data.signedUrl;
  },

  async listChunks(id: number) {
    await this.getById(id);
    return documentRepository.listChunks(id);
  },

  async getMarkdown(id: number) {
    await this.getById(id);
    const markdown = await documentRepository.getMarkdown(id);
    if (!markdown?.markdown_content) {
      throw new DocumentServiceError('Tài liệu chưa được chuyển đổi sang Markdown', 409);
    }
    return markdown;
  },

  async saveMarkdown(id: number, input: unknown) {
    const current = await this.getById(id);
    if (current.pipeline_stage === 'chunking' || current.pipeline_stage === 'embedding') {
      throw new DocumentServiceError('Tài liệu đang được xử lý, vui lòng chờ hoàn tất trước khi sửa Markdown', 409);
    }
    if (!input || typeof input !== 'object') {
      throw new DocumentServiceError('Dữ liệu Markdown không hợp lệ', 422);
    }

    const raw = (input as Record<string, unknown>).markdown_content;
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new DocumentServiceError('Nội dung Markdown không được để trống', 422);
    }
    const markdownContent = `${raw.replace(/\r\n?/g, '\n').trimEnd()}\n`;
    if (Buffer.byteLength(markdownContent, 'utf8') > MAX_MARKDOWN_SIZE) {
      throw new DocumentServiceError('Nội dung Markdown vượt quá 10 MB', 413);
    }

    const markdownSha256 = createHash('sha256').update(markdownContent).digest('hex');
    if (markdownSha256 === current.markdown_sha256) {
      return { document: current, changed: false };
    }

    const document = await documentRepository.update(id, {
      markdown_content: markdownContent,
      markdown_sha256: markdownSha256,
      markdown_path: `db://documents/${id}/markdown/${markdownSha256}.md`,
      markdown_generated_at: new Date().toISOString(),
      parser_used: 'admin_markdown',
      review_status: 'approved',
      pipeline_stage: 'uploading',
      progress: 0,
      is_active: false,
    });
    return { document, changed: true };
  },
};
