import apiClient from '@/lib/http/api-client';

const settingsApi = {
  get() {
    return apiClient.get('/api/admin/settings');
  },
  update(data: unknown) {
    return apiClient.put('/api/admin/settings', data);
  },
  testModel(model: string) {
    return apiClient.post('/api/admin/settings/test', { model });
  },
};

export default settingsApi;
