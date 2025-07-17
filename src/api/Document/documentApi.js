import axiosClientLaravel from '../axiosClientLaravel';
import axiosClientPython from '../axiosClientPython';

const documentApi = {
    getAll(params) {
        const url = '/documents'
        return axiosClientLaravel.get(url, { params });
    },

    add(data) {
        const url = '/documents';
        return axiosClientLaravel.post(url, data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    delete(id) {
        const url = `/documents/${id}`;
        return axiosClientLaravel.delete(url);
    },

    embed(filePath) {
        const url = '/embed-doc';
        return axiosClientPython.post(url, filePath);
    }
};

export default documentApi;
