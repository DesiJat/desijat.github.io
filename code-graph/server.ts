import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ZipArchive } from 'archiver';
import https from 'https';
import os from 'os';
import multer from 'multer';

const app = express();
const port = 8081;

// Use memory storage for Multer to manually handle directory recreation
const upload = multer({ storage: multer.memoryStorage() });

const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

app.use(cors());
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/analyze', (req, res) => {
    const targetPath = req.body.path;

    if (!targetPath) {
        return res.status(400).json({ error: 'Target path is required.' });
    }

    console.log(`\n[Analyzer API] Received request to analyze: ${targetPath}`);
    
    // Command to run both analyzers sequentially
    const cmd = `npx tsx analyzer.ts "${targetPath}" && npx tsx folder-analyzer.ts "${targetPath}"`;
    
    console.log(`[Analyzer API] Executing: ${cmd}`);

    exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Analyzer API] Execution Error: ${error.message}`);
            return res.status(500).json({ error: 'Failed to run analyzers.', details: error.message });
        }
        if (stderr && !stderr.includes('Debugger attached')) {
            console.error(`[Analyzer API] Stderr: ${stderr}`);
        }
        
        console.log(`[Analyzer API] Analysis complete for: ${targetPath}`);
        res.json({ success: true, message: 'Analysis generated successfully.' });
    });
});

app.get('/api/file', (req, res) => {
    const targetPath = req.query.path as string;

    if (!targetPath) {
        return res.status(400).send('File path is required');
    }

    try {
        // We use res.sendFile to let Express automatically handle MIME types and streaming
        res.sendFile(targetPath, { dotfiles: 'allow' }, (err) => {
            if (err) {
                console.error(`[Analyzer API] Error serving file ${targetPath}:`, err.message);
                if (!res.headersSent) {
                    res.status(404).send('File not found or unreadable');
                }
            }
        });
    } catch (err) {
        res.status(500).send('Failed to serve file');
    }
});

app.get('/api/download', (req, res) => {
    const targetPath = req.query.path as string;

    if (!targetPath) {
        return res.status(400).send('File or folder path is required');
    }

    try {
        const stats = fs.statSync(targetPath);
        const name = path.basename(targetPath);

        if (stats.isDirectory()) {
            // Stream folder as a zip
            res.attachment(`${name}.zip`);
            const archive = new ZipArchive({ zlib: { level: 5 } }); // Level 5 for speed vs compression balance

            archive.on('error', (err: Error) => {
                console.error(`[Analyzer API] Archiver error: ${err.message}`);
                if (!res.headersSent) res.status(500).send({ error: err.message });
            });

            archive.pipe(res);
            archive.directory(targetPath, false);
            archive.finalize();
        } else {
            // Trigger native file download
            res.download(targetPath, name, { dotfiles: 'allow' }, (err) => {
                if (err) {
                    console.error(`[Analyzer API] Download error:`, err.message);
                    if (!res.headersSent) res.status(404).send('File not found or unreadable');
                }
            });
        }
    } catch (err: any) {
        console.error(`[Analyzer API] Failed to initiate download: ${err.message}`);
        if (!res.headersSent) {
            res.status(500).send('Failed to initiate download');
        }
    }
});

app.post('/api/upload', upload.array('files'), (req, res) => {
    const targetPath = req.body.targetPath;

    if (!targetPath) {
        return res.status(400).send({ error: 'targetPath is required' });
    }

    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).send({ error: 'No files were uploaded' });
    }

    try {
        const files = req.files as Express.Multer.File[];
        const relativePaths = req.body.relativePaths ? JSON.parse(req.body.relativePaths) : [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // Use the explicit relative path provided by the frontend if available
            const originalPath = relativePaths[i] || file.originalname;
            
            // SECURITY PRECAUTION: Prevent directory traversal attacks using ".."
            const safeRelativePath = path.normalize(originalPath).replace(/^(\.\.(\/|\\|$))+/, '');
            const fullFilePath = path.join(targetPath, safeRelativePath);
            
            // Recreate all parent directories as needed
            fs.mkdirSync(path.dirname(fullFilePath), { recursive: true });
            
            // Write the file to disk safely
            fs.writeFileSync(fullFilePath, file.buffer);
        }

        console.log(`[Analyzer API] Successfully uploaded ${files.length} file(s) to ${targetPath}`);
        res.json({ success: true, message: `Uploaded ${files.length} file(s) successfully.` });
    } catch (err: any) {
        console.error(`[Analyzer API] Upload failed: ${err.message}`);
        res.status(500).send({ error: 'Upload failed', details: err.message });
    }
});

// Fallback to index.html for UI routing (though we just have static HTML pages)
app.use((req, res) => {
    // Basic static fallback if someone types a clean url without .html
    const fallbackPath = path.join(__dirname, 'public', req.path + '.html');
    res.sendFile(fallbackPath, (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
    });
});

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        if (iface) {
            for (let i = 0; i < iface.length; i++) {
                const alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                    return alias.address;
                }
            }
        }
    }
    return '0.0.0.0';
}

https.createServer(sslOptions, app).listen(port, () => {
    const localIp = getLocalIpAddress();
    console.log('\n======================================================');
    console.log('🚀 Zetameld Analyzer Server running (HTTPS)!');
    console.log(`👉 Local:   https://localhost:${port}`);
    if (localIp !== '0.0.0.0') {
        console.log(`👉 Network: https://${localIp}:${port}`);
    }
    console.log('======================================================\n');
});
