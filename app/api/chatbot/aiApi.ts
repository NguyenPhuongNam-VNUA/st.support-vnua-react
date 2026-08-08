import axiosClientPython from '../axiosClientPython';

const aiApi = {
    askAi(data: any) {
        const url = '/ask-ai';
        return axiosClientPython.post(url, data);
    }
};

export default aiApi;
