import { getSupabaseAdmin } from '@/utils/supabase/admin';

export type DocumentPipelineStage = 'uploading' | 'chunking' | 'embedding' | 'ready' | 'error';

export interface DocumentModel {
  id: number;
  title: string;
  description: string | null;
  version: string;
  is_active: boolean;
  validity: string | null;
  pipeline_stage: DocumentPipelineStage;
  progress: number;
  file_path: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentListOptions {
  search?: string;
  stage?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

const DOCUMENT_FIELDS =
  'id, title, description, version, is_active, validity, pipeline_stage, progress, file_path, created_by, created_at, updated_at';

export const documentRepository = {
  async list(options: DocumentListOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 24));
    const offset = (page - 1) * limit;
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('documents')
      .select(DOCUMENT_FIELDS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options.search?.trim()) {
      const keyword = options.search.trim().replace(/[,%()]/g, ' ');
      query = query.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`);
    }
    if (options.stage) query = query.eq('pipeline_stage', options.stage);
    if (typeof options.active === 'boolean') query = query.eq('is_active', options.active);

    const { data, count, error } = await query;
    if (error) throw new Error(`Không thể tải tài liệu: ${error.message}`);

    return {
      documents: (data || []) as DocumentModel[],
      total: count || 0,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
    };
  },

  async getById(id: number): Promise<DocumentModel | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('documents')
      .select(DOCUMENT_FIELDS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Không thể tải tài liệu: ${error.message}`);
    return data as DocumentModel | null;
  },

  async create(input: Omit<DocumentModel, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await getSupabaseAdmin()
      .from('documents')
      .insert(input)
      .select(DOCUMENT_FIELDS)
      .single();
    if (error) throw new Error(`Không thể lưu tài liệu: ${error.message}`);
    return data as DocumentModel;
  },

  async update(id: number, input: Partial<DocumentModel>) {
    const { data, error } = await getSupabaseAdmin()
      .from('documents')
      .update(input)
      .eq('id', id)
      .select(DOCUMENT_FIELDS)
      .single();
    if (error) throw new Error(`Không thể cập nhật tài liệu: ${error.message}`);
    return data as DocumentModel;
  },

  async delete(id: number) {
    const { error } = await getSupabaseAdmin().from('documents').delete().eq('id', id);
    if (error) throw new Error(`Không thể xóa tài liệu: ${error.message}`);
  },

  async listChunks(documentId: number) {
    const { data, error } = await getSupabaseAdmin()
      .from('document_chunks')
      .select('id, document_id, page, tokens, content, created_at')
      .eq('document_id', documentId)
      .order('id', { ascending: true });
    if (error) throw new Error(`Không thể tải chunks: ${error.message}`);
    return data || [];
  },
};
