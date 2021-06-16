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

export class AdminMediationDeny {
    /**
    * List of mediator rules for recipient
    */
    'mediatorTerms'?: Array<string>;
    /**
    * List of recipient rules for mediation
    */
    'recipientTerms'?: Array<string>;

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "mediatorTerms",
            "baseName": "mediator_terms",
            "type": "Array<string>",
            "format": ""
        },
        {
            "name": "recipientTerms",
            "baseName": "recipient_terms",
            "type": "Array<string>",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return AdminMediationDeny.attributeTypeMap;
    }
    
    public constructor() {
    }
}

