import axiosClientLaravel from '../axiosClientLaravel';

const questionApi = {
    getAll(params) {
        const url = '/questions';
        return axiosClientLaravel.get(url, { params });
    },

    get(id) {
        const url = `/questions/${id}`;
        return axiosClientLaravel.get(url);
    },

    add(data) {
        const url = '/questions';
        return axiosClientLaravel.post(url, data);
    },

    update(data) {
        const url = `/questions/${data.id}`;
        return axiosClientLaravel.patch(url, data);
    },

    remove(id) {
        const url = `/questions/${id}`;
        return axiosClientLaravel.delete(url);
    },

    removeMany(ids) {
        const url = `/questions`;
        return axiosClientLaravel.delete(url, { data: { ids } });
      }      
};

export default questionApi;
