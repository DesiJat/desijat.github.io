document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('tree-container');
    const pathEl = document.getElementById('project-path');
    const themeSelector = document.getElementById('theme-selector');
    const expandBtn = document.getElementById('expand-all-btn');
    const collapseBtn = document.getElementById('collapse-all-btn');

    // Theme logic
    const savedTheme = localStorage.getItem('code-graph-theme') || 'light';
    themeSelector.value = savedTheme;
    themeSelector.addEventListener('change', (e) => {
        const newTheme = e.target.value;
        localStorage.setItem('code-graph-theme', newTheme);
        if (newTheme === 'light') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', newTheme);
        }
    });

    // Analysis API
    const analyzeBtn = document.getElementById('analyze-btn');
    const analyzePath = document.getElementById('analyze-path');
    if (analyzeBtn && analyzePath) {
        analyzeBtn.addEventListener('click', async () => {
            const targetPath = analyzePath.value.trim();
            if (!targetPath) {
                alert('Please enter a valid absolute path.');
                return;
            }
            
            const originalText = analyzeBtn.textContent;
            analyzeBtn.textContent = 'Analyzing...';
            analyzeBtn.disabled = true;
            analyzeBtn.style.opacity = '0.7';
            
            try {
                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: targetPath })
                });
                
                const result = await response.json();
                if (response.ok && result.success) {
                    location.reload();
                } else {
                    alert('Analysis failed: ' + (result.error || result.details || 'Unknown error'));
                }
            } catch (err) {
                alert('Failed to connect to backend. Are you running `npx tsx server.ts` instead of npx serve?');
            } finally {
                analyzeBtn.textContent = originalText;
                analyzeBtn.disabled = false;
                analyzeBtn.style.opacity = '1';
            }
        });
    }

    try {
        const response = await fetch('folder-data.json');
        if (!response.ok) throw new Error("Failed to load folder-data.json");
        const data = await response.json();
        
        const elements = data.elements || data;
        
        if (data.projectPath) {
            pathEl.textContent = `Root: ${data.projectPath}`;
        }

        // Upload Logic
        const uploadFileInput = document.createElement('input');
        uploadFileInput.type = 'file';
        uploadFileInput.multiple = true;
        uploadFileInput.style.display = 'none';

        const uploadFolderInput = document.createElement('input');
        uploadFolderInput.type = 'file';
        uploadFolderInput.webkitdirectory = true;
        uploadFolderInput.directory = true;
        uploadFolderInput.multiple = true;
        uploadFolderInput.style.display = 'none';

        document.body.appendChild(uploadFileInput);
        document.body.appendChild(uploadFolderInput);

        let currentUploadTarget = '';

        const handleUpload = async (files) => {
            if (!files || files.length === 0) return;

            const formData = new FormData();
            formData.append('targetPath', currentUploadTarget);
            
            const relativePaths = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const filename = file.webkitRelativePath || file.name;
                relativePaths.push(filename);
                formData.append('files', file, filename);
            }
            formData.append('relativePaths', JSON.stringify(relativePaths));

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const responseData = await res.json();
                if (responseData.success) {
                    alert('Success! ' + responseData.message + '\n\nPlease re-run the analyzer to see the new files.');
                } else {
                    alert('Upload failed: ' + responseData.error);
                }
            } catch (err) {
                alert('Upload Error: ' + err.message);
            }
        };

        uploadFileInput.addEventListener('change', (e) => {
            handleUpload(e.target.files);
            e.target.value = '';
        });

        uploadFolderInput.addEventListener('change', (e) => {
            handleUpload(e.target.files);
            e.target.value = '';
        });

        // Build tree hierarchy
        const rootNodes = [];
        const nodeMap = {};

        // Pass 1: Map all nodes
        elements.forEach(el => {
            nodeMap[el.data.id] = {
                ...el.data,
                children: []
            };
        });

        // Pass 2: Build tree structure
        elements.forEach(el => {
            const node = nodeMap[el.data.id];
            if (node.parent && nodeMap[node.parent]) {
                nodeMap[node.parent].children.push(node);
            } else {
                rootNodes.push(node);
            }
        });

        // Sort children: Folders first, then alphabetically
        function sortNodes(nodes) {
            nodes.sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                return a.label.localeCompare(b.label);
            });
            nodes.forEach(n => {
                if (n.children.length > 0) sortNodes(n.children);
            });
        }
        sortNodes(rootNodes);

        // Render DOM tree
        function renderTree(nodes, isRoot = false) {
            const ul = document.createElement('ul');
            ul.className = `tree-list ${isRoot ? 'root-list' : 'tree-children'}`;
            // By default, expand all
            if (!isRoot) ul.classList.add('open');

            nodes.forEach(node => {
                const li = document.createElement('li');
                li.className = 'tree-item';

                const row = document.createElement('div');
                row.className = `tree-row ${node.type === 'folder' ? 'folder' : 'file'}`;

                // Toggle Button (carot)
                const toggle = document.createElement('span');
                toggle.className = 'tree-toggle';
                if (node.type === 'folder' && node.children.length > 0) {
                    toggle.innerHTML = '▶';
                    toggle.classList.add('open');
                } else {
                    toggle.classList.add('empty');
                }

                // Icon
                const icon = document.createElement('span');
                icon.className = 'tree-icon';
                icon.innerHTML = node.type === 'folder' ? '📁' : '📄';

                // Label
                const label = document.createElement('span');
                label.className = 'tree-name';
                label.textContent = node.label;
                label.title = node.fullPath;

                // Size
                const size = document.createElement('span');
                size.className = 'tree-size';
                size.textContent = node.humanSize || '0B';

                // Copy Path Button
                const copyBtn = document.createElement('button');
                copyBtn.className = 'tree-copy-btn';
                copyBtn.innerHTML = '📋';
                copyBtn.title = 'Copy Absolute Path';
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(node.fullPath).then(() => {
                        const original = copyBtn.innerHTML;
                        copyBtn.innerHTML = '✅';
                        setTimeout(() => copyBtn.innerHTML = original, 1500);
                    });
                });

                // Download Button
                const downloadBtn = document.createElement('a');
                downloadBtn.className = 'tree-download-btn';
                downloadBtn.innerHTML = '⬇️';
                downloadBtn.title = node.type === 'folder' ? 'Download Folder as .zip' : 'Download File';
                downloadBtn.href = `/api/download?path=${encodeURIComponent(node.fullPath)}`;
                downloadBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent row click
                    // Don't prevent default, let the browser download
                    const original = downloadBtn.innerHTML;
                    downloadBtn.innerHTML = '⌛';
                    setTimeout(() => downloadBtn.innerHTML = original, 2000);
                });

                row.appendChild(toggle);
                row.appendChild(icon);
                row.appendChild(label);
                row.appendChild(size);
                row.appendChild(copyBtn);
                row.appendChild(downloadBtn);

                if (node.type === 'folder') {
                    // Upload File Button
                    const uploadFileBtn = document.createElement('button');
                    uploadFileBtn.className = 'tree-download-btn'; // reuse download btn styling
                    uploadFileBtn.innerHTML = '📄⬆️';
                    uploadFileBtn.title = 'Upload File(s)';
                    uploadFileBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        currentUploadTarget = node.fullPath;
                        uploadFileInput.click();
                    });

                    // Upload Folder Button
                    const uploadFolderBtn = document.createElement('button');
                    uploadFolderBtn.className = 'tree-download-btn';
                    uploadFolderBtn.innerHTML = '📁⬆️';
                    uploadFolderBtn.title = 'Upload Folder';
                    uploadFolderBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        currentUploadTarget = node.fullPath;
                        uploadFolderInput.click();
                    });

                    row.appendChild(uploadFileBtn);
                    row.appendChild(uploadFolderBtn);
                }

                li.appendChild(row);

                if (node.type === 'file') {
                    row.addEventListener('click', (e) => {
                        e.stopPropagation();
                        document.querySelectorAll('.tree-row.selected').forEach(el => el.classList.remove('selected'));
                        row.classList.add('selected');
                        previewFile(node.fullPath, node.label);
                    });
                }

                if (node.children.length > 0) {
                    const childrenUl = renderTree(node.children);
                    li.appendChild(childrenUl);

                    // Toggle logic
                    row.addEventListener('click', (e) => {
                        e.stopPropagation();
                        childrenUl.classList.toggle('open');
                        toggle.classList.toggle('open');
                        icon.innerHTML = childrenUl.classList.contains('open') ? '📂' : '📁';
                    });
                    
                    // Initial state for icon
                    icon.innerHTML = '📂'; 
                }

                ul.appendChild(li);
            });

            return ul;
        }

        container.appendChild(renderTree(rootNodes, true));

        // Expand/Collapse logic
        expandBtn.addEventListener('click', () => {
            document.querySelectorAll('.tree-children').forEach(el => el.classList.add('open'));
            document.querySelectorAll('.tree-toggle:not(.empty)').forEach(el => el.classList.add('open'));
            document.querySelectorAll('.tree-row.folder .tree-icon').forEach(el => el.innerHTML = '📂');
        });

        collapseBtn.addEventListener('click', () => {
            document.querySelectorAll('.tree-children').forEach(el => el.classList.remove('open'));
            document.querySelectorAll('.tree-toggle:not(.empty)').forEach(el => el.classList.remove('open'));
            document.querySelectorAll('.tree-row.folder .tree-icon').forEach(el => el.innerHTML = '📁');
        });

    } catch (err) {
        container.innerHTML = `<div style="padding: 20px; color: red;">Error loading tree: ${err.message}<br>Make sure you have run the folder-analyzer script first.</div>`;
    }
    function previewFile(fullPath, filename) {
        const header = document.getElementById('preview-filename');
        const content = document.getElementById('preview-content');
        
        header.textContent = filename;
        content.innerHTML = '<div style="color: var(--text-muted); font-size: 14px;">Loading...</div>';

        const ext = filename.split('.').pop().toLowerCase();
        const url = `/api/file?path=${encodeURIComponent(fullPath)}`;

        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico', 'heic'];
        const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'];
        const audioExts = ['mp3', 'wav', 'aac', 'ogg', 'wma', 'flac', 'm4a', 'mid'];
        const embedExts = ['pdf', 'html', 'htm'];
        
        // Known binary formats that shouldn't be read as text
        const binaryExts = ['doc', 'rtf', 'odt', 'xlsx', 'xls', 'pptx', 'ppt', 'epub', 'pages', 'numbers', 'key', 'psd', 'ai', 'eps', 'zip', 'tar', 'gz', 'rar', 'exe', 'bin'];

        if (imageExts.includes(ext)) {
            content.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
        } else if (videoExts.includes(ext)) {
            content.innerHTML = `<video controls src="${url}" style="max-width: 100%; max-height: 100%;"></video>`;
        } else if (audioExts.includes(ext)) {
            content.innerHTML = `<audio controls src="${url}"></audio>`;
        } else if (embedExts.includes(ext)) {
            content.innerHTML = `<iframe src="${url}" style="width: 100%; height: 100%; border: none; background: white;"></iframe>`;
        } else if (ext === 'docx') {
            if (typeof mammoth !== 'undefined') {
                fetch(url)
                    .then(res => {
                        if (!res.ok) throw new Error('File not readable');
                        return res.arrayBuffer();
                    })
                    .then(buffer => {
                        return mammoth.convertToHtml({arrayBuffer: buffer});
                    })
                    .then(result => {
                        content.innerHTML = `<div style="background: white; color: black; padding: 24px; width: 100%; height: 100%; overflow: auto; box-sizing: border-box; font-family: sans-serif; line-height: 1.6;">${result.value}</div>`;
                    })
                    .catch(err => {
                        content.innerHTML = `<div style="color: red; font-size: 14px;">Preview not available<br><span style="font-size:12px;color:var(--text-muted)">${err.message}</span></div>`;
                    });
            } else {
                content.innerHTML = `<div style="color: var(--text-muted); font-size: 14px;">.docx preview requires internet connection to load mammoth.js</div>`;
            }
        } else if (binaryExts.includes(ext)) {
            content.innerHTML = `
                <div style="text-align: center; color: var(--text-muted);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Binary Format</div>
                    <div style="font-size: 13px;">Cannot preview .${ext} files natively in the browser.<br>Please open this file in its native application.</div>
                </div>
            `;
        } else {
            // Text / Code fallback (handles js, ts, css, json, xml, yaml, php, py, sh, sql, csv, md, txt, etc.)
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error('File not readable');
                    return res.text();
                })
                .then(text => {
                    const escapeHtml = (unsafe) => unsafe
                         .replace(/&/g, "&amp;")
                         .replace(/</g, "&lt;")
                         .replace(/>/g, "&gt;")
                         .replace(/"/g, "&quot;")
                         .replace(/'/g, "&#039;");
                    content.innerHTML = `<pre><code>${escapeHtml(text)}</code></pre>`;
                })
                .catch(err => {
                    content.innerHTML = `<div style="color: red; font-size: 14px;">Preview not available<br><span style="font-size:12px;color:var(--text-muted)">${err.message}</span></div>`;
                });
        }
    }
});
