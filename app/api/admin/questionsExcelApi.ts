import axiosClientLaravel from '../axiosClientLaravel';

const questionsExcelApi = {
    upload(data: any) {
        const url = '/questions/import-excel';
        return axiosClientLaravel.post(url, data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
};

export default questionsExcelApi;
