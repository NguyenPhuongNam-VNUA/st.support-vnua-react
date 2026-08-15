import apiClient from '@/lib/http/api-client';

const aiApi = {
  askAi(data: unknown) {
    return apiClient.post('/api/chat', data);
  },
};

export default aiApi;
