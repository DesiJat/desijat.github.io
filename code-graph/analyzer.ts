import { Project, Node, CallExpression, SyntaxKind, FunctionDeclaration, MethodDeclaration, VariableDeclaration } from "ts-morph";
import * as fs from "fs";
import * as path from "path";


const projectPath = process.argv[2] || path.resolve(__dirname, "../");
console.log(`Project path: ${projectPath}`);
const outPath = path.resolve(__dirname, "public/graph-data.json");

console.log("Initializing ts-morph project...");
const project = new Project({
    compilerOptions: {
        target: 9, // ScriptTarget.ES2022
        module: 1, // ModuleKind.CommonJS
        allowJs: true,
        jsx: 1, // JsxEmit.Preserve
    },
    skipAddingFilesFromTsConfig: true
});

// Add all source files we care about (excluding node_modules and build folders)
console.log("Adding source files...");
project.addSourceFilesAtPaths([
    path.join(projectPath, "**/*.ts"),
    path.join(projectPath, "**/*.tsx"),
    path.join(projectPath, "**/*.js"),
    path.join(projectPath, "**/*.jsx"),
    "!" + path.join(projectPath, "**/node_modules/**"),
    "!" + path.join(projectPath, "**/.next/**"),
    "!" + path.join(projectPath, "**/dist/**"),
    "!" + path.join(projectPath, "**/build/**")
]);

const files = project.getSourceFiles();
console.log(`Found ${files.length} files to analyze.`);

const elements: any[] = [];
const nodeIds = new Set<string>();

function addNode(id: string, data: any) {
    if (!nodeIds.has(id)) {
        nodeIds.add(id);
        elements.push({ data: { id, ...data } });
    }
}

// 1. Add all File nodes
files.forEach(file => {
    const filePath = file.getFilePath().replace(projectPath, "");
    addNode(filePath, { label: path.basename(filePath), type: "file", fullPath: filePath });
});

// Map to keep track of function nodes so we can link calls
// Key: Node object reference, Value: Node ID in graph
const functionNodeMap = new Map<Node, string>();

let funcCounter = 0;

// Helper to extract param strings and return types
function getFunctionSignature(node: any) {
    let params = "";
    let returnType = "any";
    try {
        if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node) || Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
            params = node.getParameters().map(p => `${p.getName()}: ${p.getType().getText()}`).join(", ");
            returnType = node.getReturnType().getText();
        }
    } catch (e) {
        // Fallback for parsing errors
    }
    return { params: `(${params})`, returnType };
}

console.log("Extracting functions...");
files.forEach(file => {
    const filePath = file.getFilePath().replace(projectPath, "");
    
    // Find all functions in this file
    const functions = file.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
    const methods = file.getDescendantsOfKind(SyntaxKind.MethodDeclaration);
    
    // Arrow functions / expressions assigned to variables
    const variables = file.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
    const expressions: Node[] = [];
    variables.forEach(v => {
        const initializer = v.getInitializer();
        if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
            expressions.push(v);
        }
    });

    const allFuncs = [...functions, ...methods, ...expressions];

    allFuncs.forEach(func => {
        let name = "anonymous";
        if (Node.isFunctionDeclaration(func) || Node.isMethodDeclaration(func)) {
            name = func.getName() || "anonymous";
        } else if (Node.isVariableDeclaration(func)) {
            name = func.getName();
        }

        const id = `func_${++funcCounter}`;
        functionNodeMap.set(func, id);

        // Get signature from actual function node (initializer if it's a variable)
        const targetNodeForSig = Node.isVariableDeclaration(func) ? func.getInitializer()! : func;
        const { params, returnType } = getFunctionSignature(targetNodeForSig);

        addNode(id, {
            label: name,
            type: "function",
            parent: filePath,
            params,
            returnType
        });
    });
});

console.log("Analyzing function calls...");
// 2. Find function calls and link them
files.forEach(file => {
    const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
    
    calls.forEach(call => {
        try {
            // Find which function this call is inside of
            let callerNode: Node | undefined = call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) || 
                                               call.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ||
                                               call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
            
            // Validate the variable declaration is actually a function container
            if (callerNode && Node.isVariableDeclaration(callerNode)) {
                 const init = callerNode.getInitializer();
                 if (!init || (!Node.isArrowFunction(init) && !Node.isFunctionExpression(init))) {
                     callerNode = undefined;
                 }
            }

            if (!callerNode || !functionNodeMap.has(callerNode)) return;

            const callerId = functionNodeMap.get(callerNode);

            // Find the target function definition
            const symbol = call.getExpression().getSymbol() || call.getExpression().getType().getSymbol();
            if (symbol) {
                const declarations = symbol.getDeclarations();
                if (declarations && declarations.length > 0) {
                    const targetDecl = declarations[0];
                    if (functionNodeMap.has(targetDecl)) {
                        const targetId = functionNodeMap.get(targetDecl);
                        
                        // Create edge
                        elements.push({
                            data: {
                                id: `${callerId}_calls_${targetId}_${call.getStart()}`,
                                source: callerId,
                                target: targetId,
                                type: "call"
                            }
                        });
                    }
                }
            }
        } catch (e) {
            // Ignore errors in type resolution for external or complex dynamic calls
        }
    });
});

console.log(`Writing graph data to ${outPath}...`);
fs.writeFileSync(outPath, JSON.stringify({
    projectPath: projectPath,
    elements: elements
}, null, 2));
console.log("Done!");
