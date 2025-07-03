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

    embed(filePath) {
        const url = '/embed-doc'; // đường dẫn bên Python Flask API
        return axiosClientPython.post(url, {
            file_path: filePath
        });
    }
};

export default documentApi;
