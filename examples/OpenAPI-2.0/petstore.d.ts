/* tslint:disable */
/*--------------------------------------------------------------------------------------------

*  This is an declarationsOnly mode example output of schema2ts
*  Original input is: https://raw.githubusercontent.com/OAI/OpenAPI-Specification/master/examples/v2.0/json/petstore.json
*
*  Generated by:
* 	    schema2ts 0.5.0-beta.5
* 	    Typescript ^2.6.0
*
*  See syntax error in this file?
*       We are working for these features that will break schema2ts, thanks for your waiting
*--------------------------------------------------------------------------------------------*/
import { AxiosInstance } from "axios";
export interface _Response<Status, Data> {
    data: Data;
    status: Status;
    statusText: string;
    headers: any;
    request?: any;
}
export declare const _: {
    lib: AxiosInstance;
    removeEmpty(obj: any): any;
    getPathParam(url: string, params: any): string;
    request(url: string, method: string, {query, body, path, headers, bodyType}: {
        query?: any;
        body?: any;
        path?: any;
        headers?: any;
        bodyType?: "json" | "form";
    }): Promise<{
        data: any;
        headers: any;
        request: any;
        status: any;
        statusText: string;
    }>;
};
export declare var listPets_url: string;
export declare var listPets_method: string;
export declare var createPets_url: string;
export declare var createPets_method: string;
export declare var showPetById_url: string;
export declare var showPetById_method: string;
export interface listPets_parameter_query {
    /** How many items to return at one time (max 100) */ "limit": number;
}
export interface Pet {
    "id": number;
    "name": string;
    "tag"?: string;
}
export declare type Pets = Pet[];
export interface Error {
    "code": number;
    "message": string;
}
/** List all pets */
export declare function listPets(query: listPets_parameter_query): Promise<_Response<200, Pets> | _Response<"default", Error>>;
/** Create a pet */
export declare function createPets(): Promise<_Response<"default", Error>>;
export interface showPetById_parameter_path {
    /** The id of the pet to retrieve */ "petId": string;
}
/** Info for a specific pet */
export declare function showPetById(path: showPetById_parameter_path): Promise<_Response<200, Pets> | _Response<"default", Error>>;
