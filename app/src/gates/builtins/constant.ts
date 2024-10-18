import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Gate, { GateDim, GateDatum, isGateDatum} from "gates/gate"

class Constant extends Gate {
    _state: [GateDatum[]];

    constructor(dim: GateDim, state?: [GateDatum[]]) {
        super("Constant", [], [dim]);
        if (state === undefined) {
            this._state = [[]];
            this._resetState();
        } else {
            this._state = state;
        }
    }

    _resetState(this: Constant) {
        this._state = [new Array(this._outputDims[0]).fill(Gate.DEFAULT_VALUE)];
    }

    call(this: Constant, inputs: [], state?: null): [GateDatum[]] {
        return this._state;
    }

    toJSON(this: Constant): Exclude<JSONValue, JSONSerializable> {
        return {"/Constant": this._state[0]};
    }

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`Constant reviver: ${msg}`);
    }

    static reviver: JSONReviver<Constant> = function(this, key, value) {
        if (tsJSON.isJSONObj(value) && value["/Constant"] !== undefined) {
            const constantObj = value["/Constant"];
            if (!tsJSON.isJSONArray(constantObj)) throw Constant.JSONSyntaxError("expected an array as top level object");
            const state: GateDatum[] = []
            for (const s of constantObj) {
                if (!isGateDatum(s)) throw Constant.JSONSyntaxError("expected an integer or null in state array")
                state.push(s)
            }
            return new Constant(state.length, [state])
        } else {
            return value
        }
    }

    getState(this: Constant): [GateDatum[]] {
        return this._state;
    }

    setState(this: Constant, state: [GateDatum[]]): void {
        this._state = state;
    }

    _duplicate(this: Constant): Constant {
        return new Constant(
            this._outputDims[0],
            this._duplicateState(this._state)
        );
    }

    get dims() {
        return this._outputDims;
    }
}

export default Constant;