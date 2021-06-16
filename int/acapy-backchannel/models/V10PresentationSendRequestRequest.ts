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

import { IndyProofRequest } from './IndyProofRequest';
import { HttpFile } from '../http/http';

export class V10PresentationSendRequestRequest {
    'comment'?: string;
    /**
    * Connection identifier
    */
    'connectionId': string;
    'proofRequest': IndyProofRequest;
    /**
    * Whether to trace event (default false)
    */
    'trace'?: boolean;

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "comment",
            "baseName": "comment",
            "type": "string",
            "format": ""
        },
        {
            "name": "connectionId",
            "baseName": "connection_id",
            "type": "string",
            "format": "uuid"
        },
        {
            "name": "proofRequest",
            "baseName": "proof_request",
            "type": "IndyProofRequest",
            "format": ""
        },
        {
            "name": "trace",
            "baseName": "trace",
            "type": "boolean",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return V10PresentationSendRequestRequest.attributeTypeMap;
    }
    
    public constructor() {
    }
}

