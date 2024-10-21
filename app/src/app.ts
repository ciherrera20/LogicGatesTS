import tsJSON, { JSONValue, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import DirectedGraph from "gates/utils/graph";
import Constant from "gates/builtins/constant";
import Datetime from "gates/builtins/datetime";
import Nand from "gates/builtins/nand";
import Reshaper from "gates/builtins/reshaper";
import Sink from "gates/builtins/sink";
import Source from "gates/builtins/source";
import GateDefinition from "gates/gate_definition";
import Project from "gates/project";

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
    toJSON(this: StringWrapper): JSONValue {
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
    var Constant: any;
    var Datetime: any;
    var Nand: any;
    var Reshaper: any;
    var Sink: any;
    var Source: any;
    var GateDefinition: any;
    var Project: any;
}
globalThis.DirectedGraph = DirectedGraph;
globalThis.g = g;
globalThis.tsJSON = tsJSON;
globalThis.StringWrapper = StringWrapper;
globalThis.sw = sw;
globalThis.h = h;
globalThis.Constant = Constant;
globalThis.Datetime = Datetime;
globalThis.Nand = Nand;
globalThis.Reshaper = Reshaper;
globalThis.Sink = Sink;
globalThis.Source = Source;
globalThis.GateDefinition = GateDefinition;
globalThis.Project = Project;

// let p = new Project("Test");
// let nand = Nand.create();
// let NotDefinition = p.define("Not", [1], [1]);
// NotDefinition.addGate(nand);
// NotDefinition.tieInputTo(0, [0, nand]);
// NotDefinition.tieInputTo(0, [1, nand]);
// NotDefinition.tieOutputTo([nand, 0], 0);
// let not = NotDefinition.create();
// let ClockDefinition = p.define("Clock", [], [1]);
// ClockDefinition.addGate(not);
// ClockDefinition.addConnection([not, 0], [0, not]);
// ClockDefinition.tieOutputTo([not, 0], 0);
// let clock = ClockDefinition.create();
