import apiClient from '@/lib/http/api-client';

const notificationApi = {
  getAll() {
    return apiClient.get('/api/admin/notifications');
  },
};

export default notificationApi;
