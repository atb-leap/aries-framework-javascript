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

import { AttachDecorator } from './AttachDecorator';
import { HttpFile } from '../http/http';

export class DIDXRequest {
    /**
    * Message identifier
    */
    'id'?: string;
    /**
    * Message type
    */
    'type'?: string;
    /**
    * DID of exchange
    */
    'did'?: string;
    /**
    * As signed attachment, DID Doc associated with DID
    */
    'didDocattach'?: AttachDecorator;
    /**
    * Label for DID exchange request
    */
    'label': string;

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
            "name": "didDocattach",
            "baseName": "did_doc~attach",
            "type": "AttachDecorator",
            "format": ""
        },
        {
            "name": "label",
            "baseName": "label",
            "type": "string",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return DIDXRequest.attributeTypeMap;
    }
    
    public constructor() {
    }
}

