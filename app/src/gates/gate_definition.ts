import Gate, { GateDim, GateDatum, GateData, GateState, GateStateMap, GateStateMapValue, GateUID, isGateDim, isGateData, isGateStateMap } from "gates/gate";
import Sink from "gates/builtins/sink";
import Source from "gates/builtins/source";
import DirectedGraph from "gates/utils/graph";
import tsJSON, { JSONValue, JSONArray, JSONObj, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Project from "gates/project";

class CompoundGate extends Gate {
    _definition: GateDefinition;

    constructor(name: "CompoundGate", inputDims: GateDim[], outputDims: GateDim[], inputLabels: string[], outputLabels: string[], definition: GateDefinition) {
        // TODO: Check whether copies are needed here
        super("CompoundGate", definition.inputDims, definition.outputDims, definition.inputLabels, definition.outputLabels);
        this._definition = definition
    }

    static create(definition: GateDefinition) {
        return new CompoundGate("CompoundGate", definition._inputDims, definition._outputDims, definition._inputLabels, definition._outputLabels, definition);
    }

    _initState(this: CompoundGate): GateStateMap | null {
        return this._definition._initState();
    }

    call(this: CompoundGate, inputs?: GateData, state?: GateStateMap | null): GateData {
        if (inputs === undefined) {
            if (this.inputDims.length !== 0) {
                throw new Error("invalid number of inputs");
            } else {
                return this._definition._processState([], state);
            }
        } else {
            return this._definition._processState(inputs, state);
        }
    }

    toJSON(this: CompoundGate): JSONValue {
        const obj: JSONObj = {};
        obj[`/${this.name}`] = null;
        return obj;
    }

    stateToJSON(this: CompoundGate, state: GateStateMap | null): JSONValue {
        return this._definition.stateToJSON(state);
    }

    // static JSONSyntaxError(msg: string): SyntaxError {
    //     return new SyntaxError(`CompoundGate reviver: ${msg}`);
    // }

    // static getReviver(project: Project): JSONReviver<CompoundGate> {
    //     const reviver: JSONReviver<CompoundGate> = function(this, key, value) {
    //         if (tsJSON.isJSONObj(value) && value["/CompoundGate"] !== undefined) {
    //             const obj = value["/CompoundGate"];
    //             if (typeof obj !== "string") throw CompoundGate.JSONSyntaxError("expected string as top level object");
    //             const definition = project.get(obj)!;
    //             if (Project.isBuiltin(definition)) throw CompoundGate.JSONSyntaxError("expected non builtin gate as type");
    //             return CompoundGate.create(definition);
    //         }
    //     }
    //     return reviver;
    // }

    _duplicate(this: CompoundGate): CompoundGate {
        return CompoundGate.create(this._definition);
    }

    get name(): string {
        return this._definition.name;
    }
}

type FromPair = [Gate, number];
type ToPair = [number, Gate];

class ConnectionMap {
    _cmap: Map<GateUID, Map<GateUID, Map<number, Set<number>>>>;
    constructor() {
        this._cmap = new Map();
    }

    has(this: ConnectionMap, key: [GateUID, GateUID], elem?: [number, number]): boolean {
        const [fromGateUid, toGateUid] = key;
        if (elem === undefined) {
            return this._cmap.get(fromGateUid)?.has(toGateUid) ? true : false;
        } else {
            const [fromGateIdx, toGateIdx] = elem;
            return this._cmap.get(fromGateUid)?.get(toGateUid)?.get(fromGateIdx)?.has(toGateIdx) ? true : false;
        }
    }

    add(this: ConnectionMap, key: [GateUID, GateUID], elem: [number, number]): ConnectionMap {
        const [fromGateUid, toGateUid] = key;
        const [fromIdx, toIdx] = elem;
        const m1 = this._cmap;
        if (!m1.has(fromGateUid)) {
            m1.set(fromGateUid, new Map());
        }
        const m2 = m1.get(fromGateUid)!;
        if (!m2.has(toGateUid)) {
            m2.set(toGateUid, new Map());
        }
        const m3 = m2.get(toGateUid)!;
        if (!m3.has(fromIdx)) {
            m3.set(fromIdx, new Set());
        }
        const s = m3.get(fromIdx)!;
        s.add(toIdx);
        return this;
    }

    get(this: ConnectionMap, key: [GateUID, GateUID]): Generator<[number, number], void, unknown> | undefined {
        if (this.has(key)) {
            const [fromGateUid, toGateUid] = key;
            const m3 = this._cmap.get(fromGateUid)!.get(toGateUid)!;
            function* gen() {
                for (const [fromIdx, s] of m3.entries()) {
                    for (const toIdx of s) {
                        yield [fromIdx, toIdx] as [number, number];
                    }
                }
            }
            return gen()
        }
    }

    delete(this: ConnectionMap, key: [GateUID, GateUID], elem?: [number, number]): boolean {
        if (elem === undefined) {
            if (!this.has(key)) {
                return false;
            }
            for (const elem of this.get(key)!) {
                this.delete(key, elem);
            }
            return true;
        } else {
            if (!this.has(key, elem)) {
                return false;
            }
            const [fromGateUid, toGateUid] = key;
            const [fromGateIdx, toGateIdx] = elem;
            const m1 = this._cmap;
            const m2 = m1.get(fromGateUid)!;
            const m3 = m2.get(toGateUid)!;
            const s = m3.get(fromGateIdx)!;
            s.delete(toGateIdx);
            if (m3.size === 0) {
                m2.delete(toGateUid);
            }
            if (m2.size === 0) {
                m1.delete(fromGateUid);
            }
            return true;
        }
    }

    *[Symbol.iterator](this: ConnectionMap): Generator<[[GateUID, GateUID], Generator<[number, number], void, unknown>]> {
        for (const [fromGateUid, m2] of this._cmap) {
            for (const toGateUid of m2.keys()) {
                const gen = this.get([fromGateUid, toGateUid]);
                if (gen !== undefined) {
                    yield [[fromGateUid, toGateUid] as [number, number], gen];
                } else {
                    throw new Error("Generator is undefined. I didn't think this code could be reached");
                }
            }
        }
    }
}

let x = new Map<number, number>()[Symbol.iterator]()
let y: MapIterator<number>;

// function get(cmap, ): [number, number] {

// }

class GateDefinition implements JSONSerializable {
    _name:          string;
    _project:       Project;
    _inputDims:     GateDim[];
    _outputDims:    GateDim[];
    _inputLabels:   string[];
    _outputLabels:  string[];

    // Maintain the internal connections between gates
    _graph:         DirectedGraph<GateUID>;     // Gate UIDs are vertices and any connections are edges
    _gates:         Map<GateUID, Gate>;         // Gate UID -> gate
    _gateTypes:     Map<string, Set<GateUID>>;  // Gate type -> set of gate uids
    _connections:   ConnectionMap;              // (from gate UID, to gate UID) -> set of (output index, input index)

    // Maintain the definition's state
    _state:         {
                        inputs: GateData,
                        gates: GateStateMap,
                        outputs: GateData
                    };

    // Represents the input (source) and output (sink) to the overall gate
    _source:        Source;
    _sink:          Sink;

    // The order to evaluate the internal gates in
    _order:         GateUID[];                  // A list of gate uids representing the evaluation order
    _cutGates:      Set<GateUID>;               // A set of gate uids corresponding to gates whose outputs should be saved
    _statefulGates: Set<GateUID>;               // A set of gate uids corresponding to gates that require a state to be saved
    _rootedGates:   Set<GateUID>;               // A set of gate uids corresponding to gates that connect to the sink
    _reorder:       boolean;                    // Flag set whenever the graph representing the definition's internal structure changes
    // TODO: look into refactoring the directed graph code to update the order instead of recomputing it

    _instanceUids: Set<GateUID>;                // Keep track of the gate instances made from this definition

    constructor(name: string, project: Project, inputDims: GateDim[], outputDims: GateDim[], inputLabels?: string[], outputLabels?: string[]) {
        this._name = name;
        this._project = project;
        this._inputDims = inputDims;
        this._outputDims = outputDims;
        this._inputLabels = inputLabels ? inputLabels : new Array(this.numInputs).fill("")
        this._outputLabels = outputLabels ? outputLabels : new Array(this.numOutputs).fill("")
        this._graph = new DirectedGraph();
        this._gates = new Map();
        this._gateTypes = new Map();
        this._connections = new ConnectionMap();
        this._state = {"inputs": [], "gates": new Map(), "outputs": []};
        this._source = Source.create(this._inputDims, this._inputLabels);
        this._sink = Sink.create(this._outputDims, this._outputLabels);
        this._order = [];
        this._cutGates = new Set();
        this._statefulGates = new Set();
        this._rootedGates = new Set();
        this._reorder = true;
        this._instanceUids = new Set();

        this.addGate(this._source);
        this.addGate(this._sink);
    }

    /**
     * Test whether a given gate (or gate uid) is an instance of this definition
     * 
     * @param gate  The gate or gate uid
     * @returns     Boolean result
     */
    isInstance(this: GateDefinition, gate: Gate | GateUID) {
        if (gate instanceof Gate) {
            return this._instanceUids.has(gate.uid);
        } else {
            return this._instanceUids.has(gate);
        }
    }

    /**
     * Add a gate to the definition
     * 
     * @param gate
     * @param state
     * @param outputs
     */
    addGate(this: GateDefinition, gate: Gate, state?: GateState, outputs?: GateData) {
        if (this._gates.has(gate._uid)) {
            throw new Error(`${gate} is already in the definition`);
        }

        // Update dependency graph if necessary
        if (!this._gateTypes.has(gate.name)) {
            if (this._project._checkDependency(this.name, gate.name)) {
                throw new Error(`Recursive definition: ${gate.name} depends on ${this.name}`);
            }
            this._project._addDependency(this.name, gate.name);
            this._gateTypes.set(gate.name, new Set<GateUID>());
        } else {
            this._gateTypes.get(gate.name)!.add(gate.uid);
        }
        this._reorder = true;

        // Add gate
        this._graph.addVertex(gate.uid);
        this._gates.set(gate.uid, gate);

        // Create the gate state if it does not yet exist
        if (state === undefined) {
            state = gate._initState();
        }

        // Update definition's state
        if (gate === this._source) {
            if (!isGateData(state)) throw new Error(`Invalid state for gate type ${gate.name}`);
            this._state["inputs"] = state;
        } else if (gate === this._sink) {
            if (!isGateData(state)) throw new Error(`Invalid state for gate type ${gate.name}`);
            this._state["outputs"] = state;
        } else {
            if (outputs === undefined) {
                outputs = gate.call(gate._initInputs(), state);
            }
            this._state.gates.set(gate.uid, [state, outputs]);
        }
    }

    /**
     * Remove a gate and all its connections from a definition
     * 
     * @param gate
     */
    removeGate(this: GateDefinition, gate: Gate) {
        if (!this._gates.has(gate.uid)) {
            throw new Error(`${gate} is not in the definition`);
        }

        // Update dependency graph if necessary
        this._gateTypes.get(gate.name)!.delete(gate.uid);
        if (this._gateTypes.get(gate.name)!.size === 0) {
            this._gateTypes.delete(gate.name);
            this._project._removeDependency(this.name, gate.name);
        }

        // Remove from connections
        for (const predecessor of this._graph.getDirectPredecessors(gate.uid)) {
            this._connections.delete([predecessor, gate.uid]);
        }

        // Remove to connections
        for (const successor of this._graph.getDirectSuccessors(gate.uid)) {
            this._connections.delete([gate.uid, successor]);
        }

        // Remove the gate from the graph
        this._graph.removeVertex(gate.uid);
        this._gates.delete(gate.uid);
        this._reorder = true;
    }

    /**
     * Remove all instances of a given gate type from the definition
     * 
     * @param name
     */
    removeGateType(this: GateDefinition, name: string) {
        const gateUids: Set<GateUID> = this._gateTypes.get(name)!;
        while (gateUids.size !== 0) {
            const gateUid = gateUids.values().next().value!;
            this.removeGate(this._gates.get(gateUid)!);
        }
    }

    renameGateType(this: GateDefinition, name: string, newName: string) {
        const uids = this._gateTypes.get(name);
        if (uids === undefined) {
            throw new Error(`Could not find ${name} in gate types. Project is inconsistent!`);
        }
        this._gateTypes.set(newName, uids);
        this._gateTypes.delete(name);
    }

    /**
     * For a given gate and output index pair, check whether the gate is in the definition and whether the output index for the gate is valid
     * 
     * @param fromPair  [gate, output index] tuple
     */
    _validateFromPair(this: GateDefinition, fromPair: FromPair) {
        const [fromGate, outputIdx] = fromPair;
        if (!this._gates.has(fromGate.uid)) {
            throw new Error(`${fromGate} is not in the definition`);
        }
        if (outputIdx >= fromGate.outputDims.length) {
            throw new Error(`Invalid output index ${outputIdx} for ${fromGate}`);
        }
    }

    /**
     * For a given gate and input index pair, check whether the gate is in the definition and whether the input index for the gate is valid
     * 
     * @param toPair    [input index, gate] tuple
     */
    _validateToPair(this: GateDefinition, toPair: ToPair) {
        const [inputIdx, toGate] = toPair;
        if (!this._gates.has(toGate.uid)) {
            throw new Error(`${toGate} is not in the definition`);
        }
        if (inputIdx >= toGate.inputDims.length) {
            throw new Error(`Invalid input index ${inputIdx} for ${toGate}`);
        }
    }

    /**
     * Add a connection from a gate to a gate if it does not already exist
     * 
     * @param fromPair  [from gate, output index] tuple
     * @param toPair    [input index, to gate] tuple
     */
    addConnection(this: GateDefinition, fromPair: FromPair, toPair: ToPair) {
        this._validateFromPair(fromPair);
        this._validateToPair(toPair);

        // Unpack input pairs
        const [fromGate, outputIdx] = fromPair;
        const [inputIdx, toGate] = toPair;

        // Validate matching input output dimensions
        const fromDim = fromGate.outputDims[outputIdx];
        const toDim = toGate.inputDims[inputIdx];
        if (fromDim !== toDim) {
            throw new Error(`${this.name}. Mismatched dimensions. (${fromGate.name}:${fromGate.uid}, ${outputIdx}) has dimension ${fromDim} while (${inputIdx}, ${toGate.name}:${toGate.uid}) has dimension ${toDim}`);
        }

        // If a connection between the two gates does not yet exist, add a graph edge between them
        const key: [number, number] = [fromGate.uid, toGate.uid];
        if (!this._connections.has(key)) {
            this._reorder = true;  // Edge has been created
            this._graph.addEdge(fromGate.uid, toGate.uid);
        }

        // Add the connection
        console.log(`Adding connection: (${fromGate})[${outputIdx}] \u2192 [${inputIdx}](${toGate})`);
        this._connections.add(key, [outputIdx, inputIdx]);
    }

    /**
     * Remove a connection from a gate to a gate if it does not already exist
     * 
     * @param fromPair  [from gate, output index] tuple
     * @param toPair    [input index, to gate] tuple
     */
    removeConnection(this: GateDefinition, fromPair: FromPair, toPair: ToPair) {
        this._validateFromPair(fromPair);
        this._validateToPair(toPair);

        // Unpack input pairs
        const [fromGate, outputIdx] = fromPair;
        const [inputIdx, toGate] = toPair;

        // Remove the output index and input index from the connection
        this._connections.delete([fromGate.uid, toGate.uid], [outputIdx, inputIdx]);

        // If the connection between the two gates no longer connects any outputs to inputs, delete it
        if (!this._connections.has([fromGate.uid, toGate.uid])) {
            this._graph.removeEdge(fromGate.uid, toGate.uid);
        }
    }

    /**
     * Remove any connections from a gate's input
     * 
     * @param toPair    [input index, gate] tuple
     */
    clearGateInput(this: GateDefinition, toPair: ToPair) {
        this._validateToPair(toPair);

        const [toIdx, toGate] = toPair;
        for (const predecessor of this._graph.getDirectPredecessors(toGate.uid)) {
            const key: [number, number] = [predecessor, toGate.uid];

            // Remove connections using the output specified
            for (const [outputIdx, inputIdx] of this._connections.get(key)!) {
                if (inputIdx === toIdx) {
                    this._connections.delete(key, [outputIdx, inputIdx]);
                }
            }

            // If the connection between the two gates no longer connects any outputs to inputs, delete it
            if (!this._connections.has(key)) {
                this._reorder = true;  // Edge has been deleted
            }
        }
    }

    /**
     * Remove all connections from a gate's outputs
     * 
     * @param fromPair  [gate, output index] tuple
     */
    clearGateOutput(this: GateDefinition, fromPair: FromPair) {
        this._validateFromPair(fromPair);

        const [fromGate, fromIdx] = fromPair;
        for (const successor of this._graph.getDirectSuccessors(fromGate.uid)) {
            const key: [number, number] = [fromGate.uid, successor];

            // Remove connections using the input specified
            for (const [outputIdx, inputIdx] of this._connections.get(key)!) {
                if (outputIdx === fromIdx) {
                    this._connections.delete(key, [outputIdx, inputIdx]);
                }
            }

            // If the connection between the two gates no longer connects any outputs to inputs, delete it
            if (!this._connections.has(key)) {
                this._reorder = true;  // Edge has been deleted
            }
        }
    }

    /**
     * Tie one of the definition's inputs to a gate's input
     * 
     * @param sourceIdx The definition's input index
     * @param toPair    [input index, gate] tuple
     */
    tieInputTo(this: GateDefinition, sourceIdx: number, toPair: ToPair) {
        this.addConnection([this._source, sourceIdx], toPair);
    }

    /**
     * Remove the connection from one of the definition's inputs to a gate's input
     * 
     * @param sourceIdx The definition's input index
     * @param toPair    [input index, gate] tuple
     */
    removeInputTo(this: GateDefinition, sourceIdx: number, toPair: ToPair) {
        this.removeConnection([this._source, sourceIdx], toPair);
    }

    /**
     * Remove all connections from one of the definition's inputs
     * 
     * @param sinkIdx   The definition's output index
     */
    clearInput(this: GateDefinition, sinkIdx: number) {
        this.clearGateOutput([this._sink, sinkIdx]);
    }

    /**
     * Tie a gate's output to one of the definition's outputs
     * 
     * @param fromPair  [gate, output index] tuple
     * @param sinkIdx   The definition's output index
     */
    tieOutputTo(this: GateDefinition, fromPair: FromPair, sinkIdx: number) {
        this.addConnection(fromPair, [sinkIdx, this._sink]);
    }

    /**
     * Remove the connection from a gate's output to one of the definition's outputs
     * 
     * @param fromPair  [gate, output index] tuple
     * @param sinkIdx   The definition's output index
     */
    removeOutputTo(this: GateDefinition, fromPair: FromPair, sinkIdx: number) {
        this.removeConnection(fromPair, [sinkIdx, this._sink]);
    }

    /**
     * Remove all connections from one of the definition's outputs
     * 
     * @param sourceIdx The definition's input index
     */
    clearOutput(this: GateDefinition, sourceIdx: number) {
        this.clearGateInput([sourceIdx, this._source]);
    }

    /**
     * Tie one of the definition's inputs to one of the definition's outputs
     * 
     * @param sourceIdx The definition's input index
     * @param sinkIdx   The definition's output index
     */
    tieInputToOutput(this: GateDefinition, sourceIdx: number, sinkIdx: number) {
        this.addConnection([this._source, sourceIdx], [sinkIdx, this._sink]);
    }

    /**
     * Remove the connection from one of the definition's inputs to one of the definition's outputs
     * 
     * @param sourceIdx The definition's input index
     * @param sinkIdx   The definition's output index
     */
    removeInputToOutput(this: GateDefinition, sourceIdx: number, sinkIdx: number) {
        this.removeConnection([this._source, sourceIdx], [sinkIdx, this._sink]);
    }

    /**
     * Move all of the given gate's incoming connections after (and including) idx to the right by 1
     * 
     * @param gate
     * @param idx
     */
    _shiftIncomingRight(this: GateDefinition, gate: Gate, idx: number) {
        // Move all connections after idx
        for (const predecessor of this._graph.getDirectPredecessors(gate.uid)) {
            const key: [number, number] = [predecessor, gate.uid];
            const newPairs: [number, number][] = [];
            for (const [outputIdx, inputIdx] of this._connections.get(key)!) {
                if (inputIdx >= idx) {
                    this._connections.delete(key, [outputIdx, inputIdx]);
                    newPairs.push([outputIdx, inputIdx + 1]);
                }
            }
            for (const idxs of newPairs) {
                this._connections.add(key, idxs);
            }
        }
    }

    /**
     * Move all of the given gate's outgoing connections after (and including) idx to the right by 1
     * 
     * @param gate
     * @param idx
     */
    _shiftOutgoingRight(this: GateDefinition, gate: Gate, idx: number) {
        // Move all connections after idx
        for (const successor of this._graph.getDirectSuccessors(gate.uid)) {
            const key: [number, number] = [gate.uid, successor];
            const newPairs: [number, number][] = [];
            for (const [outputIdx, inputIdx] of this._connections.get(key)!) {
                if (outputIdx >= idx) {
                    this._connections.delete(key, [outputIdx, inputIdx]);
                    newPairs.push([outputIdx + 1, inputIdx]);
                }
            }
            for (const idxs of newPairs) {
                this._connections.add(key, idxs);
            }
        }
    }

    /**
     * Move all of the given gate's outgoing connections after idx to the left by 1, removing any connections at idx
     * 
     * @param gate 
     * @param idx 
     */
    _shiftIncomingLeft(this: GateDefinition, gate: Gate, idx: number) {
        // Move all connections after idx
        for (const predecessor of this._graph.getDirectPredecessors(gate.uid)) {
            const key: [number, number] = [predecessor, gate.uid];
            const newPairs: [number, number][] = [];
            for (const [outputIdx, inputIdx] of this._connections.get(key)!) {
                if (inputIdx >= idx) {
                    this._connections.delete(key, [outputIdx, inputIdx]);
                    if (inputIdx > idx) {
                        newPairs.push([outputIdx, inputIdx - 1]);
                    }
                }
            }
            for (const idxs of newPairs) {
                this._connections.add(key, idxs);
            }
        }
    }

    /**
     * Move all of the given gate's outgoing connections after idx to the left by 1, removing any connections at idx
     * 
     * @param gate
     * @param idx
     */
    _shiftOutgoingLeft(this: GateDefinition, gate: Gate, idx: number) {
        // Move all connections after idx
        for (const successor of this._graph.getDirectSuccessors(gate.uid)) {
            const key: [number, number] = [gate.uid, successor];
            const newPairs: [number, number][] = [];
            for (const [outputIdx, inputIdx] of this._connections.get(key)!) {
                if (outputIdx >= idx) {
                    this._connections.delete(key, [outputIdx, inputIdx]);
                    if (outputIdx > idx) {
                        newPairs.push([outputIdx - 1, inputIdx]);
                    }
                }
            }
            for (const idxs of newPairs) {
                this._connections.add(key, idxs);
            }
        }   
    }

    /**
     * Recursively search through this definition's state for any gates that are instances of
     * some definition. When found, run a given function on those gates' stored
     * [state, output] pair and replace them with the result.
     * 
     * @param definitions   A list of dependent definitions. The first element is the
     *                      definition whose instance's states we ultimately want to replace.
     *                      Later elements are dependent on the element before them. For
     *                      example, given [A, B, C], C depends on B which depends on A. In
     *                      this way, we know to search instances of C for instances of B for
     *                      instances of A.
     * @param proc          Function to run on instances of `definition[0]`
     * @param states        Recursive helper parameter, should be undefined on the first call
     */
    _runOnTypeStates(this: GateDefinition, definitions: GateDefinition[], proc: (gsMapVal: GateStateMapValue) => GateStateMapValue, states?: GateStateMap[]) {
        // Run on the definition's instance
        if (states === undefined) {
            states = [this._state.gates];
        }

        // Grab a definition
        const definition = definitions.pop()!;
        if (definitions.length === 0) {
            // Base case: `definition` is the definition whose instances' states we want to transform
            // Transform states that are instances of `definition`
            for (const state of states) {
                for (const [uid, gsMapVal] of state) {
                    if (definition.isInstance(uid)) {
                        state.set(uid, proc(gsMapVal));
                    }
                }
            }
            // Prune states that are no longer needed (i.e. because they are now null)
            for (const state of states) {
                for (const [uid, gsMapVal] of state) {
                    if (definition.isInstance(uid)) {
                        let [gateState, outputs] = gsMapVal;
                        if (gateState !== null &&
                            ((isGateData(gateState) && gateState.length === 0) ||
                             (!isGateData(gateState) && gateState.size === 0)))
                        {
                            gateState = null;
                        }
                        if (gateState === null && outputs === null) {
                            state.delete(uid);
                        } else {
                            state.set(uid, [gateState, outputs]);
                        }
                    }
                }
            }
        } else {
            // Recursive case: `definition` depends on the definition whose instances' states we want to transform
            // Grab states of gates that are instances of `definition`
            const newStates: GateStateMap[] = [];
            for (const state of states) {
                for (const [uid, gsMapVal] of state) {
                    if (definition.isInstance(uid)) {
                        const gateState = gsMapVal[0];
                        if (gateState !== null) {
                            if (!isGateStateMap(gateState)) throw new Error("Definition's instance state should be of type GateStateMap. This case should not be possible.");
                            newStates.push(gateState);
                        }
                    }
                }
            }

            // Recursively search through those states
            this._runOnTypeStates(definitions, proc, newStates);

            // Prune states that are no longer needed (i.e. because they are now null)
            for (const state of states) {
                for (const [uid, gsMapVal] of state) {
                    if (definition.isInstance(uid)) {
                        let [gateState, outputs] = gsMapVal;
                        if (gateState !== null &&
                            ((isGateData(gateState) && gateState.length === 0) ||
                             (!isGateData(gateState) && gateState.size === 0)))
                        {
                            gateState = null;
                        }
                        if (gateState === null && outputs === null) {
                            state.delete(uid);
                        } else {
                            state.set(uid, [gateState, outputs]);
                        }
                    }
                }
            }
        }
    }

    _insertedInput(this: GateDefinition, definition: GateDefinition, idx: number) {
        for (const uid of this._gateTypes.get(definition.name)!) {
            this._shiftIncomingRight(this._gates.get(uid)!, idx);
        }
    }

    _insertedOutput(this: GateDefinition, definitions: GateDefinition[], idx: number) {
        if (definitions.length === 1) {
            for (const uid of this._gateTypes.get(definitions[0].name)!) {
                this._shiftOutgoingRight(this._gates.get(uid)!, idx);
            }
        }

        const dim = definitions[0].outputDims[idx];
        this._runOnTypeStates(definitions, (gsMapVal) => {
            const [, outputs] = gsMapVal;
            if (outputs !== null) {
                const newOutput = new Array(dim).fill(Gate.DEFAULT_VALUE);
                outputs.splice(idx, 0, newOutput);
            }
            return gsMapVal;
        });
    }

    _removedInput(this: GateDefinition, definition: GateDefinition, idx: number) {
        for (const uid of this._gateTypes.get(definition.name)!) {
            this._shiftIncomingLeft(this._gates.get(uid)!, idx);
        }
    }

    _removedOutput(this: GateDefinition, definitions: GateDefinition[], idx: number) {
        if (definitions.length === 1) {
            for (const uid of this._gateTypes.get(definitions[0].name)!) {
                this._shiftOutgoingLeft(this._gates.get(uid)!, idx);
            }
        }

        this._runOnTypeStates(definitions, (gsMapVal) => {
            const [, outputs] = gsMapVal;
            if (outputs !== null) {
                outputs.splice(idx, 1);
            }
            return gsMapVal;
        });
    }

    _removeUid(this: GateDefinition, definitions: GateDefinition[], uid: GateUID) {
        this._runOnTypeStates(definitions, (gsMapVal) => {
            const [gateState,] = gsMapVal;
            if (gateState !== null) {
                if (!isGateStateMap(gateState)) throw new Error("Instance state should be of type GateStateMap. This case should not be possible.");
                gateState.delete(uid);
            }
            return gsMapVal;
        });
    }

    /**
     * Insert a new input for the definition at idx with the given dimension
     * All inputs greater than or equal to idx are shifted over by one
     * 
     * @param idx   Idx to insert at
     * @param dim   New input's dimension
     * @param label New input's label
     */
    insertInput(this: GateDefinition, idx: number, dim: GateDim, label: string = "") {
        if (idx > this.numInputs) {
            throw new Error(`Invalid insertion index: ${idx}`);
        }

        // Update input dimensions
        this._inputDims.splice(idx, 0, dim);
        this._inputLabels.splice(idx, 0, label);

        // Update source state
        this._state.inputs.splice(idx, 0, new Array(dim).fill(Gate.DEFAULT_VALUE));
        this._shiftOutgoingRight(this._source, idx);
        this._project._insertedInput(this, idx);
    }

    /**
     * Insert a new output for the definition at idx with the given dimension
     * All outputs greater than or equal to idx are shifted over by one
     * 
     * @param idx   Idx to insert at
     * @param dim   New output's dimension
     * @param label New output's label
     */
    insertOutput(this: GateDefinition, idx: number, dim: GateDim, label: string = "") {
        if (idx > this.numOutputs) {
            throw new Error(`Invalid insertion index: ${idx}`);
        }

        // Update output dimensions
        this._outputDims.splice(idx, 0, dim);
        this._outputLabels.splice(idx, 0, label);

        // Update sink state
        this._state.outputs.splice(idx, 0, new Array(dim).fill(Gate.DEFAULT_VALUE));
        this._shiftIncomingRight(this._sink, idx);
        this._project._insertedOutput(this, idx);
    }

    /**
     * Add a new input to the definition at the end of the current inputs
     * 
     * @param dim
     */
    appendInput(this: GateDefinition, dim: GateDim, label: string = "") {
        this.insertInput(this.numInputs, dim, label)
    }

    /**
     * Add a new output to the definition at the end of the current outputs
     * 
     * @param dim 
     */
    appendOutput(this: GateDefinition, dim: GateDim, label: string = "") {
        this.insertOutput(this.numOutputs, dim, label);
    }

    /**
     * Swap two of the definition's inputs
     * 
     * @param idx0
     * @param idx1
     */
    swapInputs(this: GateDefinition, idx0: number, idx1: number) {
        if (idx0 >= this.numInputs) {
            throw new Error(`First given swap index is invalid: ${idx0}`);
        }
        if (idx1 >= this.numInputs) {
            throw new Error(`First given swap index is invalid: ${idx1}`);
        }

        // Swap connections from idx0 to idx1 and vice versa
        for (const successor of this._graph.getDirectSuccessors(this._source.uid)) {
            const key: [number, number] = [this._source.uid, successor];
            const newPairs: [number, number][] = [];
            for (let [outputIdx, inputIdx] of this._connections.get(key)!) {
                if (outputIdx === idx0) {
                   outputIdx = idx1; 
                } else if (outputIdx === idx1) {
                    outputIdx = idx0;
                }
                newPairs.push([outputIdx, inputIdx]);
            }
            for (const idxs of newPairs) {
                this._connections.add(key, idxs);
            }
        }
        
        // Update input dimensions
        const [dim0, dim1] = [this.inputDims[idx0], this.inputDims[idx1]];
        this.inputDims[idx0] = dim1;
        this.inputDims[idx1] = dim0;

        // Update input labels
        const [label0, label1] = [this.inputLabels[idx0], this.inputLabels[idx1]];
        this.inputLabels[idx0] = label1;
        this.inputLabels[idx1] = label0;

        // Update definition's sttate
        const [input0, input1] = [this._state.inputs[idx0], this._state.inputs[idx1]];
        this._state.inputs[idx0] = input1;
        this._state.inputs[idx1] = input0;
    }

    // TODO: test implementation, since it currently doesn't recursively update the state
    /**
     * Swap two of the definition's outputs 
     *
     * @param idx0
     * @param idx1
     */
    swapOutputs(this: GateDefinition, idx0: number, idx1: number) {
        if (idx0 >= this.numOutputs) {
            throw new Error(`First given swap index is invalid: ${idx0}`);
        }
        if (idx1 >= this.numOutputs) {
            throw new Error(`First given swap index is invalid: ${idx1}`);
        }

        // Swap connections from idx0 to idx1 and vice versa
        for (const predecessor of this._graph.getDirectSuccessors(this._sink.uid)) {
            const key: [number, number] = [predecessor, this._sink.uid];
            const newPairs: [number, number][] = [];
            for (let [outputIdx, inputIdx] of this._connections.get(key)!) {
                if (inputIdx === idx0) {
                   inputIdx = idx1; 
                } else if (inputIdx === idx1) {
                    inputIdx = idx0;
                }
                newPairs.push([outputIdx, inputIdx]);
            }
            for (const idxs of newPairs) {
                this._connections.add(key, idxs);
            }
        }
        
        // Update output dimensions
        const [dim0, dim1] = [this.outputDims[idx0], this.outputDims[idx1]];
        this.outputDims[idx0] = dim1;
        this.outputDims[idx1] = dim0;

        // Update output labels
        const [label0, label1] = [this.outputLabels[idx0], this.outputLabels[idx1]];
        this.outputLabels[idx0] = label1;
        this.outputLabels[idx1] = label0;

        // Update definition's sttate
        const [output0, output1] = [this._state.outputs[idx0], this._state.outputs[idx1]];
        this._state.outputs[idx0] = output1;
        this._state.outputs[idx1] = output0;

        // // Update states in every definition that depends on this one
        // this._project._runOnDependees(this, (definition, acc) => {
        //     definition._runOnTypeStates(acc, (gsMapVal) => {
        //         const [, outputs] = gsMapVal;
        //         if (outputs !== null) {
        //             const [output0, output1] = [outputs[idx0], outputs[idx1]];
        //             outputs[idx0] = output1;
        //             outputs[idx1] = output0;
        //         }
        //         return gsMapVal;
        //     });
        // });
    }

    /**
     * Remove one of the definition's inputs
     * 
     * @param idx
     */
    removeInput(this: GateDefinition, idx: number) {
        if (idx >= this.numInputs) {
            throw new Error(`Input index is invalid: ${idx}`);
        }
        
        // Update input dimensions
        this._inputDims.splice(idx, 1);
        this._inputLabels.splice(idx, 1);

        // Update source state
        this._state.inputs.splice(idx, 1);

        this._shiftOutgoingLeft(this._source, idx);
        this._project._removedInput(this, idx);
    }

    /**
     * Remove one of the definition's outputs
     * 
     * @param idx
     */
    removeOutput(this: GateDefinition, idx: number) {
        if (idx >= this.numOutputs) {
            throw new Error(`Output index is invalid: ${idx}`);
        }

        // Update output dimensions
        this._outputDims.splice(idx, 1);
        this._outputLabels.splice(idx, 1);

        // Update sink state
        this._state.outputs.splice(idx, 1);

        this._shiftIncomingLeft(this._sink, idx);
        this._project._removedOutput(this, idx);
    }

    /**
     * Remove the definition's last input
     */
    popInput(this: GateDefinition) {
        if (this.numInputs === 0) {
            throw new Error("Cannot pop an input because the number of inputs is 0");
        }
        this.removeInput(this.numInputs - 1);
    }

    /**
     * Remove the definition's last output
     */
    popOutput(this: GateDefinition) {
        if (this.numOutputs === 0) {
            throw new Error("Cannot pop an output because the number of outputs is 0");
        }
        this.removeOutput(this.numOutputs - 1);
    }

    // TODO: probably need to disconnect connected gates in definitions that depend on this one
    // TODO: instead of clearing the input, display a warning
    /**
     * Set a new dimension for the given input
     * 
     * @param idx
     * @param dim
     */
    reshapeInput(this: GateDefinition, idx: number, dim: GateDim) {
        if (idx >= this.numInputs) {
            throw new Error(`Input index is invalid: ${idx}`);
        }
        const oldDim = this._inputDims[idx];
        if (oldDim !== dim) {
            this.clearInput(idx);  // Disconnect since the new dimension doesn't match the old one
        }
        this._inputDims[idx] = dim
    }

    // TODO: probably need to disconnect connected gates in definitions that depend on this one
    // TODO: instead of clearing the output, display a warning
    /**
     * Set a new dimension for the given input
     * 
     * @param idx
     * @param dim
     */
    reshapeOutput(this: GateDefinition, idx: number, dim: GateDim) {
        if (idx >= this.numOutputs) {
            throw new Error(`Output index is invalid: ${idx}`);
        }
        const oldDim = this._outputDims[idx];
        if (oldDim !== dim) {
            this.clearOutput(idx);  // Disconnect since the new dimension doesn't match the old one
        }
        this._outputDims[idx] = dim
    }

    /**
     * Set a new label for the given input
     * 
     * @param idx
     * @param label
     */
    renameInput(this: GateDefinition, idx: number, label: string = "") {
        if (idx >= this.numInputs) {
            throw new Error(`Input index is invalid: ${idx}`);
        }
        this._inputLabels[idx] = label;
        // this._source._outputLabels[idx] = label;  // TODO: figure out if this is necessary
    }

    renameOutput(this: GateDefinition, idx: number, label: string = "") {
        if (idx >= this.numOutputs) {
            throw new Error(`Output index is invalid: ${idx}`);
        }
        this._outputLabels[idx] = label;
        // this._sink._outputLabels[idx] = label;
    }

    _initInputs(this: GateDefinition): GateData {
        return this._source._initState();
    }

    _updateOrder(this: GateDefinition) {
        // Compute a new evaluation order if necessary
        if (this._reorder) {
            let cutEdges: [number, number][];
            [this._order, cutEdges] = this._graph.getOrder(this._source.uid);
            this._cutGates = new Set();
            for (const [v,] of cutEdges) {
                this._cutGates.add(v);
            }
            this._rootedGates = this._graph.getAllPredecessors(this._sink.uid);
            this._rootedGates.add(this._sink.uid);
            this._reorder = false;
        }
    }

    /**
     * Initialize a state
     */
    _initState(this: GateDefinition): GateStateMap | null {
        this._updateOrder();

        // Sore the gates for each gate in the definition if needed
        const state: GateStateMap = new Map();
        this._statefulGates = new Set();
        for (const [gateUid, gate] of this._gates) {
            // Don't store the source, sink, or any gate that is not a predecessor of the sink
            if (gateUid !== this._source.uid && gateUid !== this._sink.uid && this._rootedGates.has(gateUid)) {
                // We only need to store a gate's state if it is not null
                const gateState = gate._initState();
                if (gateState !== null) {
                    this._statefulGates.add(gate.uid);
                }

                // We only need to store a gate's outputs if it is a cut gate
                let outputs: GateData | null;
                if (this._cutGates.has(gateUid)) {
                    outputs = gate.call(gate._initInputs(), gateState);
                } else {
                    outputs = null;
                }

                // If both the state and outputs are null, we don't need to store anything
                if (gateState !== null || outputs !== null) {
                    state.set(gateUid, [gateState, outputs]);
                }
            }
        }

        // Return null if this gate does not need to store a state
        return state.size === 0 ? null : state;
    }

    /**
     * Process a given state
     * 
     * @param inputs
     * @param state
     */
    _processState(this: GateDefinition, inputs: GateData, state?: GateStateMap | null, all: boolean = false): GateData {
        this._updateOrder();

        // Evaluate each gate to compute the final output
        const outputs: Map<GateUID, GateData> = new Map([[this._source.uid, inputs]]);
        let finalOutputs: GateData = [];
        for (const gateUid of this._order) {
            // Skip over the restt of the code for the source since we don't need to do any computation for it
            if (gateUid === this._source.uid) {
                continue;
            }

            // Skip over gates that are not connected
            if (!this._rootedGates.has(gateUid) && !all) {
                continue;
            }

            // Retrieve the gate
            const gate = this._gates.get(gateUid)!;

            // Get the inputs to the gate from its predecessors
            const gateInputs = gate._initInputs();
            for (const predecessor of this._graph.getDirectPredecessors(gateUid)) {
                for (const [outputIdx, inputIdx] of this._connections.get([predecessor, gateUid])!) {
                    if (outputs.has(predecessor)) {
                        gateInputs[inputIdx] = outputs.get(predecessor)![outputIdx];
                    } else if (state !== null && state !== undefined && state.has(predecessor)) {
                        // Predecessor's outputs have not yet been computed, grab the previous ones from the state
                        const [, storedOutputs] = state.get(predecessor)!;
                        if (storedOutputs === null) {
                            gateInputs[inputIdx] = null;
                        } else {
                            gateInputs[inputIdx] = storedOutputs[outputIdx];
                        }
                    } else {
                        gateInputs[inputIdx] = null;
                    }
                }
            }

            // Save outputs
            if (gateUid === this._sink.uid) {
                finalOutputs = gateInputs;
            } else {
                // Update state if necessary
                let gateOutputs: GateData;
                if (state !== null && state !== undefined && state.has(gateUid)) {
                    const [gateState, oldOutputs] = state.get(gateUid)!
                    console.log(`Calling ${gate} with ${gateInputs} and state ${gateState}`);
                    gateOutputs = gate.call(gateInputs, gateState);
                    if (oldOutputs === null) {
                        state.set(gateUid, [gateState, null]);
                    } else {
                        state.set(gateUid, [gateState, gateOutputs]);
                    }
                } else {
                    console.log(`Calling ${gate} with ${gateInputs}`);
                    gateOutputs = gate.call(gateInputs);
                }
                outputs.set(gateUid, gateOutputs);
            }
        }
        return finalOutputs;
    }

    tick(this: GateDefinition) {
        this._state.outputs = this._processState(this._state.inputs, this._state.gates, true);
    }

    toJSON(this: GateDefinition): JSONValue {
        // Serialize gates
        const gates: JSONObj = {};
        for (const [uid, gate] of this._gates) {
            if (gate !== this._source && gate !== this._sink) {
                gates[uid] = gate.toJSON();
            }
        }

        // Reformat connections for serialization
        const connections: JSONObj = {};
        for (const [[fromUid, toUid], pairs] of this._connections) {
            if (connections[fromUid] === undefined) {
                connections[fromUid] = {};
            }
            (connections[fromUid] as JSONObj)[toUid] = Array.from(pairs);
        }

        // Return JSONValue object
        return {"/GateDefinition": {
            "name": this.name,
            "inputDims": this.inputDims,
            "outputDims": this.outputDims,
            "inputLabels": this.inputLabels,
            "outputLabels": this.outputLabels,
            "source": this._source.uid,
            "sink": this._sink.uid,
            "gates": gates,
            "connections": connections,
            "state": {
                "inputs": this._state.inputs,
                "outputs": this._state.outputs,
                "gates": this.stateToJSON(this._state.gates)
            }
        }};
    }

    stateToJSON(this: GateDefinition, state: GateStateMap | null): JSONValue {
        if (state === null) {
            return null;
        }

        const obj: JSONObj = {};
        for (const [uid, [gateState, outputs]] of state) {
            // Handle invalid states
            if (this._gates.has(uid)) {
                obj[uid] = [this._gates.get(uid)!.stateToJSON(gateState), outputs];
            } else {
                obj[uid] = [null, outputs];
            }
        }
        return obj;
    }

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`GateDefinition reviver: ${msg}`);
    }

    static getReviver(project: Project, gates: Map<number, Gate>): JSONReviver<GateDefinition> {
        const reviver: JSONReviver<GateDefinition> = function(this, key, value) {
            if (tsJSON.isJSONObj(value) && value["/GateDefinition"] !== undefined) {
                const obj = value["/GateDefinition"];
                if (!tsJSON.isJSONObj(obj)) throw GateDefinition.JSONSyntaxError("expected an object as top level object");
                if (typeof obj["name"] !== "string") throw GateDefinition.JSONSyntaxError("expected a string as name");
                if (!tsJSON.isJSONArray(obj["inputDims"])) throw GateDefinition.JSONSyntaxError("expected an array as input dims");
                if (!tsJSON.isJSONArray(obj["outputDims"])) throw GateDefinition.JSONSyntaxError("expected an array as output dims");
                if (!tsJSON.isJSONArray(obj["inputLabels"])) throw GateDefinition.JSONSyntaxError("expected an array as input labels");
                if (!tsJSON.isJSONArray(obj["outputLabels"])) throw GateDefinition.JSONSyntaxError("expected an array as output labels");
                if (typeof obj["source"] !== "number") throw GateDefinition.JSONSyntaxError("expected a number as source uid");
                if (typeof obj["sink"] !== "number") throw GateDefinition.JSONSyntaxError("expected a number as sink uid");
                if (!tsJSON.isJSONObj(obj["gates"])) throw GateDefinition.JSONSyntaxError("expected an object as gates dict");
                if (!tsJSON.isJSONObj(obj["connections"])) throw GateDefinition.JSONSyntaxError("expected an object as connections dict");
                if (!tsJSON.isJSONObj(obj["state"])) throw GateDefinition.JSONSyntaxError("expected an object as state dict");

                // Deserialize input dimensions
                const inputDims: GateDim[] = [];
                for (const dim of obj["inputDims"]) {
                    if (!isGateDim(dim)) throw DirectedGraph.JSONSyntaxError("expected input dimension to be an integer");
                    inputDims.push(Number(dim));
                }

                // Deserialize output dimensions
                const outputDims: GateDim[] = [];
                for (const dim of obj["outputDims"]) {
                    if (!isGateDim(dim)) throw DirectedGraph.JSONSyntaxError("expected output dimension to be an integer");
                    outputDims.push(Number(dim));
                }

                // Deserialize input labels
                const inputLabels: string[] = [];
                for (const label of obj["inputLabels"]) {
                    if (typeof label !== "string") throw DirectedGraph.JSONSyntaxError("expected input label to be a string");
                    inputLabels.push(label);
                }

                // Deserialize output labels
                const outputLabels: string[] = [];
                for (const label of obj["outputLabels"]) {
                    if (typeof label !== "string") throw DirectedGraph.JSONSyntaxError("expected output label to be a string");
                    outputLabels.push(label);
                }

                // Create definition
                const definition = new GateDefinition(obj["name"], project, inputDims, outputDims, inputLabels, outputLabels);
                gates.set(obj["source"], definition._source);
                gates.set(obj["sink"], definition._sink);

                // Create gates
                for (const oldUid in obj["gates"]) {
                    if (!Number.isInteger(Number(oldUid))) throw DirectedGraph.JSONSyntaxError("expected an integer as an element in values of edge dict");
                    const gateObj = obj["gates"][oldUid]
                    if (!tsJSON.isJSONObj(gateObj)) throw GateDefinition.JSONSyntaxError("expected an object as gate object");
                    let gate: Gate | undefined = undefined;
                    for (const key in gateObj) {
                        if (key[0] === "/" && project.has(key.substring(1))) {
                            const definition = project.get(key.substring(1))!;
                            gate = (definition as GateDefinition).getReviver().bind(obj["gates"])(oldUid, gateObj) as Gate;
                            break;
                        }
                    }
                    if (gate === undefined) throw GateDefinition.JSONSyntaxError(`could not deserialize gate: ${gateObj}`);
                    gates.set(Number(oldUid), gate);
                    definition.addGate(gate);
                }

                // Add connections
                for (const fromUid in obj["connections"]) {
                    if (!Number.isInteger(Number(fromUid))) throw GateDefinition.JSONSyntaxError("expected integer as from uid");
                    if (!tsJSON.isJSONObj(obj["connections"][fromUid])) throw GateDefinition.JSONSyntaxError("expected an object in connections");
                    for (const toUid in obj["connections"][fromUid]) {
                        if (!Number.isInteger(Number(toUid))) throw GateDefinition.JSONSyntaxError("expected integer as to uid");
                        if (!tsJSON.isJSONArray(obj["connections"][fromUid][toUid])) throw GateDefinition.JSONSyntaxError("expected an array in connections");
                        for (const pair of obj["connections"][fromUid][toUid]) {
                            if (!tsJSON.isJSONArray(pair)) throw GateDefinition.JSONSyntaxError("expected an array as input idx, output idx pair");
                            if (typeof pair[0] !== "number") throw GateDefinition.JSONSyntaxError("expected an integer as output idx");
                            if (typeof pair[1] !== "number") throw GateDefinition.JSONSyntaxError("expected an integer as input idx");
                            const [outputIdx, inputIdx] = pair;
                            const fromGate = gates.get(Number(fromUid))!;
                            const toGate = gates.get(Number(toUid))!;
                            definition.addConnection([fromGate, outputIdx], [inputIdx, toGate]);
                        }
                    }
                }

                // Add inputs and outputs
                if (!tsJSON.isJSONArray(obj["state"]["inputs"])) throw GateDefinition.JSONSyntaxError("expected an array as inputs");
                if (!tsJSON.isJSONArray(obj["state"]["outputs"])) throw GateDefinition.JSONSyntaxError("expected an array as outputs");
                definition._state.inputs = Gate.validateGateData(obj["state"]["inputs"], inputDims);
                definition._state.outputs = Gate.validateGateData(obj["state"]["outputs"], outputDims);

                // Add gate states
                if (!tsJSON.isJSONObj(obj["state"]["gates"])) throw GateDefinition.JSONSyntaxError("expected an object as gates state");
                definition._state.gates = definition.reviveState(obj["state"]["gates"], gates)!;

                return definition;
            } else {
                return value;
            }
        };
        return reviver;
    }

    reviveState(this: GateDefinition, obj: JSONValue, gates: Map<number, Gate>): GateStateMap | null {
        if (obj === null) {
            return null
        } else if (tsJSON.isJSONObj(obj)) {
            const state: GateStateMap = new Map();
            for (const oldUid in obj) {
                if (!Number.isInteger(Number(oldUid))) throw this.JSONSyntaxError("expected integer as uid");
                const gate = gates.get(Number(oldUid));
                if (gate === undefined) throw this.JSONSyntaxError(`Could not find gate whose old uid was ${oldUid}`);
                if (!tsJSON.isJSONArray(obj[oldUid])) throw this.JSONSyntaxError(`expected array as gate state for ${gate}`);
                const gateStateObj = obj[oldUid][0];
                let outputs: GateData | null;
                if (tsJSON.isJSONArray(obj[oldUid][1])) {
                    outputs = Gate.validateGateData(obj[oldUid][1], gate.outputDims);
                } else if (obj[oldUid][1] === null) {
                    outputs = null;
                } else {
                    throw this.JSONSyntaxError(`expected array or null as gate outputs for ${gate}`);
                }
                if (!this._project.has(gate.name)) throw this.JSONSyntaxError(`could not find gate type ${gate.name}`);
                const definition = this._project.get(gate.name)!;
                const gateState = (definition as GateDefinition).reviveState(gateStateObj, gates);
                state.set(gate.uid, [gateState, outputs]);
            }
            return state;
        } else {
            throw this.JSONSyntaxError("expected object as state");
        }
    }

    JSONSyntaxError(this: GateDefinition, msg: string): SyntaxError {
        return new SyntaxError(`${this.name} reviver: ${msg}`);
    }

    getReviver(this: GateDefinition): JSONReviver<CompoundGate> {
        const that = this;
        const reviver: JSONReviver<CompoundGate> = function (this, key, value) {
            if (tsJSON.isJSONObj(value) && value[`/${that.name}`] !== undefined) {
                const obj = value[`/${that.name}`];
                if (obj !== null) throw that.JSONSyntaxError("expected null as top level object");
                return that.create();
            }   
        }
        return reviver;
    }

    get name(): string {
        return this._name;
    }

    set name(name: string) {
        this._name = name;
    }

    get inputDims() {
        return this._inputDims
    }

    get outputDims() {
        return this._outputDims
    }

    get inputLabels() {
        return this._inputLabels
    }

    get outputLabels() {
        return this._outputLabels
    }

    get numInputs() {
        return this._inputDims.length;
    }

    get numOutputs() {
        return this._outputDims.length;
    }

    get gates() {
        return this._gates
    }

    get gateTypes() {
        return this._gateTypes
    }

    get connections() {
        return this._connections
    }

    get source() {
        return this._source;
    }

    get sink() {
        return this._sink;
    }

    get graph() {
        return this._graph;
    }

    /**
     * Return the direct predecessors for a gate given its uid
     * 
     * @param uid
     */
    getGatePredecessors(this: GateDefinition, uid: GateUID): Set<GateUID> {
        return this._graph.getDirectPredecessors(uid);
    }

    /**
     * Return the direct successors for a gate given its uid
     *
     * @param uid
     */
    getGateSuccessors(this: GateDefinition, uid: GateUID): Set<GateUID> {
        return this._graph.getDirectSuccessors(uid);
    }

    /**
     * Get the current inputs for a gate given its uid
     * 
     * @param uid
     */
    getGateInputs(this: GateDefinition, uid: GateUID): GateData {
        if (uid === this._sink.uid) {
            return this._state.outputs;
        } else if (uid === this._source.uid) {
            return [];
        } else {
            // Get the inputs to the gate from its predecessors
            const inputs: GateData = this._gates.get(uid)!._initInputs();
            for (const predecessor of this._graph.getDirectPredecessors(uid)) {
                for (const [outputIdx, inputIdx] of this._connections.get([predecessor, uid])!) {
                    if (predecessor === this._source.uid) {
                        inputs[inputIdx] = this._state.inputs[outputIdx];
                    } else if (this._state.gates.has(predecessor)) {
                        const outputs = this._state.gates.get(predecessor)![1];
                        if (outputs === null) throw new Error("Gate definition instance state should not have null outputs");
                        inputs[inputIdx] = outputs[outputIdx];
                    } else {
                        throw new Error("Invalid definition state");
                    }
                }
            }
            return inputs;
        }
    }

    /**
     * Get the current outputs for a gate given its uid
     * 
     * @param uid
     */
    getGateOutputs(this: GateDefinition, uid: GateUID): GateData {
        if (uid === this._source.uid) {
            return this._state.inputs;
        } else if (uid === this._sink.uid) {
            return [];
        } else {
            const outputs = this._state.gates.get(uid)![1];
            if (outputs === null) throw new Error("Gate definition instance state should not have null outputs");
            return outputs;
        }
    }

    /**
     * Get the current state for a gate given its uid
     * 
     * @param uid
     */
    getGateState(this: GateDefinition, uid: GateUID): GateState {
        if (uid === this._source.uid) {
            return this._state.inputs;
        } else if (uid === this._sink.uid) {
            return this._state.outputs;
        } else {
            return this._state.gates.get(uid)![0];
        }
    }

    /**
     * Set the current state for a gate given its uid
     * 
     * @param uid
     * @param state
     */
    setGateState(this: GateDefinition, uid: GateUID, state: GateState) {
        if (uid === this._source.uid) {
            if (!isGateData(state)) throw new Error("State must gate data to assign to inputs");
            this._state.inputs = state;
        } else if (uid === this._sink.uid) {
            if (!isGateData(state)) throw new Error("State must gate data to assign to outputs");
            this._state.outputs = state;
        } else {
            this._state.gates.get(uid)!.splice(0, 1, state);
        }
    }

    /**
     * Given a from pair, return the to pairs
     * 
     * @param this
     * @param fromPair
     */
    getToPairs(this: GateDefinition, fromPair: FromPair): ToPair[] {
        this._validateFromPair(fromPair);
        const [fromGate, outputIdx] = fromPair;
        const toPairs: ToPair[] = [];
        for (const successor of this._graph.getDirectSuccessors(fromGate.uid)) {
            const pairs = this._connections.get([fromGate.uid, successor]);
            if (pairs !== undefined) {
                for (const [idx, inputIdx] of pairs) {
                    if (idx === outputIdx) {
                        toPairs.push([inputIdx, this._gates.get(successor)!]);
                    }
                }
            }
        }
        return toPairs;
    }

    /**
     * Given a to pair, if the input is connected to something, return a from pair
     * 
     * @param toPair
     */
    getFromPairs(this: GateDefinition, toPair: ToPair): FromPair | null {
        this._validateToPair(toPair);
        const [inputIdx, toGate] = toPair;
        for (const predecessor of this._graph.getDirectPredecessors(toGate.uid)) {
            const pairs = this._connections.get([predecessor, toGate.uid]);
            if (pairs !== undefined) {
                for (const [outputIdx, idx] of pairs) {
                    if (idx === inputIdx) {
                        return [this._gates.get(predecessor)!, outputIdx];
                    }
                }
            }
        }
        return null;
    }

    resetGateState(this: GateDefinition, gate: Gate) {
        if (!this._gates.has(gate.uid)) {
            throw new Error(`${gate} is not in the definition`);
        }

        // Replace old state with new state
        const gateState = gate._initState();
        if (gate === this._source) {
            this._state.inputs = gateState as GateData;
        } else if (gate === this._sink) {
            this._state.outputs = gateState as GateData;
        } else {
            this._state.gates.set(gate.uid, [gateState, gate.call(gate._initInputs(), gateState)]);
        }
    }

    /**
     * Reset state of all gates
     */
    resetState(this: GateDefinition) {
        for (const gate of this._gates.values()) {
            this.resetGateState(gate);
        }
        this._reorder = true;  // Reevaluate the order
    }

    repairState(this: GateDefinition) {
        // TODO implement something?
    }

    _repairInstances(this: GateDefinition, definitions: GateDefinition[]) {
        this._runOnTypeStates(definitions, (gsMapVal) => {
            const gateState = definitions[0]._initState();
            const inputs = definitions[0]._initInputs();
            return [gateState, definitions[0]._processState(inputs, gateState)];
        })
    }

    repairInstances(this: GateDefinition) {
        this._project._repairInstances(this);
    }

    duplicateGate(this: GateDefinition, gate: Gate): Gate {
        if (gate === this._source) {
            throw new Error("Cannot duplicate source gate");
        } else if (gate === this._sink) {
            throw new Error("Cannot duplicate sink gate");
        }

        const [gateState, outputs] = this._state.gates.get(gate.uid)!;
        const duplicate = gate._duplicate();
        const duplicateState = gate._duplicateState(gateState);
        const duplicateOutputs = tsJSON.parse(tsJSON.stringify(outputs)) as GateData | null;
        this.addGate(duplicate, duplicateState, duplicateOutputs === null ? undefined : duplicateOutputs);
        return duplicate;
    }

    create(this: GateDefinition): CompoundGate {
        const gate = CompoundGate.create(this);
        this._instanceUids.add(gate.uid);
        return gate;
    }

    toString(this: GateDefinition): string {
        let s = "";
        if (this.numInputs > 0) {
            const inputs = this._state.inputs;
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
        s += `${this.name} Definition`;
        if (this._outputDims.length > 0) {
            const outputs = this._state.outputs;
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
}

export default CompoundGate;
export { GateDefinition };