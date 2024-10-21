import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Gate, { GateDim, GateData, isGateDim } from "gates/gate"

class Source extends Gate {
    constructor(name: "Source", inputDims: [], outputDims: GateDim[], inputLabels?: [], outputLabels?: string[]) {
        super("Source", [], outputDims, [], outputLabels);
    }

    static create(dims: GateDim[], labels?: string[]): Source {
        return new Source("Source", [], dims, [], labels);
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

    toJSON(this: Source): JSONValue {
        return {"/Source": [this._outputDims, this._outputLabels]};
    }

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`Source reviver: ${msg}`);
    }

    static reviver: JSONReviver<Source> = function(this, key, value) {
        if (tsJSON.isJSONObj(value) && value["/Source"] !== undefined) {
            const obj = value["/Source"];
            if (!tsJSON.isJSONArray(obj)) throw Source.JSONSyntaxError("expected an array as top level object");
            if (!tsJSON.isJSONArray(obj[0])) throw Source.JSONSyntaxError("expected an array as dimensions");
            if (!tsJSON.isJSONArray(obj[1])) throw Source.JSONSyntaxError("expected an array as labels");
            const dims: GateDim[] = [];
            for (const dim of obj[0]) {
                if (!isGateDim(dim)) throw Source.JSONSyntaxError("expected dimension to be an integer");
                dims.push(dim);
            }
            const labels: string[] = [];
            for (const label of obj[1]) {
                if (typeof label !== "string") throw Source.JSONSyntaxError("expected label to be a string");
                labels.push(label);
            }
            return Source.create(dims, labels);
        } else {
            return value;
        }
    }

    _duplicate(this: Source): Source {
        const outputDims: GateDim[] = tsJSON.parse(tsJSON.stringify(this._outputDims));
        const outputLabels: string[] = tsJSON.parse(tsJSON.stringify(this._outputLabels));
        return Source.create(outputDims, outputLabels);
    }

    get dims() {
        return this._outputDims;
    }
}

export default Source;