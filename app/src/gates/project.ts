import DirectedGraph from "gates/utils/graph";
import tsJSON, { JSONValue, JSONObj, JSONSerializable, JSONReviver } from "gates/utils/serialize";
import Gate, { GateDim, GateUID } from "gates/gate";
import Constant from "gates/builtins/constant";
import Datetime from "gates/builtins/datetime";
import Nand from "gates/builtins/nand";
import Reshaper from "gates/builtins/reshaper";
import Sink from "gates/builtins/sink";
import Source from "gates/builtins/source";
import { GateDefinition } from "gates/gate_definition";

class Project implements JSONSerializable {
    static BUILTIN_GATES: Map<string, typeof Gate> = new Map()

    name: string;
    _definitions: Map<string, GateDefinition>;
    _dependencyGraph: DirectedGraph<string>;

    constructor(name: string) {
        this.name = name;
        this._definitions = new Map();
        this._dependencyGraph = new DirectedGraph();
        for (const name of Project.BUILTIN_GATES.keys()) {
            this._dependencyGraph.addVertex(name);
        }
    }

    getGateNames(this: Project): string[] {
        return Array.from(this._definitions.keys());
    }

    define(this: Project, name: string, inputDims: GateDim[] = [], outputDims: GateDim[] = [], inputLabels?: string[], outputLabels?: string[]): GateDefinition {
        if (Project.BUILTIN_GATES.has(name) || this._definitions.has(name)) {
            throw new Error(`${name} already exists`);
        }
        this._dependencyGraph.addVertex(name);
        const definition = new GateDefinition(name, this, inputDims, outputDims, inputLabels, outputLabels);
        this._definitions.set(name, definition);
        return definition;
    }

    deleteDefinition(this: Project, name: string, force: boolean = false) {
        if (Project.BUILTIN_GATES.has(name)) {
            throw new Error(`Cannot delete ${name}`)
        } else if (!this._definitions.has(name)) {
            throw new Error(`${name} does not exist`);
        } else {
            const predecessors = this._dependencyGraph.getDirectPredecessors(name);
            if (predecessors.size !== 0) {
                if (!force) {
                    console.warn(`Other definitions depend on ${name}`)
                }
            }

            // Remove all instances of the deleted definition from the definitions that depended on it
            for (const predecessor of predecessors) {
                this._definitions.get(predecessor)!.removeGateType(name);
            }
            this._definitions.delete(name);
            this._dependencyGraph.removeVertex(name);
        }
    }

    renameDefinition(this: Project, name: string, newName: string) {
        if (Project.BUILTIN_GATES.has(name)) {
            throw new Error(`Cannot rename ${name}`);
        } else if (!this._definitions.has(name)) {
            throw new Error(`${name} does not exist`);
        } else if (Project.BUILTIN_GATES.has(newName), this._definitions.has(newName)) {
            throw new Error(`${newName} already exists`);
        } else {
            const definition = this._definitions.get(name)!;

            // Replace the old name with the new one in the definitions that depend on it
            const predecessors = this._dependencyGraph.getDirectPredecessors(name);
            for (const predecessor of predecessors) {
                const predDefinition = this._definitions.get(predecessor);
                if (predDefinition === undefined) {
                    throw new Error(`Could not find ${predecessor} in registered definitions. Project is inconsistent!`);
                }
                predDefinition.renameGateType(name, newName);
            }
            this._definitions.set(newName, definition);
            this._definitions.delete(name);

            // This is the disgusting part where we have to replace the vertex in the dependency graph with a new one with the new name
            const successors = this._dependencyGraph.getDirectSuccessors(name);
            this._dependencyGraph.addVertex(newName);
            for (const predecessor of predecessors) {
                this._dependencyGraph.addEdge(predecessor, newName);
            }
            for (const successor of successors) {
                this._dependencyGraph.addEdge(newName, successor);
            }
            this._dependencyGraph.removeVertex(name);

            // Finally, set the definition's name to the new name
            definition.name = newName;
        }
    }

    _checkDependency(this: Project, fromType: string, toType: string): boolean {
        return this._dependencyGraph.checkEdge(fromType, toType);
    }

    _addDependency(this: Project, fromType: string, toType: string) {
        this._dependencyGraph.addEdge(fromType, toType);
    }

    _removeDependency(this: Project, fromType: string, toType: string) {
        this._dependencyGraph.removeEdge(fromType, toType);
    }

    _getDependencies(this: Project, definition: GateDefinition): GateDefinition[] {
        return Array.from(this._dependencyGraph.getDirectSuccessors(definition.name)).map(
            (successor) => {
                const succDefinition = this._definitions.get(successor);
                if (succDefinition === undefined) {
                    throw new Error(`Could not find ${successor} in registered definitions. Project is inconsistent!`);
                }
                return succDefinition;
            }
        );
    }

    _getDependees(this: Project, definition: GateDefinition): GateDefinition[] {
        return Array.from(this._dependencyGraph.getDirectPredecessors(definition.name)).map(
            (predecessor) => {
                const predDefinition = this._definitions.get(predecessor);
                if (predDefinition === undefined) {
                    throw new Error(`Could not find ${predecessor} in registered definitions. Project is inconsistent!`);
                }
                return predDefinition;
            }
        );
    }

    _runOnDependees(this: Project, definition: GateDefinition, proc: (definition: GateDefinition, acc: GateDefinition[]) => void, acc: GateDefinition[] = []) {
        for (const dependee of this._getDependees(definition)) {
            proc(dependee, acc.concat([definition]));
            this._runOnDependees(dependee, proc, acc.concat([definition]));
        }
    }

    _insertedInput(this: Project, definition: GateDefinition, idx: number) {
        for (const dependee of this._getDependees(definition)) {
            dependee._insertedInput(definition, idx);
        }
    }

    _insertedOutput(this: Project, definition: GateDefinition, idx: number) {
        this._runOnDependees(definition, (definition, acc) => {
            definition._insertedOutput(acc, idx);
        });
    }

    _removedInput(this: Project, definition: GateDefinition, idx: number) {
        for (const dependee of this._getDependees(definition)) {
            dependee._removedInput(definition, idx);
        }
    }

    _removedOutput(this: Project, definition: GateDefinition, idx: number) {
        this._runOnDependees(definition, (definition, acc) => {
            definition._removedOutput(acc, idx);
        });
    }

    _removeUid(this: Project, definition: GateDefinition, uid: GateUID) {
        this._runOnDependees(definition, (definition, acc) => {
            definition._removeUid(acc, uid);
        });
    }

    _repairInstances(this: Project, definition: GateDefinition) {
        this._runOnDependees(definition, (definition, acc) => {
            definition._repairInstances(acc);
        });
    }

    has(this: Project, name: string): boolean {
        return Project.BUILTIN_GATES.has(name) || this._definitions.has(name);
    }

    get(this: Project, name: string): GateDefinition | typeof Gate | undefined {
        if (Project.BUILTIN_GATES.has(name)) {
            return Project.BUILTIN_GATES.get(name)!;
        } else {
            return this._definitions.get(name);
        }
    }

    static isBuiltin(value: GateDefinition | typeof Gate): value is typeof Gate {
        return Project.BUILTIN_GATES.has(value.name);
    }

    toJSON() {
        const definitions: JSONObj = {};
        for (const [name, definition] of this._definitions) {
            definitions[name] = definition;
        }

        return {"/Project": {
            "name": this.name,
            "dependencyGraph": this._dependencyGraph,
            "definitions": definitions
        }};
    }

    static JSONSyntaxError(msg: string): SyntaxError {
        return new SyntaxError(`Project reviver: ${msg}`);
    }

    static reviver: JSONReviver<Project> = function(this, key, value) {
        if (tsJSON.isJSONObj(value) && value["/Project"] !== undefined) {
            const gates = new Map<number, Gate>();
            const obj = value["/Project"];
            if (!tsJSON.isJSONObj(obj)) throw Project.JSONSyntaxError("expected an object as top level object");
            if (typeof obj["name"] !== "string") throw Project.JSONSyntaxError("expected a string as name");
            if (!tsJSON.isJSONObj(obj["dependencyGraph"])) throw Project.JSONSyntaxError("expected an object as dependency graph");
            if (!tsJSON.isJSONObj(obj["definitions"])) throw Project.JSONSyntaxError("expected an object as definitions dict");
            const project = new Project(obj["name"]);
            const dependencyGraph = DirectedGraph.getReviver<string>((k, v) => v).bind(obj)("dependencyGraph", obj["dependencyGraph"]) as DirectedGraph<string>;
            const order = dependencyGraph.getOrder("NAND")[0];
            for (const gateType of order.reverse()) {
                if (!project.has(gateType)) {
                    project._dependencyGraph.addVertex(gateType);
                    const definition = GateDefinition.getReviver(project, gates).bind(obj["definitions"])("gateType", obj["definitions"][gateType]) as GateDefinition;
                    project._definitions.set(gateType, definition);
                }
            }
            return project;
        } else {
            return value;
        }
    }
}

// Register builtin gates
Project.BUILTIN_GATES.set("NAND", Nand);
Project.BUILTIN_GATES.set("Reshaper", Reshaper);
Project.BUILTIN_GATES.set("Constant", Constant);
Project.BUILTIN_GATES.set("Datetime", Datetime);
Project.BUILTIN_GATES.set("Source", Source);
Project.BUILTIN_GATES.set("Sink", Sink);

export default Project;