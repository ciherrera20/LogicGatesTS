import tsJSON, { JSONValue, JSONArray, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Project from "gates/project";

type GateDim = number;
type GateDatum = number;
type GateData = (GateDatum[] | null)[];
type GateState = GateStateMap | GateData | null;
type GateStateMap = Map<GateUID, GateStateMapValue>;
type GateStateMapValue = [GateState, GateData | null];
// {
//     [key: GateUID]: [GateState, GateData]
// }
type GateUID = number;

abstract class Gate implements JSONSerializable {
    static DEFAULT_VALUE: number = 0;
    static BAD_VALUE: null = null;
    static EMPTY_DATA: number[][] = [];
    static _numGates: number = 0;
    _name: string;
    _inputDims: GateDim[];
    _outputDims: GateDim[];
    _inputLabels: string[];
    _outputLabels: string[];
    _uid: GateUID;

    constructor(name: string, inputDims: GateDim[], outputDims: GateDim[], inputLabels?: string[], outputLabels?: string[]) {
        this._name = name;
        this._inputDims = inputDims;
        this._outputDims = outputDims;
        this._inputLabels = inputLabels ? inputLabels : new Array(inputDims.length).fill("")
        this._outputLabels = outputLabels ? outputLabels : new Array(outputDims.length).fill("")

        // Assign a unique ID to each gate
        this._uid = Gate._numGates;
        Gate._numGates += 1;
    }

    _initInputs(this: Gate): GateData {
        const inputs: GateData = []
        for (const inputDim of this._inputDims) {
            inputs.push(new Array(inputDim).fill(Gate.DEFAULT_VALUE));
        }
        return inputs;
    }

    _initState(this: Gate): GateState {
        return null;
    }

    abstract call(this: Gate, inputs?: GateData, state?: GateState): GateData;

    abstract toJSON(this: Gate): JSONValue;

    stateToJSON(this: Gate, state: GateState): JSONValue {
        if (isGateStateMap(state)) throw new Error("Not implemented!");
        return state;
    }

    static reviver: JSONReviver<Gate>;

    static getReviver(this: typeof Gate): JSONReviver<Gate> {
        return this.reviver;
    }

    static reviveState(this: typeof Gate, obj: JSONValue, gates: Map<number, Gate>): GateState {
        return null;
    }

    abstract _duplicate(this: Gate): Gate;

    _duplicateState(this: Gate, state: GateState): GateState {
        if (isGateStateMap(state)) throw new Error("Not implemented!");
        return tsJSON.parse(tsJSON.stringify(state));
    }

    get name(): string {
        return this._name;
    }

    get uid(): number {
        return this._uid;
    }

    get inputDims(): GateDim[] {
        return this._inputDims;
    }

    get outputDims(): GateDim[] {
        return this._outputDims;
    }

    get inputLabels(): string[] {
        return this._inputLabels;
    }

    get outputLabels(): string[] {
        return this._outputLabels;
    }

    toString(this: Gate): string {
        let s = "";
        const inputs = this._initInputs();
        if (this._inputDims.length > 0) {
            const strInputs: string[] = [];
            for (const input of inputs) {
                if (input === null) {
                    strInputs.push("null");
                } else {
                    strInputs.push(input.join(""));
                }
            }
            s += `${strInputs.join(", ")} \u2192 `;
        }
        s += `${this.name}:${this.uid}`;
        if (this._outputDims.length > 0) {
            const outputs = this.call(inputs, this._initState())
            const strOutputs: string[] = [];
            for (const output of outputs) {
                if (output === null) {
                    strOutputs.push("null");
                } else {
                    strOutputs.push(output.join(""));
                }
            }
            s += ` \u2192 ${strOutputs.join(", ")}`;
        }
        return s;
    }

    static validateGateData(this: typeof Gate, obj: JSONArray, dims?: GateDim[], error?: Error): GateData {
        error = error === undefined ? new SyntaxError("gate data is invalid") : error;
        if (dims !== undefined && obj.length !== dims.length) throw error;
        const data: GateData = [];
        for (const [i, input] of obj.entries()) {
            if (typeof input === null) {
                data.push(null);
            } else if (tsJSON.isJSONArray(input)) {
                if (dims !== undefined && input.length !== dims[i]) throw error;
                data.push([]);
                for (const x of input) {
                    if (typeof x !== "number") throw error;
                    data[data.length - 1]!.push(x);
                }
            } else {
                throw error;
            }
        }
        return data;
    }
}

function isGateDim(value: any): value is GateDim {
    return Number.isInteger(Number(value));
}

function isGateDatum(value: any): value is GateDatum {
    return typeof value === "number";
}

function isGateData(value: GateState): value is GateData {
    return value instanceof Array;
}

function isGateStateMap(value: GateState): value is GateStateMap {
    return value instanceof Map;
}

export default Gate;
export { GateDim, GateDatum, GateData, GateState, GateStateMap, GateStateMapValue, GateUID, isGateDim, isGateDatum, isGateData, isGateStateMap };