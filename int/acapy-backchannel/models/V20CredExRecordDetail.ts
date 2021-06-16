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

import { V20CredExRecord } from './V20CredExRecord';
import { V20CredExRecordDIF } from './V20CredExRecordDIF';
import { V20CredExRecordIndy } from './V20CredExRecordIndy';
import { HttpFile } from '../http/http';

export class V20CredExRecordDetail {
    /**
    * Credential exchange record
    */
    'credExRecord'?: V20CredExRecord;
    'dif'?: V20CredExRecordDIF;
    'indy'?: V20CredExRecordIndy;

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "credExRecord",
            "baseName": "cred_ex_record",
            "type": "V20CredExRecord",
            "format": ""
        },
        {
            "name": "dif",
            "baseName": "dif",
            "type": "V20CredExRecordDIF",
            "format": ""
        },
        {
            "name": "indy",
            "baseName": "indy",
            "type": "V20CredExRecordIndy",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return V20CredExRecordDetail.attributeTypeMap;
    }
    
    public constructor() {
    }
}

