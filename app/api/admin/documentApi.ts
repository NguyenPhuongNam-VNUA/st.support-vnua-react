import apiClient from '@/lib/http/api-client';

const documentApi = {
  getAll(params?: Record<string, unknown>) {
    return apiClient.get('/api/admin/documents', { params });
  },
  add(data: FormData) {
    return apiClient.post('/api/admin/documents', data);
  },
  update(id: number, data: unknown) {
    return apiClient.patch(`/api/admin/documents/${id}`, data);
  },
  delete(id: number) {
    return apiClient.delete(`/api/admin/documents/${id}`);
  },
  getFileUrl(id: number) {
    return apiClient.get(`/api/admin/documents/${id}/file`);
  },
  getChunks(id: number) {
    return apiClient.get(`/api/admin/documents/${id}/chunks`);
  },
  embed(id: number) {
    return apiClient.post(`/api/admin/documents/${id}/embed`);
  },
};

export default documentApi;
