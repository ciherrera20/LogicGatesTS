import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";

/**
 * Directed graph implementation using adjacency lists
 */
// interface DirectedGraph<V extends JSONValue> extends JSONSerializable {
//     _fromDict:                      Map<V, Set<V>>;
//     _toDict:                        Map<V, Set<V>>;
//     addVertex:                      (this: DirectedGraph<V>, v: V) => void;
//     removeVertex:                   (this: DirectedGraph<V>, v: V) => void;
//     checkEdge:                      (this: DirectedGraph<V>, v: V, w: V) => boolean;
//     addEdge:                        (this: DirectedGraph<V>, v: V, w: V) => void;
//     removeEdge:                     (this: DirectedGraph<V>, v: V, w: V) => void;
//     getShortestPaths:               (this: DirectedGraph<V>, source: V) => Map<V, number>;
//     getStronglyConnectedComponents: (this: DirectedGraph<V>, ) => Set<V>[];
//     getOrder:                       (this: DirectedGraph<V>, source: V) => [V[], [V, V][]];
//     removeCycles:                   (this: DirectedGraph<V>, source: V) => [DirectedGraph<V>, V[]];
//     getLayers:                      (this: DirectedGraph<V>, source: V) => Map<V, number>;
//     getDirectSuccessors:            (this: DirectedGraph<V>, v: V) => Set<V>;
//     getDirectPredecessors:          (this: DirectedGraph<V>, v: V) => Set<V>;
//     getAllSuccessors:               (this: DirectedGraph<V>, v: V) => Set<V>;
//     getAllPredecessors:             (this: DirectedGraph<V>, v: V) => Set<V>;
//     copy:                           (this: DirectedGraph<V>) => DirectedGraph<V>;
//     toString:                       (thisk: DirectedGraph<V>) => string;
//     toJSON:                         (this: DirectedGraph<V>) => Exclude<JSONValue, JSONSerializable>;
// };

class DirectedGraph<V extends JSONValue> implements JSONSerializable {
    _fromDict: Map<V, Set<V>>;
    _toDict: Map<V, Set<V>>;

    constructor() {
        this._fromDict = new Map<V, Set<V>>();
        this._toDict = new Map<V, Set<V>>();
    }

    /**
     * Add vertex v to the graph if it is not already in it
     * 
     * Runtime: O(1)
     * 
     * @param v
     */
    addVertex(this: DirectedGraph<V>, v: V): void {
        if (!this._fromDict.has(v) && !this._toDict.has(v)) {
            this._fromDict.set(v, new Set());
            this._toDict.set(v, new Set());
        }
    };

    /**
     * Remove vertex v from the graph
     * 
     * Runtime: O(|V|)
     *     Run time is proportional to the number of edges
     *     that v has. The worst case is v is connected to
     *     every other vertex.
     * 
     * @param v 
     */
    removeVertex(this: DirectedGraph<V>, v: V): void {
        for (const w of this._fromDict.get(v)!) {
            this._toDict.get(w)!.delete(v);
        }
        for (const w of this._toDict.get(v)!) {
            this._fromDict.get(w)!.delete(v);
        }
        this._fromDict.delete(v);
        this._toDict.delete(v);
    };

    /**
     * If the edge from v to w exists, check if it is part of a cycle
     * Otherwise, check if it would be part of a cycle if it were added
     * 
     * Runtime: O(|V|+|E|)
     * 
     * @param v
     * @param w
     */
    checkEdge(this: DirectedGraph<V>, v: V, w: V): boolean {
        const stack: V[] = [w];
        const visited = new Set<V>();
        while (stack.length !== 0) {
            const x = stack.pop() as V;
            if (x === v) {
                return true;
            } else if (!visited.has(x)) {
                for (const succ of this.getDirectSuccessors(x)) {
                    stack.push(succ);
                }
            }
        }
        return false;
    };

    /**
     * Add an edge going from v to w
     * 
     * Runtime: O(1)
     * 
     * @param v
     * @param w
     */
    addEdge(this: DirectedGraph<V>, v: V, w: V): void {
        this._fromDict.get(v)!.add(w);
        this._toDict.get(w)!.add(v);
    };

    /**
     * If an edge exists from v to w, remove it
     * Return whether or not an edge was removed
     * 
     * Runtime: O(1)
     * 
     * @param v
     * @param w
     */
    removeEdge(this: DirectedGraph<V>, v: V, w: V): void {
        this._fromDict.get(v)!.delete(w);
        this._toDict.get(w)!.delete(v);
    };

    /**
     * Get the lengths of the shortest path from the given
     * source vertex to every other vertex
     * 
     * Runtime: O(|V|+|E|)
     * 
     * @param source
     */
    getShortestPaths(this: DirectedGraph<V>, source: V): Map<V, number> {
        // Breadth first traversal from source
        const lengths = new Map<V, number>([[source, 0]]);
        const queue: V[] = [source];
        while (queue.length !== 0) {
            const v = queue.pop() as V;
            for (const w of this._fromDict.get(v)!) {
                if (!lengths.has(w)) {
                    lengths.set(w, lengths.get(v)! + 1);
                    queue.unshift(w);
                }
            }
        }
        // Set unreachable vertices to infinity
        for (const v of this._fromDict.keys()!) {
            if (!lengths.has(v)) {
                lengths.set(v, Infinity);
            }
        }
        return lengths;
    };

    /**
     * Implements Tarjan's strongly connected components algorithm:
     * https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
     * Returns components in topologically sorted order
     * 
     * Runtime: O(|V|+|E|)
     */
    getStronglyConnectedComponents(this: DirectedGraph<V>): Set<V>[] {
        const unvisited = new Set<V>(this._fromDict.keys());
        const stack: V[] = [];
        const vertexDict = new Map<V, [number, number, boolean, number]>();
        let index = 0;
        const scComponents: Set<V>[] = [];
        // const dagEdges: [V, V][] = []

        // Helper function to perform depth first search
        const helper = (v: V): void => {
            stack.push(v);
            vertexDict.set(v, [index, index, true, NaN]);  // Hold index, lowlink, onstack status, and component index
            index += 1;

            // Visit every vertex that v has an edge going to
            for (const w of this._fromDict.get(v)!) {
                let wasUnvisited = false;
                if (unvisited.has(w)) {
                    unvisited.delete(w);
                    helper(w);
                    wasUnvisited = true;
                }

                // Update lowlink value depending on whether w as already visited and on the stack
                const [vIndex, vLowlink,,] = vertexDict.get(v)!;
                const [wIndex, wLowlink, wOnstack,] = vertexDict.get(w)!;
                if (wasUnvisited) {
                    vertexDict.set(v, [vIndex, Math.min(vLowlink, wLowlink), true, NaN]);
                } else if (wOnstack) {
                    vertexDict.set(v, [vIndex, Math.min(vLowlink, wIndex), true, NaN]);
                }
                // } else {
                //     dagEdges.push([v, w])
                // }
            }

            // Pop vertices into a component
            const [vIndex, vLowlink,,] = vertexDict.get(v)!;
            if (vIndex === vLowlink) {
                const compIndex = scComponents.length;
                const component = new Set<V>();

                // Pop from the stack until the popped vertex is the current vertex
                let w: V;
                do {
                    w = stack.pop() as V;
                    const [wIndex, wLowlink,,] = vertexDict.get(w)!;
                    vertexDict.set(w, [wIndex, wLowlink, false, compIndex]);
                    component.add(w);
                } while (w !== v)
                scComponents.unshift(component);
            }
        };

        // Ensure that every vertex is put into a component
        while (unvisited.size !== 0) {
            const v = Array.from(unvisited)[unvisited.size-1];
            unvisited.delete(v);
            helper(v);
        }

        // // Turn the graph into a DAG
        // const dag = new DirectedGraph<Set<V>>()
        // for (const component of scComponents) {
        //     dag.addVertex(component)
        // }
        // for (const [v, w] of dagEdges) {
        //     const [,,, vCompIndex] = vertexDict.get(v)!
        //     const [,,, wCompIndex] = vertexDict.get(w)!
        //     dag.addEdge(scComponents[vCompIndex], scComponents[wCompIndex])
        // }

        return scComponents;
    };

    /**
     * Get an order for the graph that respects dependencies given a source
     * Also return a list of vertices whose outgoing edges were cut to create the order
     * 
     * Runtime: O(|V|^2+|E|^2)
     *     Worst-case occurs when the graph is complete,
     *     i.e. every vertex has an edge going to and from
     *     every other vertex. In that case, each
     *     recursive call adds a single vertex to the
     *     final order and performs Tarjan's algorithm on
     *     the graph formed by the remaining vertices.
     * 
     * @param source
     */
    getOrder(this: DirectedGraph<V>, source: V): [V[], [V, V][]] {
        const order: V[] = [];
        const cutEdges: [V, V][] = [];
        const shortestPaths = this.getShortestPaths(source);
        for (const component of this.getStronglyConnectedComponents()) {
            if (component.size === 1) {
                const v = component.values().next().value as V;
                order.push(v);
                if (this._toDict.get(v)!.has(v)) {
                    cutEdges.push([v, v]);
                }
            } else {
                // Create directed graph from a component
                const g = new DirectedGraph<V>();

                // Add vertices and find closest one
                let closest = component.values().next().value as V;  // The component's closest vertex to the source
                for (const v of component) {
                    if (shortestPaths.get(v)! < shortestPaths.get(closest)!) {
                        closest = v;
                    }
                    g.addVertex(v);
                }

                // Add edges and keep track of cut edges (i.e. edges leaving the component)
                for (const w of component) {
                    for (const v of this._toDict.get(w)!) {
                        if (component.has(v)) {
                            if (w !== closest) {
                                g.addEdge(v, w);
                            } else {
                                cutEdges.push([v, w]);
                            }
                        }
                    }
                }

                // Get order of component and append it to the total order
                const [recOrder, recCutEdges] = g.getOrder(closest)
                for (const v of recOrder) {
                    order.push(v);
                }
                for (const edge of recCutEdges) {
                    cutEdges.push(edge);
                }
            }
        }
        return [order, cutEdges];
    };

    /**
     * Use the cut_edges returned by get_order to remove cycles
     * 
     * @param source
     */
    removeCycles(this: DirectedGraph<V>, source: V): [DirectedGraph<V>, V[]] {
        const [order, cutEdges] = this.getOrder(source);
        const acyclic = this.copy();
        for (const [v, w] of cutEdges) {
            acyclic.removeEdge(v, w);
        }
        return [acyclic, order];
    };

    /**
     * Put the vertices into layers
     * 
     * @param source
     */
    getLayers(this: DirectedGraph<V>, source: V): Map<V, number> {
        const [acyclic, order] = this.removeCycles(source);

        const rank = new Map<V, number>();  // Rank values for each vertex
        for (const v of acyclic._fromDict.keys()) {  // Initialize all ranks to 0
            rank.set(v, 0);
        }

        // Iterate over the vertices in topological order
        for (const [i, w] of order.entries()) {
            // Find the maximum rank of the predecessors of the current node
            let maxRank = -1;

            // Keep the source always below every other node, even if they are at the same layer
            const predecessors = acyclic.getDirectPredecessors(w);
            if (i === 1) {
                predecessors.add(source);
            }
            for (const v of predecessors) {
                maxRank = Math.max(maxRank, rank.get(v)!);
            }

            // Set the rank of the current node to one more than the maximum rank
            rank.set(w, maxRank + 1);
        }

        return rank;
    };

    /**
     * Get the direct successors of v
     * 
     * @param v
     */
    getDirectSuccessors(this: DirectedGraph<V>, v: V): Set<V> {
        return this._fromDict.get(v)!;
    };

    /**
     * Get the direct predecessors of v
     * 
     * @param v
     */
    getDirectPredecessors(this: DirectedGraph<V>, v: V): Set<V> {
        return this._toDict.get(v)!;
    };

    /**
     * Get all successors of v
     * 
     * @param v
     */
    getAllSuccessors(this: DirectedGraph<V>, v: V): Set<V> {
        const oldV = v;

        // Depth first traversal from v
        const successors = new Set<V>([v]);
        const stack: V[] = [v];
        while (stack.length !== 0) {
            const v = stack.pop() as V;
            for (const w of this._fromDict.get(v)!) {
                if (!successors.has(w)) {
                    successors.add(w);
                    stack.push(w);
                }
            }
        }

        successors.delete(oldV);
        return successors;
    };

    /**
     * Get all predecessors of v
     * 
     * @param v
     */
    getAllPredecessors(this: DirectedGraph<V>, v: V): Set<V> {
        const oldV = v;

        // Depth first traversal from v
        const predecessors = new Set<V>([v]);
        const stack: V[] = [v];
        while (stack.length !== 0) {
            const v = stack.pop() as V;
            for (const w of this._toDict.get(v)!) {
                if (!predecessors.has(w)) {
                    predecessors.add(w);
                    stack.push(w);
                }
            }
        }

        predecessors.delete(oldV);
        return predecessors;
    };

    /**
     * Create a shallow copy of the graph
     */
    copy(this: DirectedGraph<V>): any {
        const copy = new DirectedGraph<V>();
        for (const v of this._fromDict.keys()) {
            copy.addVertex(v);
        }
        for (const [v, W] of this._fromDict) {
            for (const w of W) {
                copy.addEdge(v, w);
            }
        }
        return copy;
    };

    /**
     * Print a simplified representation of the directed graph
     */
    toString(this: DirectedGraph<V>): string {
        const removeNewlines = (s: string) => s.replace(/(\r\n|\n|\r)/gm, "");
        let s = "{";
        if (this._fromDict.size !== 0) {
            for (const v of this._fromDict.keys()) {
                s += `${removeNewlines(String(v))}: {`;
                if (this._fromDict.get(v)!.size !== 0) {
                    for (const w of this._fromDict.get(v)!) {
                        s += `${removeNewlines(String(w))}, `;
                    }
                    s = s.substring(0, s.length - 2);
                }
                s += "},\n ";
            }
            s = s.substring(0, s.length - 3);
        }
        s += "}";
        return s;
    };

    toJSON(this: DirectedGraph<V>): Exclude<JSONValue, JSONSerializable> {
        const vertexSerializedList: JSONValue[] = [];
        const edgeDict: {[id: number]: number[]} = {};
        const obj: {"/DirectedGraph": [JSONValue[], {[id: number]: number[]}]} = {"/DirectedGraph": [vertexSerializedList, edgeDict]};
        const vertexMap = new Map<V, number>();
        for (const v of this._fromDict.keys()) {
            const vSerial: JSONValue = tsJSON.isJSONSerializable(v) ? v.toJSON() : v;
            vertexMap.set(v, vertexSerializedList.length);
            vertexSerializedList.push(vSerial);
        }
        for (const [v, W] of this._fromDict) {
            const vIdx = vertexMap.get(v)!;
            for (const w of W) {
                const wIdx = vertexMap.get(w)!;
                if (edgeDict[vIdx] === undefined) {
                    edgeDict[vIdx] = [];
                }
                edgeDict[vIdx].push(wIdx);
            }
        }
        return obj;
    };

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`DirectedGraph reviver: ${msg}`);
    }

    static getReviver<V extends JSONValue>(this: void, vReviver: JSONReviver<V>): JSONReviver<DirectedGraph<V>> {
        const reviver: JSONReviver<DirectedGraph<V>> = function(this, key, value) {
            if (tsJSON.isJSONObj(value) && value["/DirectedGraph"] !== undefined) {
                const graphObj = value["/DirectedGraph"];
                if (!tsJSON.isJSONArray(graphObj)) throw DirectedGraph.JSONSyntaxError("expected an array as top level object");
                if (!tsJSON.isJSONArray(graphObj[0])) throw DirectedGraph.JSONSyntaxError("expected an array at index 0 as vertex list");
                if (!tsJSON.isJSONObj(graphObj[1])) throw DirectedGraph.JSONSyntaxError("expected an object at index 1 as edges dict");
                const vertexSerializedList = graphObj[0];  // Serialized vertices
                const edgeDict = graphObj[1];  // Dictionary of edges
                const vertexList: V[] = [];  // Deserialized vertices
                const graph = new DirectedGraph<V>();  // The graph to create

                // Add all vertices
                for (const [i, vSerial] of vertexSerializedList.entries()) {
                    const v: V = vReviver.bind(value)(String(i), vSerial) as V;
                    graph.addVertex(v);
                    vertexList.push(v);
                }

                // Add all edges
                for (const i in edgeDict) {
                    if (!Number.isInteger(Number(i))) throw DirectedGraph.JSONSyntaxError("expected an integer as a key in edge dict");
                    const J = edgeDict[i];
                    if (!tsJSON.isJSONArray(J)) throw DirectedGraph.JSONSyntaxError("expected an array as a value in edge dict");
                    for (const j of J) {
                        if (!Number.isInteger(Number(j))) throw DirectedGraph.JSONSyntaxError("expected an integer as an element in values of edge dict");
                        graph.addEdge(vertexList[Number(i)], vertexList[Number(j)]);
                    }
                }
                return graph;
            } else {
                return value;
            }
        };
        return reviver;
    };
}

export default DirectedGraph;