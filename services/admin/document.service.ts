import { randomUUID } from 'node:crypto';
import {
  documentRepository,
  DocumentListOptions,
  DocumentPipelineStage,
} from '@/repositories/admin/document.repository';
import { getSupabaseAdmin } from '@/utils/supabase/admin';

const DOCUMENT_BUCKET = 'documents';
const MAX_PDF_SIZE = 15 * 1024 * 1024;
const PIPELINE_STAGES: DocumentPipelineStage[] = [
  'uploading',
  'chunking',
  'embedding',
  'ready',
  'error',
];

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
};
