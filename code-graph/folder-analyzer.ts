import * as fs from 'fs';
import * as path from 'path';

// Configuration
const EXCLUDES = new Set([
    '.git', '.github', 'node_modules', 'dist', 'build', '.next', '.cache', 'coverage', '.idea', '.vscode'
]);
const MAX_DEPTH = 5; // Configurable max depth to prevent massive graphs

const targetPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../apps');
const outPath = path.resolve(__dirname, 'public/folder-data.json');

console.log(`Analyzing folder structure starting at: ${targetPath}`);

const elements: any[] = [];
let idCounter = 0;

function humanSize(bytes: number): string {
    if (bytes >= 1099511627776) return (bytes / 1099511627776).toFixed(1) + 'T';
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + 'G';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + 'M';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'K';
    return bytes + 'B';
}

function shouldExclude(name: string) {
    return EXCLUDES.has(name);
}

function processDirectory(dirPath: string, parentId: string | null = null, depth: number = 0): number {
    if (depth > MAX_DEPTH) return 0;
    
    let totalSize = 0;
    let items;
    
    try {
        items = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
        console.warn(`Could not read directory ${dirPath}`);
        return 0;
    }

    const currentDirId = `dir_${++idCounter}`;
    const dirName = path.basename(dirPath) || dirPath;
    
    // Add compound node for this directory
    elements.push({
        data: {
            id: currentDirId,
            label: dirName,
            type: 'folder',
            parent: parentId,
            fullPath: dirPath
        }
    });

    for (const item of items) {
        if (shouldExclude(item.name)) continue;
        
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
            const size = processDirectory(fullPath, currentDirId, depth + 1);
            totalSize += size;
        } else if (item.isFile()) {
            try {
                const stat = fs.statSync(fullPath);
                const size = stat.size;
                totalSize += size;
                
                // Add file node
                const fileId = `file_${++idCounter}`;
                const ext = path.extname(item.name).toLowerCase();
                
                elements.push({
                    data: {
                        id: fileId,
                        label: item.name,
                        type: 'file',
                        ext: ext,
                        size: size,
                        humanSize: humanSize(size),
                        parent: currentDirId,
                        fullPath: fullPath
                    }
                });
            } catch (err) {
                // skip if unreadable
            }
        }
    }

    // Update the directory node with its total size
    const dirNode = elements.find(el => el.data.id === currentDirId);
    if (dirNode) {
        dirNode.data.size = totalSize;
        dirNode.data.humanSize = humanSize(totalSize);
    }

    return totalSize;
}

console.log("Crawling file system...");
// Check if target is a file or dir
const stats = fs.statSync(targetPath);
if (stats.isDirectory()) {
    processDirectory(targetPath, null, 0);
}

console.log(`Writing graph data to ${outPath}...`);
fs.writeFileSync(outPath, JSON.stringify({
    projectPath: targetPath,
    elements: elements
}, null, 2));
console.log("Done!");
