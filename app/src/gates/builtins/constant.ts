import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Gate, { GateDim, GateDatum, isGateDatum, GateState} from "gates/gate"

class Constant extends Gate {
    _state: [GateDatum[]];

    constructor(name: "Constant", inputDims: [], outputDims: [GateDim]) {
        super("Constant", [], outputDims);
        this._state = [[]];
        this._resetState();
    }

    static create(dim: GateDim, state?: [GateDatum[]]): Constant {
        const constant = new Constant("Constant", [], [dim]);
        if (state !== undefined) {
            constant.setState(state);
        }
        return constant;
    }

    _resetState(this: Constant) {
        this._state = [new Array(this._outputDims[0]).fill(Gate.DEFAULT_VALUE)];
    }

    call(this: Constant, inputs: [], state?: null): [GateDatum[]] {
        return this._state;
    }

    toJSON(this: Constant): JSONValue {
        return {"/Constant": this._state[0]};
    }

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`Constant reviver: ${msg}`);
    }

    static reviver: JSONReviver<Constant> = function(this, key, value) {
        if (tsJSON.isJSONObj(value) && value["/Constant"] !== undefined) {
            const obj = value["/Constant"];
            if (!tsJSON.isJSONArray(obj)) throw Constant.JSONSyntaxError("expected an array as top level object");
            const state: GateDatum[] = []
            for (const s of obj) {
                if (!isGateDatum(s)) throw Constant.JSONSyntaxError("expected an integer or null in state array")
                state.push(s)
            }
            return Constant.create(state.length, [state])
        } else {
            return value
        }
    }

    static reviveState(obj: JSONValue, gates: Map<number, Gate>): [GateDatum[]] {
        if (!tsJSON.isJSONArray(obj)) throw Constant.JSONSyntaxError("expected array as state");
        const state = Gate.validateGateData(obj);
        if (state.length === 0 || state[0] === null) throw Constant.JSONSyntaxError("expected a single, non null array as state");
        return state as [GateDatum[]];
    }

    getState(this: Constant): [GateDatum[]] {
        return this._state;
    }

    setState(this: Constant, state: [GateDatum[]]): void {
        this._state = state;
    }

    _duplicate(this: Constant): Constant {
        return Constant.create(
            this._outputDims[0],
            this._duplicateState(this._state)
        );
    }

    _duplicateState(this: Gate, state: [GateDatum[]]): [GateDatum[]] {
        return tsJSON.parse(tsJSON.stringify(state));
    }

    get dims() {
        return this._outputDims;
    }
}

export default Constant;