import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Gate, { GateDim, GateData, isGateDim } from "gates/gate"

class Source extends Gate {
    constructor(dims: GateDim[]) {
        super("Source", [], dims);
    }

    _initState(this: Source): GateData {
        const state: GateData = [];
        for (const dim of this._outputDims) {
            state.push(new Array(dim).fill(Gate.DEFAULT_VALUE));
        }
        return state;
    }

    call(this: Source, inputs: [], state: GateData | null): GateData {
        if (state === null) {
            state = []
            for (const dim of this._outputDims) {
                state.push(new Array(dim).fill(null))
            }
        }
        return state;
    }

    toJSON(this: Source): Exclude<JSONValue, JSONSerializable> {
        return {"/Source": this._outputDims};
    }

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`Source reviver: ${msg}`);
    }

    static reviver: JSONReviver<Source> = function(this, key, value) {
        if (tsJSON.isJSONObj(value) && value["/Source"] !== undefined) {
            const sourceObj = value["/Source"];
            if (!tsJSON.isJSONArray(sourceObj)) throw Source.JSONSyntaxError("expected an array as top level object");
            const dims: GateDim[] = [];
            for (const dim of sourceObj) {
                if (!isGateDim(dim)) throw Source.JSONSyntaxError("expected dimension to be an integer");
                dims.push(dim);
            }
            return new Source(dims);
        } else {
            return value;
        }
    }

    _duplicate(this: Source): Source {
        return new Source(this._outputDims);
    }

    get dims() {
        return this._outputDims;
    }
}

export default Source;