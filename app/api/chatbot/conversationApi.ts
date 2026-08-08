import axiosClientLaravel from '../axiosClientLaravel';

const conversationApi = {
    getAll() {
        const url = '/user-question-logs';
        return axiosClientLaravel.get(url);
    }
};

export default conversationApi;
