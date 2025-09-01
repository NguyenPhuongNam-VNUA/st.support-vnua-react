import axiosClientLaravel from "../axiosClientLaravel";

const conversationApi = {
    getAll() {
        const url = '/conversations';
        return axiosClientLaravel.get(url);
    },
};

export default conversationApi;