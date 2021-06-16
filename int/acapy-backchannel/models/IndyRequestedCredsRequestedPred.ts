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

export class IndyRequestedCredsRequestedPred {
    /**
    * Wallet credential identifier (typically but not necessarily a UUID)
    */
    'credId': string;
    /**
    * Epoch timestamp of interest for non-revocation proof
    */
    'timestamp'?: number;

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "credId",
            "baseName": "cred_id",
            "type": "string",
            "format": ""
        },
        {
            "name": "timestamp",
            "baseName": "timestamp",
            "type": "number",
            "format": "int32"
        }    ];

    static getAttributeTypeMap() {
        return IndyRequestedCredsRequestedPred.attributeTypeMap;
    }
    
    public constructor() {
    }
}

