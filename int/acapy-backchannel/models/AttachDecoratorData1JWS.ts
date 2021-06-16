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

import { AttachDecoratorDataJWSHeader } from './AttachDecoratorDataJWSHeader';
import { HttpFile } from '../http/http';

export class AttachDecoratorData1JWS {
    'header': AttachDecoratorDataJWSHeader;
    /**
    * protected JWS header
    */
    '_protected'?: string;
    /**
    * signature
    */
    'signature': string;

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "header",
            "baseName": "header",
            "type": "AttachDecoratorDataJWSHeader",
            "format": ""
        },
        {
            "name": "_protected",
            "baseName": "protected",
            "type": "string",
            "format": ""
        },
        {
            "name": "signature",
            "baseName": "signature",
            "type": "string",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return AttachDecoratorData1JWS.attributeTypeMap;
    }
    
    public constructor() {
    }
}

