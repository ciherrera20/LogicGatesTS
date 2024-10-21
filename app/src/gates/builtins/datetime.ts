import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Gate from "gates/gate"

class Datetime extends Gate {
    constructor() {
        super("Datetime", [], [64]);
    }

    static create(): Datetime {
        return new Datetime();
    }

    call(this: Datetime, inputs?: [], state?: null): number[][] {
        const seconds: number = Math.round(new Date().getTime() / 1000);
        const timestamp: number[] = (seconds >>> 0).toString(2).split("").map((x) => Number(x));
        const pad: number[] = new Array(64 - timestamp.length).fill(0);
        return [pad.concat(timestamp)]
    }

    toJSON(this: Datetime): JSONValue {
        return {"/Datetime": null};
    }

    _duplicate(this: Datetime): Datetime {
        return new Datetime();
    }

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`Datetime reviver: ${msg}`);
    }

    static reviver: JSONReviver<Datetime> = function(this, key, value) {
        if (tsJSON.isJSONObj(value) && value["/Datetime"] !== undefined) {
            const obj = value["/Datetime"];
            if (!tsJSON.isJSONArray(obj)) throw Datetime.JSONSyntaxError("expected null as top level object");
            return new Datetime();
        } else {
            return value;
        }
    }
}

export default Datetime;