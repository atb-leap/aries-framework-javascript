/**
 * Aries Cloud Agent
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * OpenAPI spec version: v0.6.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { HttpFile } from '../http/http';

export class ClearPendingRevocationsRequest {
    /**
    * Credential revocation ids by revocation registry id: omit for all, specify null or empty list for all pending per revocation registry
    */
    'purge'?: { [key: string]: Array<string>; };

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "purge",
            "baseName": "purge",
            "type": "{ [key: string]: Array<string>; }",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return ClearPendingRevocationsRequest.attributeTypeMap;
    }
    
    public constructor() {
    }
}

