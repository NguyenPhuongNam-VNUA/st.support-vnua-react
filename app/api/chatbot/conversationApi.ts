import apiClient from '@/lib/http/api-client';

const conversationApi = {
  /** from/to are ISO strings; omitted = newest logs regardless of date. */
  getAll(params?: { from?: string; to?: string; limit?: number }) {
    return apiClient.get('/api/admin/conversations', { params });
  },
};

export default conversationApi;
