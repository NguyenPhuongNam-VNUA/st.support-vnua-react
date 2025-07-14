import axiosClientLaravel from "../axiosClientLaravel";

const loginApi = {
    login(data) {
        const url = '/login';
        return axiosClientLaravel.post(url, data);
    },

    logout() {
        const url = '/logout';
        return axiosClientLaravel.post(url);
    },

    getUser() {
        const url = '/user';
        return axiosClientLaravel.get(url);
    }
};
export default loginApi;