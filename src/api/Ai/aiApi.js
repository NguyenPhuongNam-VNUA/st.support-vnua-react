import axiosClientPython from "../axiosClientPython"

const aiApi = {
    askAi(payload) {
        const url = '/ask';
        return axiosClientPython.post(url, payload);
    }
}

export default aiApi;