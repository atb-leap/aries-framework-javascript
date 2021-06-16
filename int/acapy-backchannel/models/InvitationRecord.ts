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

export class InvitationRecord {
    /**
    * Time of record creation
    */
    'createdAt'?: string;
    /**
    * Invitation message identifier
    */
    'inviMsgId'?: string;
    /**
    * Out of band invitation object
    */
    'invitation'?: any;
    /**
    * Invitation record identifier
    */
    'invitationId'?: string;
    /**
    * Invitation message URL
    */
    'invitationUrl'?: string;
    /**
    * Out of band message exchange state
    */
    'state'?: string;
    /**
    * Record trace information, based on agent configuration
    */
    'trace'?: boolean;
    /**
    * Time of last record update
    */
    'updatedAt'?: string;

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "createdAt",
            "baseName": "created_at",
            "type": "string",
            "format": ""
        },
        {
            "name": "inviMsgId",
            "baseName": "invi_msg_id",
            "type": "string",
            "format": ""
        },
        {
            "name": "invitation",
            "baseName": "invitation",
            "type": "any",
            "format": ""
        },
        {
            "name": "invitationId",
            "baseName": "invitation_id",
            "type": "string",
            "format": ""
        },
        {
            "name": "invitationUrl",
            "baseName": "invitation_url",
            "type": "string",
            "format": ""
        },
        {
            "name": "state",
            "baseName": "state",
            "type": "string",
            "format": ""
        },
        {
            "name": "trace",
            "baseName": "trace",
            "type": "boolean",
            "format": ""
        },
        {
            "name": "updatedAt",
            "baseName": "updated_at",
            "type": "string",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return InvitationRecord.attributeTypeMap;
    }
    
    public constructor() {
    }
}

