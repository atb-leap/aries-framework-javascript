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

import { ConnRecord } from './ConnRecord';
import { HttpFile } from '../http/http';

export class ConnectionList {
    /**
    * List of connection records
    */
    'results': Array<ConnRecord>;

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "results",
            "baseName": "results",
            "type": "Array<ConnRecord>",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return ConnectionList.attributeTypeMap;
    }
    
    public constructor() {
    }
}

