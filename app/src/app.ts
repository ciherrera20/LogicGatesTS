import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "utils/serialize";
import DirectedGraph from "utils/graph";

const g = new DirectedGraph<string>();
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

class StringWrapper implements JSONSerializable {
    constructor(public myString: string) {
        this.myString = myString;
    }
    say(this: StringWrapper) {
        console.log(`Hello, I am ${this.myString}`);
    }
    toString(this: StringWrapper): string {
        return `StringWrapper(${this.myString})`;
    }
    toJSON(this: StringWrapper): Exclude<JSONValue, JSONSerializable> {
        return {"/StringWrapper": this.myString};
    }
    static JSONSyntaxError(msg: string) {
        new SyntaxError(`StringWrapper reviver: ${msg}`);
    }
    static getReviver(): JSONReviver<StringWrapper> {
        const reviver: JSONReviver<StringWrapper> = function(this, key, value) {
            if (tsJSON.isJSONObj(value) && value["/StringWrapper"] !== undefined) {
                const stringWrapperObj = value["/StringWrapper"];
                if (typeof stringWrapperObj !== "string") throw new SyntaxError("expected a string as top level object");
                return new StringWrapper(stringWrapperObj);
            } else {
                return value;
            }
        }
        return reviver;
    }
}

let sw = new StringWrapper("A");

const h = new DirectedGraph<StringWrapper>();
h.addVertex(sw);
h.addEdge(sw, sw);

declare global {
    var DirectedGraph: any;
    var g: DirectedGraph<string>;
    var tsJSON: tsJSON;
    var StringWrapper: any;
    var sw: StringWrapper;
    var h: DirectedGraph<StringWrapper>;
}
globalThis.DirectedGraph = DirectedGraph;
globalThis.g = g;
globalThis.tsJSON = tsJSON;
globalThis.StringWrapper = StringWrapper;
globalThis.sw = sw;
globalThis.h = h;