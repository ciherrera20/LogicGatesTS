export default DirectedGraph;
const directedGraphProto = Object.create(null);
function DirectedGraph() {
    let graph = Object.create(directedGraphProto);
    graph._fromDict = new Map(); // v -> w for all w in W
    graph._toDict = new Map(); // w -> v for all w in W
    return graph;
}
/**
 * Add vertex v to the graph if it is not already in it
 *
 * Runtime: O(1)
 *
 * @param v
 */
directedGraphProto.addVertex = function addVertex(v) {
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
directedGraphProto.removeVertex = function removeVertex(v) {
    for (const w of this._fromDict.get(v)) {
        this._toDict.get(w).delete(v);
    }
    for (const w of this._toDict.get(v)) {
        this._fromDict.get(w).delete(v);
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
directedGraphProto.checkEdge = function checkEdge(v, w) {
    const stack = [w];
    const visited = new Set();
    while (stack.length !== 0) {
        const x = stack.pop();
        if (x === v) {
            return true;
        }
        else if (!visited.has(x)) {
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
directedGraphProto.addEdge = function addEdge(v, w) {
    this._fromDict.get(v).add(w);
    this._toDict.get(w).add(v);
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
directedGraphProto.removeEdge = function removeEdge(v, w) {
    return this._fromDict.get(v).delete(w) || this._toDict.get(w).delete(v);
};
/**
 * Get the lengths of the shortest path from the given
 * source vertex to every other vertex
 *
 * Runtime: O(|V|+|E|)
 *
 * @param source
 */
directedGraphProto.getShortestPaths = function getShortestPaths(source) {
    // Breadth first traversal from source
    const lengths = new Map([[source, 0]]);
    const queue = [source];
    while (queue.length !== 0) {
        const v = queue.pop();
        for (const w of this._fromDict.get(v)) {
            if (!lengths.has(w)) {
                lengths.set(w, lengths.get(v) + 1);
                queue.unshift(w);
            }
        }
    }
    // Set unreachable vertices to infinity
    for (const v of this._fromDict.keys()) {
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
directedGraphProto.getStronglyConnectedComponents = function getStronglyConnectedComponents() {
    const unvisited = new Set(this._fromDict.keys());
    const stack = [];
    const vertexDict = new Map();
    let index = 0;
    const scComponents = [];
    // const dagEdges: [V, V][] = []
    // Helper function to perform depth first search
    const helper = (v) => {
        console.log("Current stack:", stack);
        stack.push(v);
        vertexDict.set(v, [index, index, true, NaN]); // Hold index, lowlink, onstack status, and component index
        index += 1;
        // Visit every vertex that v has an edge going to
        for (const w of this._fromDict.get(v)) {
            let wasUnvisited = false;
            if (unvisited.has(w)) {
                unvisited.delete(w);
                helper(w);
                wasUnvisited = true;
            }
            // Update lowlink value depending on whether w as already visited and on the stack
            const [vIndex, vLowlink, ,] = vertexDict.get(v);
            const [wIndex, wLowlink, wOnstack,] = vertexDict.get(w);
            if (wasUnvisited) {
                vertexDict.set(v, [vIndex, Math.min(vLowlink, wLowlink), true, NaN]);
            }
            else if (wOnstack) {
                vertexDict.set(v, [vIndex, Math.min(vLowlink, wIndex), true, NaN]);
            }
            // } else {
            //     dagEdges.push([v, w])
            // }
        }
        // Pop vertices into a component
        const [vIndex, vLowlink, ,] = vertexDict.get(v);
        if (vIndex === vLowlink) {
            const compIndex = scComponents.length;
            const component = new Set();
            // Pop from the stack until the popped vertex is the current vertex
            let w;
            do {
                w = stack.pop();
                const [wIndex, wLowlink, ,] = vertexDict.get(w);
                vertexDict.set(w, [wIndex, wLowlink, false, compIndex]);
                component.add(w);
            } while (w !== v);
            scComponents.unshift(component);
        }
    };
    // Ensure that every vertex is put into a component
    while (unvisited.size !== 0) {
        const v = unvisited.values().next().value;
        unvisited.delete(v);
        helper(v);
    }
    // // Turn the graph into a DAG
    // const dag = DirectedGraph<Set<V>>()
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
directedGraphProto.getOrder = function getOrder(source) {
    const order = [];
    const cutEdges = [];
    const shortestPaths = this.getShortestPaths(source);
    for (const component of this.getStronglyConnectedComponents()) {
        if (component.size === 1) {
            const v = component.values().next().value;
            order.push(v);
            if (this._toDict.get(v).has(v)) {
                cutEdges.push([v, v]);
            }
        }
        else {
            console.log("Current component is", component);
            // Create directed graph from a component
            const g = DirectedGraph();
            // Add vertices and find closest one
            let closest = component.values().next().value; // The component's closest vertex to the source
            for (const v of component) {
                if (shortestPaths.get(v) < shortestPaths.get(closest)) {
                    closest = v;
                }
                g.addVertex(v);
            }
            // Add edges and keep track of cut edges (i.e. edges leaving the component)
            for (const w of component) {
                for (const v of this._toDict.get(w)) {
                    if (component.has(v)) {
                        if (w !== closest) {
                            g.addEdge(v, w);
                        }
                        else {
                            cutEdges.push([v, w]);
                        }
                    }
                }
            }
            // Get order of component and append it to the total order
            const [recOrder, recCutEdges] = g.getOrder(closest);
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
directedGraphProto.removeCycles = function removeCycles(source) {
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
directedGraphProto.getLayers = function getLayers(source) {
    const [acyclic, order] = this.removeCycles(source);
    const rank = new Map(); // Rank values for each vertex
    for (const v of acyclic._fromDict.keys()) { // Initialize all ranks to 0
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
            if (rank.get(v) > maxRank) {
                maxRank = rank.get(v);
            }
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
directedGraphProto.getDirectSuccessors = function getDirectSuccessors(v) {
    return this._fromDict.get(v);
};
/**
 * Get the direct predecessors of v
 *
 * @param v
 */
directedGraphProto.getDirectPredecessors = function getDirectPredecessors(v) {
    return this._toDict.get(v);
};
/**
 * Get all successors of v
 *
 * @param v
 */
directedGraphProto.getAllSuccessors = function getAllSuccessors(v) {
    const oldV = v;
    // Depth first traversal from v
    const successors = new Set([v]);
    const stack = [v];
    while (stack.length !== 0) {
        const v = stack.pop();
        for (const w of this._fromDict.get(v)) {
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
directedGraphProto.getAllPredecessors = function getAllPredecessors(v) {
    const oldV = v;
    // Depth first traversal from v
    const predecessors = new Set([v]);
    const stack = [v];
    while (stack.length !== 0) {
        const v = stack.pop();
        for (const w of this._toDict.get(v)) {
            if (!predecessors.has(w)) {
                predecessors.add(w);
                stack.push(w);
            }
        }
    }
    predecessors.delete(oldV);
    return predecessors;
};
// /**
//  * Turn into a serializable object
//  */
// directedGraphProto.serialize = function serialize<V>(this: DirectedGraph<V>): any {
//     const obj: any = {}
//     for (const [v, W] of this._fromDict) {
//         obj[v] = []
//         for (const w of W) {
//             obj[v].push(w)
//         }
//     }
//     return obj
// }
/**
 * Copy the graph
 */
directedGraphProto.copy = function copy() {
    const copy = DirectedGraph();
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
directedGraphProto.toString = function toString() {
    let s = "{";
    if (this._fromDict.size !== 0) {
        for (const v of this._fromDict.keys()) {
            s += `${v}: {`;
            if (this._fromDict.get(v).size !== 0) {
                for (const w of this._fromDict.get(v)) {
                    s += `${w}, `;
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
// DirectedGraph.deserialize = function deserialize<V>(this: void, obj: any): DirectedGraph<V> {
//     const graph = DirectedGraph<V>()
//     for (const v in obj) {
//     }
//     return graph
// }
