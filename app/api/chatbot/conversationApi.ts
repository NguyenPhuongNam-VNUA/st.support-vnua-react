import apiClient from '@/lib/http/api-client';

const conversationApi = {
  getAll() {
    return apiClient.get('/api/admin/conversations');
  },
};

export default conversationApi;
