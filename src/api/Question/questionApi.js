import axiosClientLaravel from '../axiosClientLaravel';
import axiosClientPython from '../axiosClientPython';

const questionApi = {
    getAll(params) {
        const url = '/questions';
        return axiosClientLaravel.get(url, { params });
    },

    getTop5() {
        const url = '/questions/top-questions';
        return axiosClientLaravel.get(url);
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
    },
    
    addNewQuestions(newQuestions) {
        const url = '/questions/excel';
        return axiosClientLaravel.post(url, newQuestions);
    },

    embedMany(questions) {
        const url = '/questions/embed-many';
        return axiosClientLaravel.post(url, { questions });
    },

    updateDuplicateQuestions(duplicateQuestions) {
        const url = '/questions/update-duplicates';
        return axiosClientLaravel.put(url, duplicateQuestions);
    },

    countInputTokens(text) {
        const url = '/countToken';
        return axiosClientPython.post(url, { text: text });
    },
};

export default questionApi;
