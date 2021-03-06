'use strict';

var et = require('elementtree');
var inflect = require('inflect');

var ElementTree = et.ElementTree;
var element = et.Element;
var subElement = et.SubElement;

var decamelize = function (str, sep) {
    return str.replace(/([a-z\d])([A-Z])/g, '$1' + (sep || '-') + '$2').toLowerCase();
};

/**
 * Instantiate a new EasyXml instance
 *
 * @param {Object} config
 * @constructor
 */
var EasyXml = function(config) {
    this.config = EasyXml.merge({
        singularizeChildren: true,
        allowAttributes: true,
        attributePrefix: '_',
        elementPrefix: '',
        rootElement: 'response',
        rootArray: 'items',
        dateFormat: 'ISO', // ISO = ISO8601, SQL = MySQL Timestamp, JS = (new Date).toString()
        manifest: false,
        unwrappedArrays: false,
        indent: 4,
        filterNulls: false,
        decamelize: false,
        decamelizeAttributes: false,
        decamelizeElements: false
    }, config);
};

/**
 * Merges two objects and returns the result
 *
 * @param {Object} obj1
 * @param {Object} obj2
 * @returns {Object} Properties from obj1 and obj2
 * @static
 */
EasyXml.merge = function(obj1, obj2) {
    var obj3 = {};

    for (var attr1 in obj1) {
        if (obj1.hasOwnProperty(attr1)) {
            obj3[attr1] = obj1[attr1];
        }
    }

    for (var attr2 in obj2) {
        if (obj2.hasOwnProperty(attr2)) {
            obj3[attr2] = obj2[attr2];
        }
    }

    return obj3;
};

/**
 * Pads a number so that it is two digits
 *
 * @param {Number} val
 * @returns {String}
 * @static
 */
EasyXml.zeroPadTen = function(val) {
    if (val < 10) {
        return "0" + val;
    }

    return val.toString();
};

/**
 * Should we bother parsing this child attribute
 * @param child
 * @returns {Boolean}
 */
EasyXml.isChildKeyParsed = function(child) {
    switch(typeof child) {
        case 'number':
        case 'string':
        case 'boolean':
            return false;
        default:
            // null, undefined, objects, functions
            return true;
    }
};

/**
 * Takes an object and returns an XML string
 *
 * @param {Object|Array} object
 * @param {String} [rootElementOverride]
 * @returns {String} XML Document
 */
EasyXml.prototype.render = function(object, rootElementOverride) {
    var root;

    if (rootElementOverride) {
        root = rootElementOverride;
    } else if (object instanceof Array) {
        root = this.config.rootArray;
    } else {
        root = this.config.rootElement;
    }

    var xml = element(root);

    this.parseChildElement(xml, object);

    return new ElementTree(xml).write({
        xml_declaration: this.config.manifest,
        indent: this.config.indent
    });
};

/**
 * Check if this item doesn't exist and if we should not render it
 *
 * @param child Attribute being checked
 * @returns {Boolean}
 */
EasyXml.prototype.filterNull = function(child) {
    return (child === null || child === undefined) && this.config.filterNulls === true;
};

/**
 * Checks to see if the given key should be rendered as an attribute
 *
 * @param {String} key
 * @returns {Boolean}
 */
EasyXml.prototype.isAttribute = function(key) {
    return this.config.allowAttributes && key[0] === this.config.attributePrefix;
};

/**
 * Takes an object and attaches it to the XML doc
 *
 * @param {Element} parentXmlNode
 * @param {Element} parentObjectNode
 * @retursive
 */

EasyXml.prototype.convertDate = function(val, key){

    if (this.config.dateFormat === 'ISO') {
        // ISO: YYYY-MM-DDTHH:MM:SS.mmmZ
        return val.toISOString();
    } else if (this.config.dateFormat === 'SQL') {
        // SQL: YYYY-MM-DD HH:MM:SS
        var yyyy    = val.getFullYear();
        var mm      = EasyXml.zeroPadTen(val.getMonth() + 1);
        var dd      = EasyXml.zeroPadTen(val.getDate());
        var hh      = EasyXml.zeroPadTen(val.getHours());
        var min     = EasyXml.zeroPadTen(val.getMinutes());
        var ss      = EasyXml.zeroPadTen(val.getSeconds());

        return [yyyy, '-', mm, '-', dd, ' ', hh, ':', min, ':', ss].join("");
    } else if (this.config.dateFormat === 'JS') {
        // JavaScript date format
        return val.toString();
    } else {
        throw new Error(key + "contained unknown_date_format");
    }
};

EasyXml.prototype.parseChildElement = function(parentXmlNode, parentObjectNode) {
    for (var key in parentObjectNode) {
        if (parentObjectNode.hasOwnProperty(key)) {

            var child = parentObjectNode[key];
            var el = null;

            if (child instanceof Date){
                child = this.convertDate(child, key)
            }

            if (this.config.elementPrefix){
                // if key starts with elementPrefix remove the prefix (handle it as an element), if only one symbol, treat it as an empty attribute
                if (key[0] === this.config.elementPrefix) {
                    key =  key.length > 1 ? key.substring(1) : this.config.attributePrefix;

                // otherwise handle it as an attribute
                } else if (typeof child !== 'object') {
                    key = this.config.attributePrefix + key;
                }
            }

            if (this.filterNull(child)) {
                // no element if we are skipping nulls and undefined
                continue;
            }

            if (this.config.decamelize || this.config.decamelizeAttributes || this.config.decamelizeElements){
                key = decamelize(key, (this.isAttribute(key) ? this.config.decamelizeAttributes : this.config.decamelizeElements) || this.config.decamelize)
            }

            if (!isNaN(key)) {
                key = inflect.singularize(this.config.rootArray);
            }

            if (!this.isAttribute(key)) {
                el = subElement(parentXmlNode, key);
            }

            if (child === null || child === undefined) {
                // allow for both null child and undefined child
                el.text = "";
            } else if (!this.config.singularizeChildren && typeof parentXmlNode === 'object' && typeof child === 'object') {
                for (var subkey in child) {
                    if (child.hasOwnProperty(subkey)) {
                        if (EasyXml.isChildKeyParsed(child[subkey])) {
                            this.parseChildElement(el, child[subkey]);
                        } else {
                            el = subElement(el, subkey);
                            el.text = child[subkey].toString();
                        }
                    }
                }
            } else if (this.isAttribute(key)) {
                if (typeof child !== 'object') {
                    if (key === this.config.attributePrefix) {
                        parentXmlNode.text = child;
                    } else {
                        parentXmlNode.set(key.substring(1), child);
                    }
                } else {
                    throw new Error(key + "contained non_string_attribute");
                }
            } else if (child instanceof Array) {
                // Array
                var subElementName = inflect.singularize(key);

                for (var key2 in child) {
                    if (child.hasOwnProperty(key2)) {
                        if (this.filterNull(child[key2])) {
                            continue;
                        }

                        // if unwrapped arrays, make new subelements on the parent.
                        var el2 = (this.config.unwrappedArrays === true) ? ((el) || subElement(parentXmlNode, key)) : (subElement(el, subElementName));

                        // Check type of child element
                        if (child.hasOwnProperty(key2) && EasyXml.isChildKeyParsed(child[key2])) {
                            this.parseChildElement(el2, child[key2]);
                        } else {
                            // Just add element directly without parsing
                            el2.text = child[key2].toString();
                        }

                        // if unwrapped arrays, the initial child element has been consumed:
                        if (this.config.unwrappedArrays === true) el = undefined;
                    }
                }
            } else if (typeof child === 'object') {
                // Object, go deeper
                this.parseChildElement(el, child);
            } else if (typeof child === 'number' || typeof child === 'boolean') {
                el.text = child.toString();
                /* istanbul ignore else */
            } else if (typeof child === 'string') {
                el.text = child;
            } else {
                throw new Error(key + " contained unknown_data_type: " + typeof child);
            }
        }
    }
};

module.exports = EasyXml;
