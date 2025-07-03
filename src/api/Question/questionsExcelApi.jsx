import axiosClientPython from "../axiosClientPython";

const questionsExcelApi = {
    checkData(questions) {
        const url = '/check-excel';
        return axiosClientPython.post(url, questions);
    },
}

export default questionsExcelApi;