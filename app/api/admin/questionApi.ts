import axiosClientLaravel from '../axiosClientLaravel';
import axiosClientPython from '../axiosClientPython';

const questionApi = {
    getAll(params?: any) {
        const url = '/questions';
        return axiosClientLaravel.get(url, { params });
    },

    add(data: any) {
        const url = '/questions';
        return axiosClientLaravel.post(url, data);
    },

    getDetail(id: any) {
        const url = `/questions/${id}`;
        return axiosClientLaravel.get(url);
    },

    update(id: any, data: any) {
        const url = `/questions/${id}`;
        return axiosClientLaravel.put(url, data);
    },

    countInputTokens(data: any) {
        const url = '/count-tokens';
        return axiosClientPython.post(url, data);
    },

    getTop5() {
        const url = '/top-5-questions';
        return axiosClientLaravel.get(url);
    }
};

export default questionApi;
