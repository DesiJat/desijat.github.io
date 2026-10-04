# Zetameld Interactive Graphs

Welcome to the Zetameld visualizer suite! This `code-graph` directory contains two fully interactive tools built with **Cytoscape.js** that allow you to analyze your codebase from different perspectives.

Both tools run entirely locally in your browser.

---

## 1. Code Architecture Graph (`analyzer.ts`)
This tool statically analyzes your TypeScript and JavaScript codebase using the TypeScript Compiler API (`ts-morph`) to generate an interactive dependency graph of your files and function calls.

**Features:**
- **Visual Mapping**: See exactly how your files and functions are connected.
- **Deep Signatures**: Hover over functions to see their parameters and return types.
- **Call Tracing**: Click on any function to highlight who calls it and what it depends on.

### How to use:
1. **Generate the graph data:**
   Scan your desired folder (it recursively finds all `.ts` and `.js` files, ignoring `node_modules` and build folders).
   ```bash
   cd code-graph
   
   # Scan a specific app
   npx tsx analyzer.ts ../apps/web
   
   # Scan a completely different project anywhere on your system
   npx tsx analyzer.ts /home/poonam/data/demo/src
   ```
2. **View the Graph:**
   Serve the public folder and open `index.html`.
   ```bash
   cd code-graph/public
   npx serve -p 8081
   ```
   Navigate to **http://localhost:8081**

> [!TIP]
> If you run out of memory when analyzing massive codebases, use: `NODE_OPTIONS="--max-old-space-size=8192" npx tsx analyzer.ts ./your/path`

---

## 2. File System Size Graph (`folder-analyzer.ts`)
This tool acts as a visual replacement for standard directory tree scripts (like `tree-size.sh`). It crawls your filesystem to calculate exact byte sizes of every folder and file, ignoring predefined heavy directories like `node_modules`.

**Features:**
- **Dynamic Sizing**: The physical radius of each file's circle on the graph is scaled logarithmically based on its byte size (large files look huge, tiny scripts look small).
- **Color Coding**: Files are color-coded based on their extension (TypeScript = Blue, Scripts = Green, JSON = Black, etc).
- **Interactive Drill-Down**: Click and hover to see exact paths and exact byte sizes for folders and files.

### How to use:
1. **Generate the folder data:**
   Scan your desired directory to calculate sizes.
   ```bash
   cd code-graph
   
   # Scan a specific folder
   npx tsx folder-analyzer.ts ../apps/web
   
   # Scan a completely different folder anywhere on your system
   npx tsx folder-analyzer.ts /home/poonam/data/demo
   ```
2. **View the Graph:**
   Serve the public folder and open `folder-graph.html`.
   ```bash
   cd code-graph/public
   npx serve -p 8081
   ```
   Navigate to **http://localhost:8081/folder-graph.html**

---

## Quick Command Reference

Here is a quick copy-paste block of all the commands you need:

```bash
# ----------------------------------------------------
# 1. RUNNING THE CODE AST ANALYZER
# ----------------------------------------------------
cd code-graph 
npx tsx analyzer.ts ../apps/web

# ----------------------------------------------------
# 2. RUNNING THE FILE SYSTEM SIZE ANALYZER
# ----------------------------------------------------
cd code-graph
npx tsx folder-analyzer.ts ../apps/web

# ----------------------------------------------------
# 3. STARTING THE VIEWER UI SERVER
# ----------------------------------------------------
cd code-graph
npx tsx server.ts
```

This will spin up the backend API and host the User Interface at `http://localhost:8081`. 
Open that URL in your browser!

> **New Feature!** You can now trigger new analyses directly from the web UI! Just type an absolute folder path into the sidebar and click **Analyze New Folder**. The backend server will automatically run the analyzer scripts and refresh the graphs!

## The Visualizers

1. **Code Graph (`index.html`)**: A beautiful dependency graph showing how your functions and files interact.
2. **File System Graph (`folder-graph.html`)**: A bubble graph showing the relative byte sizes of files inside their parent directories.
3. **Directory Tree (`tree-view.html`)**: A sleek, hierarchical file explorer view showing exact byte sizes and copy path functionality.
4. **User Guide (`guide.html`)**: This exact markdown documentation rendered beautifully in HTML.

```bash
openssl req -nodes -new -x509 -keyout key.pem -out cert.pem -days 365 -subj "/CN=localhost"
```