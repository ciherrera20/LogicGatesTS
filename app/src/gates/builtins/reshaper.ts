import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Gate, { GateDim, GateDatum, GateData, isGateDim } from "gates/gate"

class Reshaper extends Gate {
    _size: number

    constructor(name: "Reshaper", inputDims: GateDim[], outputDims: GateDim[]) {
        const sum = (v: number, acc: number) => v + acc;
        const size = inputDims.reduce(sum, 0);
        if (size !== outputDims.reduce(sum, 0)) {
            throw new Error("Reshaper: mismatched input and output dimensions");
        }
        super("Reshaper", inputDims, outputDims);
        this._size = size;
    }

    static create(inputDims: GateDim[], outputDims: GateDim[]): Reshaper {
        return new Reshaper("Reshaper", inputDims, outputDims);
    }

    call(this: Reshaper, inputs: GateData, state?: null): GateData {
        let flattened: GateDatum[] = [];
        for (const [i, dim] of this._inputDims.entries()) {
            flattened = flattened.concat(inputs[i]);
        }
        if (flattened.length !== this._size) {
            throw new Error("Reshaper: invalid input size");
        }
        const outputs: GateData = []
        for (const dim of this._outputDims) {
            outputs.push(flattened.splice(0, dim));
        }
        return outputs;
    }

    toJSON(this: Reshaper): Exclude<JSONValue, JSONSerializable> {
        return {"/Reshaper": [this._inputDims, this._outputDims]};
    }

    _duplicate(this: Reshaper): Reshaper {
        return Reshaper.create(this._inputDims, this._outputDims);
    }

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`Reshaper reviver: ${msg}`);
    }

    static reviver: JSONReviver<Reshaper> = function(this, key, value) {
        if (tsJSON.isJSONObj(value) && value["/Reshaper"] !== undefined) {
            const reshaperObj = value["/Reshaper"];
            if (!tsJSON.isJSONArray(reshaperObj)) throw Reshaper.JSONSyntaxError("expected array as top level object");
            if (!tsJSON.isJSONArray(reshaperObj[0])) throw Reshaper.JSONSyntaxError("expected first element to be an array of input dimensions");
            if (!tsJSON.isJSONArray(reshaperObj[1])) throw Reshaper.JSONSyntaxError("expected second element to be an array of output dimensions");
            const inputDims: GateDim[] = [];
            for (const dim of reshaperObj[0]) {
                if (!isGateDim(dim)) throw DirectedGraph.JSONSyntaxError("expected input dimension to be an integer");
                inputDims.push(Number(dim));
            }
            const outputDims: GateDim[] = [];
            for (const dim of reshaperObj[1]) {
                if (!isGateDim(dim)) throw DirectedGraph.JSONSyntaxError("expected input dimension to be an integer");
                outputDims.push(Number(dim));
            }
            return Reshaper.create(inputDims, outputDims);
        } else {
            return value;
        }
    }
}

export default Reshaper;