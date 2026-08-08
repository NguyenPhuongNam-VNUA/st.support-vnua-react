import axiosClientLaravel from '../axiosClientLaravel';

const loginApi = {
    login(data: any) {
        const url = '/login';
        return axiosClientLaravel.post(url, data);
    },

    getUser() {
        const url = '/user';
        return axiosClientLaravel.get(url);
    }
};

export default loginApi;
