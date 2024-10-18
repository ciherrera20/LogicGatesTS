import DirectedGraph from "utils/graph";
import Gate from "gates/gate";
import Constant from "gates/builtins/constant";
import Datetime from "gates/builtins/datetime";
import Nand from "gates/builtins/nand";
import Reshaper from "gates/builtins/reshaper";
import Sink from "gates/builtins/sink";
import Source from "gates/builtins/source";
import tsJSON, { JSONSerializable } from "gates/utils/serialize";

type Test = typeof Gate;

// class Project implements JSONSerializable {
//     name: string;
//     _definitions: Map<string, Gate>;
//     _dependencyGraph: DirectedGraph<string>;

//     consructor(name: string) {
//         this.name = name;
//         this._definitions = new Map([
//             ["Constant", Constant],
//             ["Datetime", Datetime],
//             // ["NAND", Nand],
//             // [""]
//         ]);
//         this._dependencyGraph = new DirectedGraph();
//     }

//     toJSON() {
//         return undefined;
//     }
// }

export default Project;