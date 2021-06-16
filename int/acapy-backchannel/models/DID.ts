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

export class DID {
    /**
    * DID of interest
    */
    'did': string;
    /**
    * Whether DID is current public DID, posted to ledger but not current public DID, or local to the wallet
    */
    'posture': DIDPostureEnum;
    /**
    * Public verification key
    */
    'verkey': string;

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "did",
            "baseName": "did",
            "type": "string",
            "format": ""
        },
        {
            "name": "posture",
            "baseName": "posture",
            "type": "DIDPostureEnum",
            "format": ""
        },
        {
            "name": "verkey",
            "baseName": "verkey",
            "type": "string",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return DID.attributeTypeMap;
    }
    
    public constructor() {
    }
}


export type DIDPostureEnum = "public" | "posted" | "wallet_only" ;

