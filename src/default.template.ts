/* tslint:disable */
import axios, { AxiosInstance, AxiosPromise } from "axios";
export interface _Response<Status, Data = any, ResponseHeader = any> {
    data: Data;
    status: Status;
    statusText: string;
    headers: ResponseHeader;
    request?: any;
}
export const _ = {
    lib: axios.create({ withCredentials: true }),
    removeEmpty(obj: any) {
        const cloned = { ...obj };
        for (const i in cloned) {
            if (cloned[i] === undefined) {
                delete cloned[i];
            }
        }
        return obj;
    },
    getPathParam(url: string, params: any) {
        const data = _.removeEmpty(params);
        for (const key in data) {
            const obj = data[key];
            url = url.replace(`{${key}}`, obj.toString());
        }
        return url;
    },
    async request(url: string, method: string, { query = {}, body = {}, path = {}, headers = {}, bodyType = {}, }: {
            query?: any;
            body?: any;
            path?: any;
            headers?: any;
            bodyType?: "json" | "form";
        }) {
        headers = { ...headers };
        if (!headers["Content-Type"] && bodyType === "form") {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
        const request = await _.lib.request({
            method,
            url: _.getPathParam(url, path),
            params: _.removeEmpty(query),
            data: _.removeEmpty(body),
            headers,
        });
        return {
            data: request.data,
            headers: request.headers,
            request: request.request,
            status: request.status as any,
            statusText: request.statusText,
        };
    },
};
