import apiClient from '@/lib/http/api-client';

const questionsExcelApi = {
  upload(data: FormData) {
    return apiClient.post('/api/admin/questions/import', data);
  },
};

export default questionsExcelApi;
