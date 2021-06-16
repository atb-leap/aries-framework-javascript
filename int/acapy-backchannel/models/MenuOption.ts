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

import { MenuForm } from './MenuForm';
import { HttpFile } from '../http/http';

export class MenuOption {
    /**
    * Additional descriptive text for menu option
    */
    'description'?: string;
    /**
    * Whether to show option as disabled
    */
    'disabled'?: boolean;
    'form'?: MenuForm;
    /**
    * Menu option name (unique identifier)
    */
    'name': string;
    /**
    * Menu option title
    */
    'title': string;

    static readonly discriminator: string | undefined = undefined;

    static readonly attributeTypeMap: Array<{name: string, baseName: string, type: string, format: string}> = [
        {
            "name": "description",
            "baseName": "description",
            "type": "string",
            "format": ""
        },
        {
            "name": "disabled",
            "baseName": "disabled",
            "type": "boolean",
            "format": ""
        },
        {
            "name": "form",
            "baseName": "form",
            "type": "MenuForm",
            "format": ""
        },
        {
            "name": "name",
            "baseName": "name",
            "type": "string",
            "format": ""
        },
        {
            "name": "title",
            "baseName": "title",
            "type": "string",
            "format": ""
        }    ];

    static getAttributeTypeMap() {
        return MenuOption.attributeTypeMap;
    }
    
    public constructor() {
    }
}

