import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Gate, { GateDim, GateData, isGateDim } from "gates/gate"

class Sink extends Gate {
    constructor(name: "Sink", inputDims: GateDim[], outputDims: [], inputLabels?: string[]) {
        super("Sink", inputDims, [], inputLabels);
    }

    static create(dims: GateDim[], labels?: string[]): Sink {
        return new Sink("Sink", dims, [], labels);
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

    toJSON(this: Sink): JSONValue {
        return {"/Sink": [this._inputDims, this._inputLabels]};
    }

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`Sink reviver: ${msg}`);
    }

    static reviver: JSONReviver<Sink> = function(this, key, value) {
        if (tsJSON.isJSONObj(value) && value["/Sink"] !== undefined) {
            const obj = value["/Sink"];
            if (!tsJSON.isJSONArray(obj)) throw Sink.JSONSyntaxError("expected an array as top level object");
            if (!tsJSON.isJSONArray(obj[0])) throw Sink.JSONSyntaxError("expected an array as dimensions");
            if (!tsJSON.isJSONArray(obj[1])) throw Sink.JSONSyntaxError("expected an array as labels");
            const dims: GateDim[] = []
            for (const dim of obj) {
                if (!isGateDim(dim)) throw Sink.JSONSyntaxError("expected dimension to be an integer");
                dims.push(dim);
            }
            const labels: string[] = [];
            for (const label of obj[1]) {
                if (typeof label !== "string") throw Source.JSONSyntaxError("expected label to be a string");
                labels.push(label);
            }
            return Sink.create(dims, labels);
        } else {
            return value
        }
    }

    _duplicate(this: Sink): Sink {
        return Sink.create(Array.from(this._inputDims), Array.from(this._inputLabels));
    }

    get dims() {
        return this._inputDims;
    }
}

export default Sink;