// interface JSON {
//     /**
//      * Converts a JavaScript Object Notation (JSON) string into an object.
//      * @param text A valid JSON string.
//      * @param reviver A function that transforms the results. This function is called for each member of the object.
//      * If a member contains nested objects, the nested objects are transformed before the parent object is.
//      */
//     parse(text: string, reviver?: (this: any, key: string, value: any) => any): any;
//     /**
//      * Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
//      * @param value A JavaScript value, usually an object or array, to be converted.
//      * @param replacer A function that transforms the results.
//      * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
//      */
//     stringify(value: any, replacer?: (this: any, key: string, value: any) => any, space?: string | number): string;
//     /**
//      * Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
//      * @param value A JavaScript value, usually an object or array, to be converted.
//      * @param replacer An array of strings and numbers that acts as an approved list for selecting the object properties that will be stringified.
//      * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
//      */
//     stringify(value: any, replacer?: (number | string)[] | null, space?: string | number): string;
// }

type JSONKey = string;

type JSONValue = JSONPrimitive | JSONCompound | JSONSerializable;

type JSONPrimitive = string | number | boolean | null | undefined;

type JSONCompound = JSONArray | JSONObj;

type JSONArray = JSONValue[]

type JSONObj = {
    [key: JSONKey]: JSONValue;
};

type JSONSerializable = {
    toJSON: () => Exclude<JSONValue, JSONSerializable>;
};

type JSONCompatible<T> = unknown extends T ? never : {
    [P in keyof T]:
        T[P] extends JSONValue ? T[P] :
        T[P] extends NotAssignableToJSON ? never :
        JSONCompatible<T[P]>;
};

type NotAssignableToJSON =
    | bigint
    | symbol
    | Function

type JSONReplacer = (this: JSONValue, key: string, value: JSONValue) => JSONValue

type JSONReplacerArray = (number | string)[]

type JSONReviver<T> = (this: JSONObj | JSONArray, key: string, value: JSONValue) => T | JSONValue

interface tsJSON {
    parse<T>(
        text: string,
        reviver?: JSONReviver<T>
    ): T;
    stringify(
        value: JSONValue,
        replacer?: JSONReplacer,
        space?: string | number
    ): string;
    stringifyAny(
        value: any,
        replacerArray: JSONReplacerArray,
        space?: string | number
    ): string;
    isJSONPrimitive(
        value: JSONValue
    ): value is JSONPrimitive;
    isJSONCompound(
        value: JSONValue
    ): value is JSONCompound;
    isJSONArray(
        value: JSONValue
    ): value is JSONArray;
    isJSONObj(
        value: JSONValue
    ): value is JSONObj;
    isJSONSerializable(
        value: JSONValue
    ): value is JSONSerializable;
    toJSONValue<T>(
        value: JSONCompatible<T>
    ): JSONValue;
    toJSONKey(
        key: JSONValue
    ): JSONKey;
    readonly [Symbol.toStringTag]: string
};

const tsJSON: tsJSON = {
    parse: (text, reviver) => JSON.parse(text, reviver),
    stringify: (value, replacer, space) => JSON.stringify(value, replacer, space),
    stringifyAny: (value, replacerArray, space) => {
        const obj: JSONValue = {}
        for (const k of replacerArray) {
            obj[k] = value[k]
        }
        return tsJSON.stringify(obj, undefined, space)
    },
    isJSONPrimitive: (value): value is JSONPrimitive => (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === undefined ||
        value === null
    ),
    isJSONCompound: (value): value is JSONCompound => typeof value === "object",
    isJSONArray: (value): value is JSONArray => value instanceof Array,
    isJSONObj: (value): value is JSONObj => value instanceof Object && !((value as JSONSerializable).toJSON instanceof Function),
    isJSONSerializable: (value): value is JSONSerializable => (value as JSONSerializable).toJSON instanceof Function,
    toJSONValue: <T>(value: JSONCompatible<T>) => value,
    toJSONKey: (key) => typeof key === "string" ? key : tsJSON.stringify(key),
    [Symbol.toStringTag]: "tsJSON"
};

export default tsJSON
export {
    JSONKey,
    JSONValue, JSONPrimitive, JSONCompound, JSONArray, JSONObj, JSONSerializable,
    JSONCompatible, NotAssignableToJSON,
    JSONReplacer, JSONReplacerArray,
    JSONReviver,
    tsJSON
};