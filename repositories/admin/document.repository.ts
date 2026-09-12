import { getSupabaseAdmin } from '@/utils/supabase/admin';

export type DocumentPipelineStage = 'uploading' | 'chunking' | 'embedding' | 'needs_review' | 'ready' | 'error';

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
  short_title?: string | null;
  document_number?: string | null;
  document_type?: string;
  issuer?: string | null;
  issuing_unit?: string | null;
  signed_by?: string | null;
  signed_date?: string | null;
  issued_date?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  validity_status?: string;
  academic_year?: string | null;
  semester?: string | null;
  audiences?: string[];
  education_levels?: string[];
  study_modes?: string[];
  faculties?: string[];
  programs?: string[];
  campuses?: string[];
  cohorts?: string[];
  original_filename?: string | null;
  markdown_path?: string | null;
  markdown_sha256?: string | null;
  markdown_content?: string | null;
  markdown_generated_at?: string | null;
  parser_used?: string | null;
  review_status?: string;
}

export interface DocumentListOptions {
  search?: string;
  stage?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

const DOCUMENT_FIELDS =
  'id, title, description, version, is_active, validity, pipeline_stage, progress, file_path, created_by, created_at, updated_at, short_title, document_number, document_type, issuer, issuing_unit, signed_by, signed_date, issued_date, valid_from, valid_to, validity_status, academic_year, semester, audiences, education_levels, study_modes, faculties, programs, campuses, cohorts, original_filename, markdown_path, markdown_sha256, review_status';

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
      .select('id, document_id, chunk_index, page, page_start, page_end, tokens, content, chunk_type, heading_path, part, chapter, section, article, clause, point, semantic_topics, keywords, contains_ocr, ocr_confidence_min, issued_date, valid_from, valid_to, validity_status, metadata, created_at')
      .eq('document_id', documentId)
      .order('id', { ascending: true });
    if (error) throw new Error(`Không thể tải chunks: ${error.message}`);
    return data || [];
  },

  async getMarkdown(documentId: number) {
    const { data, error } = await getSupabaseAdmin()
      .from('documents')
      .select('id, title, document_number, markdown_content, markdown_sha256, markdown_path')
      .eq('id', documentId)
      .maybeSingle();
    if (error) throw new Error(`Không thể tải Markdown: ${error.message}`);
    return data;
  },
};
