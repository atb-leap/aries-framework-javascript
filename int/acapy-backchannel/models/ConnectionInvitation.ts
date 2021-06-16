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

export class ConnectionInvitation {
    /**
    * Message identifier
    */
    'id'?: string;
    /**
    * Message type
    */
    'type'?: string;
    /**
    * DID for connection invitation
    */
    'did'?: string;
    /**
    * Optional image URL for connection invitation
    */
    'imageUrl'?: string;
    /**
    * Optional label for connection
    */
    'label'?: string;
    /**
    * List of recipient keys
    */
    'recipientKeys'?: Array<string>;
    /**
    * List of routing keys
    */
    'routingKeys'?: Array<string>;
    /**
    * Service endpoint at which to reach this agent
    */
    'serviceEndpoint'?: string;

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "id",
            "baseName": "@id",
            "type": "string",
            "format": ""
        },
        {
            "name": "type",
            "baseName": "@type",
            "type": "string",
            "format": ""
        },
        {
            "name": "did",
            "baseName": "did",
            "type": "string",
            "format": ""
        },
        {
            "name": "imageUrl",
            "baseName": "imageUrl",
            "type": "string",
            "format": "url"
        },
        {
            "name": "label",
            "baseName": "label",
            "type": "string",
            "format": ""
        },
        {
            "name": "recipientKeys",
            "baseName": "recipientKeys",
            "type": "Array<string>",
            "format": ""
        },
        {
            "name": "routingKeys",
            "baseName": "routingKeys",
            "type": "Array<string>",
            "format": ""
        },
        {
            "name": "serviceEndpoint",
            "baseName": "serviceEndpoint",
            "type": "string",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return ConnectionInvitation.attributeTypeMap;
    }
    
    public constructor() {
    }
}

