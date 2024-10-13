// /*
//  * Directed graph implementation using adjacency lists
//  */
// exports.DirectedGraph = function DirectedGraph() {
//     obj      = Object.create(directedGraphProto)
//     fromDict = new Map()  // Key: vertex; Value: set of vertices to which there are outgoing edges
//     toDict   = new Map()  // Key: vertex; Value: set of vertices to which there are incoming edges

//     /*
//      * Add vertex v to the graph if it is not already in it
//      */
//     obj.addVertex = function addVertex(v) {
//         if (!fromDict.has(v) && !toDict.has(v)) {
//             fromDict.set(v, new Map())
//             toDict.set(v, new Map())
//         }
//     }

//     return obj
// }

// // directedGraphProto = Object.create(null);

// // /*
// //  * 
// //  */
// // directedGraphProto.addVertex = function addVertex(v) {

// // }
