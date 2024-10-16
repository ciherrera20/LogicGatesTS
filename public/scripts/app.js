import { tsJSON } from "utils/serialize";
import DirectedGraph from "utils/graph";
const g = DirectedGraph();
g.addVertex("A");
g.addVertex("B");
g.addVertex("C");
g.addVertex("D");
g.addVertex("E");
g.addVertex("F");
g.addVertex("G");
g.addVertex("H");
g.addEdge("A", "E");
g.addEdge("B", "A");
g.addEdge("C", "B");
g.addEdge("C", "D");
g.addEdge("D", "C");
g.addEdge("E", "B");
g.addEdge("F", "B");
g.addEdge("F", "E");
g.addEdge("F", "G");
g.addEdge("G", "C");
g.addEdge("G", "F");
g.addEdge("H", "D");
g.addEdge("H", "G");
g.addEdge("H", "H");
console.log(String(g));
class StringWrapper {
    constructor(myString) {
        this.myString = myString;
        this.myString = myString;
    }
    say() {
        console.log(`Hello, I am ${this.myString}`);
    }
    toString() {
        return `StringWrapper(${this.myString})`;
    }
    toJSON() {
        return `__StringWrapper:${this.myString}`;
    }
    static getReviver() {
        function reviver(key, value) {
            console.log("This:");
            console.log(this);
            console.log("Key:");
            console.log(key);
            console.log("Value:");
            console.log(value);
            if (typeof value === "string" && value.substring(0, 16) === "__StringWrapper:") {
                return new StringWrapper(value.substring(16));
            }
            else {
                return value;
            }
        }
        return reviver;
    }
}
// function StringWrapper(this: StringWrapper, s: string) {
//     this.myString = s
// }
// StringWrapper.prototype.say = function say(this) {
//     console.log(`Hello, I am ${this.myString}`)
// }
// StringWrapper.prototype.toJSON = function toJSON(this) {
//     return `__StringWrapper:${this.myString}`
// }
let sw = new StringWrapper("A");
const h = DirectedGraph();
h.addVertex(sw);
h.addEdge(sw, sw);
globalThis.DirectedGraph = DirectedGraph;
globalThis.g = g;
globalThis.tsJSON = tsJSON;
globalThis.StringWrapper = StringWrapper;
globalThis.sw = sw;
globalThis.h = h;
