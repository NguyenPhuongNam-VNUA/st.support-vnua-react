import apiClient from '@/lib/http/api-client';

const trainingApi = {
  getFallbacks(params?: { limit?: number; from?: string; to?: string }) {
    return apiClient.get('/api/admin/training/fallbacks', { params });
  },
};

export default trainingApi;
