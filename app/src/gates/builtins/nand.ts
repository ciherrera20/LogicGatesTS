import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Gate, { GateDatum } from "gates/gate"

class Nand extends Gate {
    constructor() {
        super("NAND", [1, 1], [1]);
    }

    call(this: Nand, inputs: [[GateDatum], [GateDatum]], state?: null): [[GateDatum]] {
        if (typeof inputs[0][0] !== "number" || typeof inputs[1][0] !== "number") {
            return [[null]];
        } else {
            let bitmask: number = 1;  // Grab last bit only
            return [[~(inputs[0][0] & inputs[1][0]) & bitmask]];
        }
    }

    toJSON(this: Nand): Exclude<JSONValue, JSONSerializable> {
        return {"/NAND": null};
    }

    _duplicate(this: Nand): Nand {
        return new Nand();
    }

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`Nand reviver: ${msg}`);
    }

    static reviver: JSONReviver<Nand> = function(this, key, value) {
        if (tsJSON.isJSONObj(value) && value["/NAND"] !== undefined) {
            const nandObj = value["/NAND"];
            if (nandObj !== null) throw Nand.JSONSyntaxError("expected null as top level object");
            return new Nand();
        } else {
            return value;
        }
    }
}

export default Nand;