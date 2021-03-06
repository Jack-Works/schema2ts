/* tslint:disable */
/*--------------------------------------------------------------------------------------------

*  This is an declarationsOnly mode example output of schema2ts
*  Original input is: https://raw.githubusercontent.com/OAI/OpenAPI-Specification/master/examples/v2.0/yaml/uber.yaml
*
*  Generated by:
* 	    schema2ts 0.5.0
* 	    Typescript ^2.6.0
*
*  See syntax error in this file?
*       We are working for these features that will break schema2ts, thanks for your waiting
*--------------------------------------------------------------------------------------------*/
import { AxiosInstance } from "axios";
export interface _Response<Status, Data = any, ResponseHeader = any> {
    data: Data;
    status: Status;
    statusText: string;
    headers: ResponseHeader;
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
export declare var products_get_url: string;
export declare var products_get_method: string;
export declare var estimates_price_get_url: string;
export declare var estimates_price_get_method: string;
export declare var estimates_time_get_url: string;
export declare var estimates_time_get_method: string;
export declare var me_get_url: string;
export declare var me_get_method: string;
export declare var history_get_url: string;
export declare var history_get_method: string;
export interface products_get_parameter_query {
    /** Latitude component of location. */ "latitude": number;
    /** Longitude component of location. */ "longitude": number;
}
export interface Product {
    "product_id"?: string;
    "description"?: string;
    "display_name"?: string;
    "capacity"?: number;
    "image"?: string;
}
export interface Error {
    "code"?: number;
    "message"?: string;
    "fields"?: string;
}
/** @summary Product Types
@description The Products endpoint returns information about the Uber products offered at a given location. The response includes the display name and other details about each product, and lists the products in the proper display order.
 */
export declare function products_get(query: products_get_parameter_query): Promise<_Response<200, Product[]> | _Response<"default", Error>>;
export interface estimates_price_get_parameter_query {
    /** Latitude component of start location. */ "start_latitude": number;
    /** Longitude component of start location. */ "start_longitude": number;
    /** Latitude component of end location. */ "end_latitude": number;
    /** Longitude component of end location. */ "end_longitude": number;
}
export interface PriceEstimate {
    "product_id"?: string;
    "currency_code"?: string;
    "display_name"?: string;
    "estimate"?: string;
    "low_estimate"?: number;
    "high_estimate"?: number;
    "surge_multiplier"?: number;
}
/** @summary Price Estimates
@description The Price Estimates endpoint returns an estimated price range for each product offered at a given location. The price estimate is provided as a formatted string with the full price range and the localized currency symbol.<br><br>The response also includes low and high estimates, and the [ISO 4217](http://en.wikipedia.org/wiki/ISO_4217) currency code for situations requiring currency conversion. When surge is active for a particular product, its surge_multiplier will be greater than 1, but the price estimate already factors in this multiplier.
 */
export declare function estimates_price_get(query: estimates_price_get_parameter_query): Promise<_Response<200, PriceEstimate[]> | _Response<"default", Error>>;
export interface estimates_time_get_parameter_query {
    /** Latitude component of start location. */ "start_latitude": number;
    /** Longitude component of start location. */ "start_longitude": number;
    /** Unique customer identifier to be used for experience customization. */ "customer_uuid": string;
    /** Unique identifier representing a specific product for a given latitude & longitude. */ "product_id": string;
}
/** @summary Time Estimates
@description The Time Estimates endpoint returns ETAs for all products offered at a given location, with the responses expressed as integers in seconds. We recommend that this endpoint be called every minute to provide the most accurate, up-to-date ETAs.
 */
export declare function estimates_time_get(query: estimates_time_get_parameter_query): Promise<_Response<200, Product[]> | _Response<"default", Error>>;
export interface Profile {
    "first_name"?: string;
    "last_name"?: string;
    "email"?: string;
    "picture"?: string;
    "promo_code"?: string;
}
/** @summary User Profile
@description The User Profile endpoint returns information about the Uber user that has authorized with the application.
 */
export declare function me_get(): Promise<_Response<200, Profile> | _Response<"default", Error>>;
export interface history_get_parameter_query {
    /** Offset the list of returned results by this amount. Default is zero. */ "offset": number;
    /** Number of items to retrieve. Default is 5, maximum is 100. */ "limit": number;
}
export interface Activity {
    "uuid"?: string;
}
export interface Activities {
    "offset"?: number;
    "limit"?: number;
    "count"?: number;
    "history"?: Activity[];
}
/** @summary User Activity
@description The User Activity endpoint returns data about a user's lifetime activity with Uber. The response will include pickup locations and times, dropoff locations and times, the distance of past requests, and information about which products were requested.<br><br>The history array in the response will have a maximum length based on the limit parameter. The response value count may exceed limit, therefore subsequent API requests may be necessary.
 */
export declare function history_get(query: history_get_parameter_query): Promise<_Response<200, Activities> | _Response<"default", Error>>;
