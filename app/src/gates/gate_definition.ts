import Gate, { GateDim, GateData, GateState, GateUID } from "gates/gate";
import Sink from "gates/builtins/sink";
import Source from "gates/builtins/source";
import DirectedGraph from "gates/utils/graph";
import tsJSON, { JSONSerializable } from "gates/utils/serialize";
import Project from "gates/project";

class CompoundGate extends Gate {
    _definition: GateDefinition;

    constructor(definition: GateDefinition) {
        this._definition = definition
        super();
    }
}

class GateDefinition implements JSONSerializable {
    static _numDefinitions: number = 0;

    _name:          string;
    _project:       Project;
    _numInputs:     number;
    _numOutputs:    number;
    _inputDims:     GateDim[];
    _outputDims:    GateDim[];
    _inputLabels:   string[];
    _outputLabels:  string[];

    // Maintain the internal connections between gates
    _graph:         DirectedGraph<GateUID>;                             // Gate UIDs are vertices and any connections are edges
    _gates:         Map<GateUID, Gate>;                                 // Gate UID -> gate
    _gateTypes:     Map<string, Set<GateUID>>;                          // Gate type -> set of gate uids
    _connections:   Map<GateUID, Map<GateUID, Set<[number, number]>>>;  // (from gate UID, to gate UID) -> set of (output index, input index)

    // Maintain the definition's state
    _state:         GateState;

    // Represents the input (source) and output (sink) to the overall gate
    _source:        Source;
    _sink:          Sink;

    // The order to evaluate the internal gates in
    _order:         GateUID[];                                          // A list of gate uids representing the evaluation order
    _cutGates:      Set<GateUID>;                                       // A set of gate uids corresponding to gates whose outputs should be saved
    _statefulGates: Set<GateUID>;                                       // A set of gate uids corresponding to gates that require a state to be saved
    _rootedGates:   Set<GateUID>;                                       // A set of gate uids corresponding to gates that connect to the sink
    _reorder:       boolean;                                            // Flag set whenever the graph representing the definition's internal structure changes
    // TODO: look into refactoring the directed graph code to update the order instead of recomputing it

    _instanceUids: Set<GateUID>;

    constructor(name: string, project: Project, inputDims: GateDim[], outputDims: GateDim[], inputLabels?: string[], outputLabels?: string[]) {
        this._name = name;
        this._project = project;
        this._inputDims = inputDims;
        this._outputDims = outputDims;
        this._numInputs = inputDims.length;
        this._numOutputs = outputDims.length;
        this._inputLabels = inputLabels ? inputLabels : new Array(this._numInputs).fill("")
        this._outputLabels = outputLabels ? outputLabels : new Array(this._numOutputs).fill("")
        this._graph = new DirectedGraph();
        this._gates = new Map();
        this._gateTypes = new Map();
        this._connections = new Map();
        this._state = {};
        this._source = new Source(this._inputDims);
        this._sink = new Sink(this._outputDims);
        this._order = [];
        this._cutGates = new Set();
        this._statefulGates = new Set();
        this._rootedGates = new Set();
        this._reorder = true;
        this._instanceUids = new Set();

        this.addGate(this._sink);
        this.addGate(this._source);
    }

    addGate(this: GateDefinition, gate: Gate, state?: GateState, outputs?: GateData) {
        if (this._gates.has(gate._uid)) {
            throw new Error(`${gate} is already in the definition`);
        }

        // Update dependency graph if necessary
        if (!this._gateTypes.has(gate._name)) {
            if (this._project._checkDependency(this._name, gate._name)) {
                throw new Error(`Recursive definition: ${gate._name} depends on ${this._name}`);
            }
        }
    }

    toJSON() {
        return undefined;
    }
}