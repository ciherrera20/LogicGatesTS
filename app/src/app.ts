import DirectedGraph from "utils/graph"

const g = DirectedGraph<string>()
g.addVertex("A")
g.addVertex("B")
g.addVertex("C")
g.addVertex("D")
g.addVertex("E")
g.addVertex("F")
g.addVertex("G")
g.addVertex("H")
g.addEdge("A", "E")
g.addEdge("B", "A")
g.addEdge("C", "B")
g.addEdge("C", "D")
g.addEdge("D", "C")
g.addEdge("E", "B")
g.addEdge("F", "B")
g.addEdge("F", "E")
g.addEdge("F", "G")
g.addEdge("G", "C")
g.addEdge("G", "F")
g.addEdge("H", "D")
g.addEdge("H", "G")
g.addEdge("H", "H")
console.log(String(g))

declare global {
    var DirectedGraph: {<V>(this: void): DirectedGraph<V>}
    var g: DirectedGraph<string>
}
globalThis.DirectedGraph = DirectedGraph
globalThis.g = g