import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Gate, { GateDim, GateData, isGateDim } from "gates/gate"

class Sink extends Gate {
    constructor(dims: GateDim[]) {
        super("Sink", dims, []);
    }

    _initState(this: Sink): GateData {
        return this._initInputs();
    }

    call(this: Sink, inputs: GateData, state: GateData): [] {
        for (const [i, input] of inputs.entries()) {
            state[i] = input
        }
        return []
    }

    toJSON(this: Sink): Exclude<JSONValue, JSONSerializable> {
        return {"/Sink": this._inputDims};
    }

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`Sink reviver: ${msg}`);
    }

    static reviver: JSONReviver<Sink> = function(this, key, value) {
        if (tsJSON.isJSONObj(value) && value["/Sink"] !== undefined) {
            const sinkObj = value["/Sink"];
            if (!tsJSON.isJSONArray(sinkObj)) throw Sink.JSONSyntaxError("expected an array as top level object");
            const dims: GateDim[] = []
            for (const dim of sinkObj) {
                if (!isGateDim(dim)) throw Sink.JSONSyntaxError("expected dimension to be an integer")
                dims.push(dim)
            }
            return new Sink(dims)
        } else {
            return value
        }
    }

    _duplicate(this: Sink): Sink {
        return new Sink(this._inputDims)
    }

    get dims() {
        return this._inputDims;
    }
}

export default Sink;