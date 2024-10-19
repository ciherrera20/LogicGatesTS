import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";

type GateDim = number;
type GateDatum = number | null;
type GateData = GateDatum[][];
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

    abstract toJSON(this: Gate): Exclude<JSONValue, JSONSerializable>;

    static reviver: JSONReviver<Gate>;

    abstract _duplicate(this: Gate): Gate;

    _duplicateState(this: Gate, state: GateState) {
        return JSON.parse(JSON.stringify(state));
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
            for (let i = 0; i < inputs.length; ++i) {
                const [dim, input] = [this._inputDims[i], inputs[i]];
                strInputs.push(input.join(""));
            }
            s += `${strInputs.join(", ")} \u2192 `;
        }
        s += this.name;
        if (this._outputDims.length > 0) {
            const outputs = this.call(inputs, this._initState())
            const strOutputs: string[] = [];
            for (let i = 0; i < outputs.length; ++i) {
                const [dim, output] = [this._outputDims[i], outputs[i]];
                strOutputs.push(output.join(""));
            }
            s += ` \u2192 ${strOutputs.join(", ")}`;
        }
        return s;
    }
}

function isGateDim(value: any): value is GateDim {
    return Number.isInteger(Number(value));
}

function isGateDatum(value: any): value is GateDatum {
    return typeof value === "number" || value === null;
}

function isGateData(value: GateState): value is GateData {
    return value instanceof Array;
}

function isGateStateMap(value: GateState): value is GateStateMap {
    return value instanceof Map;
}

export default Gate;
export { GateDim, GateDatum, GateData, GateState, GateStateMap, GateStateMapValue, GateUID, isGateDim, isGateDatum, isGateData, isGateStateMap };