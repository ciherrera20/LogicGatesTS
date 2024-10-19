import Gate, { GateDim, GateData, GateState, GateStateMap, GateStateMapValue, GateUID, isGateData, isGateStateMap } from "gates/gate";
import Sink from "gates/builtins/sink";
import Source from "gates/builtins/source";
import DirectedGraph from "gates/utils/graph";
import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Project from "gates/project";

class CompoundGate extends Gate {
    _definition: GateDefinition;

    constructor(name: "CompoundGate", inputDims: GateDim[], outputDims: GateDim[], inputLabels: string[], outputLabels: string[], definition: GateDefinition) {
        // TODO: Use definition to get dimensions and labels, and create copies
        super("CompoundGate", inputDims, outputDims, inputLabels, outputLabels);
        this._definition = definition
    }

    static create(definition: GateDefinition) {
        return new CompoundGate("CompoundGate", definition._inputDims, definition._outputDims, definition._inputLabels, definition._outputLabels, definition);
    }

    _initState(this: CompoundGate): GateStateMap | null {
        return this._definition._initState();
    }

    call(this: CompoundGate, inputs?: GateData, state?: GateState): GateData {
        return this._definition._processState(inputs, state);
    }

    toJSON(this: CompoundGate): Exclude<JSONValue, JSONSerializable> {
        return this._definition.toJSON();
    }

    static getReviver(project: Project): JSONReviver<CompoundGate> {}

    _duplicate(this: CompoundGate): CompoundGate {
        return CompoundGate.create(this._definition);
    }

    get name(): string {
        return this._definition.name;
    }
}

type FromPair = [Gate, number];
type ToPair = [number, Gate];

// type ConnectionMap = Map<GateUID, Map<GateUID, Map<number, number>>>;

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
    _numInputs:     number;
    _numOutputs:    number;
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
                        instance: GateStateMap,
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
        this._numInputs = inputDims.length;
        this._numOutputs = outputDims.length;
        this._inputLabels = inputLabels ? inputLabels : new Array(this._numInputs).fill("")
        this._outputLabels = outputLabels ? outputLabels : new Array(this._numOutputs).fill("")
        this._graph = new DirectedGraph();
        this._gates = new Map();
        this._gateTypes = new Map();
        this._connections = new ConnectionMap();
        this._state = {"inputs": [], "instance": new Map(), "outputs": []};
        this._source = Source.create(this._inputDims);
        this._sink = Sink.create(this._outputDims);
        this._order = [];
        this._cutGates = new Set();
        this._statefulGates = new Set();
        this._rootedGates = new Set();
        this._reorder = true;
        this._instanceUids = new Set();

        this.addGate(this._sink);
        this.addGate(this._source);
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
            this._state.instance.set(gate.uid, [state, outputs]);
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
        if (inputIdx >= toGate.outputDims.length) {
            throw new Error(`Invalid output index ${inputIdx} for ${toGate}`);
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

        // If a connection between the two gates does not yet exist, create it
        const m = this._connections.add([fromGate.uid, toGate.uid], [outputIdx, inputIdx]);
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
     * Move all of the given gate's incoming connections after idx to the right by 1
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
     * Move all of the given gate's outgoing connections after idx to the right by 1
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
    _runOnTypeStates(this: GateDefinition, definitions: GateDefinition[], proc: (pair: GateStateMapValue) => GateStateMapValue, states?: GateStateMap[]) {
        // Run on the definition's instance
        if (states === undefined) {
            states = [this._state.instance];
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

    _insertedInput(this: GateDefinition, definition: GateDefinition, idx: number) {}

    _insertedOutput(this: GateDefinition, definitions: GateDefinition[], idx: number) {}

    _removedInput(this: GateDefinition, definition: GateDefinition, idx: number) {}

    _removedOutput(this: GateDefinition, definitions: GateDefinition[], idx: number) {}

    _removeUid(this: GateDefinition, definitions: GateDefinition[], uid: GateUID) {}

    insertInput(this: GateDefinition, idx: number, dim: GateDim, label: string = "") {}

    insertOutput(this: GateDefinition, idx: number, dim: GateDim, label: string = "") {}

    // TODO: add label argument
    appendInput(this: GateDefinition, dim: GateDim) {}

    // TODO: add label argument
    appendOutput(this: GateDefinition, dim: GateDim) {}

    swapInputs(this: GateDefinition, idx0: number, idx1: number) {}

    // TODO: test python implementation, since it currently doesn't recursively update the state
    swapOutputs(this: GateDefinition, idx0: number, idx1: number) {}

    removeInput(this: GateDefinition, idx: number) {}

    removeOutput(this: GateDefinition, idx: number) {}

    popInput(this: GateDefinition) {}

    popOutput(this: GateDefinition) {}

    reshapeInput(this: GateDefinition, idx: number, dim: GateDim) {}

    reshapeOutput(this: GateDefinition, idx: number, dim: GateDim) {}

    renameInput(this: GateDefinition, idx: number, label: string = "") {}

    renameOutput(this: GateDefinition, idx: number, label: string = "") {}

    _initInputs(this: GateDefinition): GateData {}

    _updateOrder(this: GateDefinition) {}

    _initState(this: GateDefinition): GateStateMap | null {}

    _processState(this: GateDefinition, inputs?: GateData, state?: GateState)

    tick(this: GateDefinition) {}

    toJSON() {
        return undefined;
    }

    static getReviver(): JSONReviver<GateDefinition> {}

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

    getGatePredecessors(this: GateDefinition, uid: GateUID): Set<GateUID> {}

    getGateSuccessors(this: GateDefinition, uid: GateUID): Set<GateUID> {}

    getGateInputs(this: GateDefinition, uid: GateUID): GateData {}

    getGateOutputs(this: GateDefinition, uid: GateUID): GateData {}

    getGateState(this: GateDefinition, uid: GateUID): GateState {}

    setGateState(this: GateDefinition, uid: GateUID, state: GateState) {}

    getToPairs(this: GateDefinition, fromPair: FromPair): ToPair[] {}

    getFromPairs(this: GateDefinition, toPair: ToPair): FromPair[] {}

    resetGateState(this: GateDefinition, state: GateState) {}

    resetState(this: GateDefinition) {}

    repairState(this: GateDefinition) {}

    _repairInstances(this: GateDefinition, definitions: GateDefinition[]) {}

    duplicateGate(this: GateDefinition, gate: Gate) {}

    call(this: GateDefinition): CompoundGate {}

    toString(this: GateDefinition): string {}
}

export default CompoundGate;
export { GateDefinition };