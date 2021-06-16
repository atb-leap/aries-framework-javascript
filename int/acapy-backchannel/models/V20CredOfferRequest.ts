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

import { V20CredFilter } from './V20CredFilter';
import { V20CredPreview } from './V20CredPreview';
import { HttpFile } from '../http/http';

export class V20CredOfferRequest {
    /**
    * Whether to respond automatically to credential requests, creating and issuing requested credentials
    */
    'autoIssue'?: boolean;
    /**
    * Whether to remove the credential exchange record on completion (overrides --preserve-exchange-records configuration setting)
    */
    'autoRemove'?: boolean;
    /**
    * Human-readable comment
    */
    'comment'?: string;
    /**
    * Connection identifier
    */
    'connectionId': string;
    'credentialPreview': V20CredPreview;
    /**
    * Credential specification criteria by format
    */
    'filter': V20CredFilter;
    /**
    * Whether to trace event (default false)
    */
    'trace'?: boolean;

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "autoIssue",
            "baseName": "auto_issue",
            "type": "boolean",
            "format": ""
        },
        {
            "name": "autoRemove",
            "baseName": "auto_remove",
            "type": "boolean",
            "format": ""
        },
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
            "name": "credentialPreview",
            "baseName": "credential_preview",
            "type": "V20CredPreview",
            "format": ""
        },
        {
            "name": "filter",
            "baseName": "filter",
            "type": "V20CredFilter",
            "format": ""
        },
        {
            "name": "trace",
            "baseName": "trace",
            "type": "boolean",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return V20CredOfferRequest.attributeTypeMap;
    }
    
    public constructor() {
    }
}

