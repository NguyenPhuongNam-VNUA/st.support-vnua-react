import apiClient from '@/lib/http/api-client';

const questionApi = {
  getAll(params?: Record<string, unknown>) {
    return apiClient.get('/api/admin/questions', { params });
  },
  add(data: unknown) {
    return apiClient.post('/api/admin/questions', data);
  },
  getDetail(id: number) {
    return apiClient.get(`/api/admin/questions/${id}`);
  },
  update(id: number, data: unknown) {
    return apiClient.patch(`/api/admin/questions/${id}`, data);
  },
  delete(id: number) {
    return apiClient.delete(`/api/admin/questions/${id}`);
  },
  bulkUpdate(ids: number[], status: string) {
    return apiClient.patch('/api/admin/questions/bulk', { ids, status });
  },
  bulkDelete(ids: number[]) {
    return apiClient.delete('/api/admin/questions/bulk', { data: { ids } });
  },
  getAudit(id: number) {
    return apiClient.get(`/api/admin/questions/${id}/audit`);
  },
  getTop5() {
    return apiClient.get('/api/admin/questions/top');
  },
};

export default questionApi;
