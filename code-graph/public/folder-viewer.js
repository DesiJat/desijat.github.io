document.addEventListener('DOMContentLoaded', async () => {
    // Register fcose layout
    cytoscape.use(cytoscapeFcose);

    try {
        const response = await fetch('folder-data.json');
        if (!response.ok) throw new Error("Failed to load folder-data.json");
        const data = await response.json();
        const elements = data.elements || data; // Fallback to raw array if old format
        
        // Show project path if available
        if (data.projectPath) {
            document.getElementById('project-path').textContent = `Root: ${data.projectPath}`;
        }

        // Calculate size mapping
        // We use a logarithmic scale so massive files don't completely eclipse tiny ones
        // but still appear visually larger.
        let minSize = Infinity;
        let maxSize = 0;
        
        elements.forEach(el => {
            if (el.data.type === 'file' && el.data.size !== undefined) {
                if (el.data.size < minSize) minSize = el.data.size;
                if (el.data.size > maxSize) maxSize = el.data.size;
            }
        });

        const minVisualSize = 15;
        const maxVisualSize = 80;

        function getVisualSize(byteSize) {
            if (byteSize === 0) return minVisualSize;
            if (minSize === maxSize) return minVisualSize;
            
            // Log scale
            const logMin = Math.log(Math.max(1, minSize));
            const logMax = Math.log(maxSize);
            const logVal = Math.log(Math.max(1, byteSize));
            
            const ratio = (logVal - logMin) / (logMax - logMin);
            return minVisualSize + (ratio * (maxVisualSize - minVisualSize));
        }

        // Color mapping for extensions
        function getColorForExtension(ext) {
            const colors = {
                '.ts': '#3178c6',
                '.tsx': '#3178c6',
                '.js': '#f7df1e',
                '.jsx': '#f7df1e',
                '.json': '#000000',
                '.md': '#ffffff',
                '.css': '#264de4',
                '.html': '#e34c26',
                '.png': '#10b981',
                '.svg': '#10b981',
                '.jpg': '#10b981',
                '.yml': '#cb171e',
                '.yaml': '#cb171e',
                '.sh': '#4EAA25'
            };
            return colors[ext] || '#94a3b8'; // Default grey
        }

        // Map elements to include visual sizes and colors
        elements.forEach(el => {
            if (el.data.type === 'file') {
                el.data.visualSize = getVisualSize(el.data.size);
                el.data.color = getColorForExtension(el.data.ext);
                // Darken text outline if background is bright
                el.data.textColor = (el.data.ext === '.js' || el.data.ext === '.jsx' || el.data.ext === '.md') ? '#000' : '#fff';
            }
        });

        const themes = {
            light: {
                folderBg: '#f8fafc', folderBorder: '#94a3b8', folderText: '#0f172a',
                fileBg: 'data(color)', fileText: 'data(textColor)', fileBorder: 'data(color)',
                highlightBg: '#ef4444', highlightBorder: '#ef4444', highlightText: '#ffffff'
            },
            dark: {
                folderBg: '#1e293b', folderBorder: '#475569', folderText: '#f1f5f9',
                fileBg: 'data(color)', fileText: 'data(textColor)', fileBorder: 'data(color)',
                highlightBg: '#facc15', highlightBorder: '#facc15', highlightText: '#000000'
            },
            'e-paper': {
                folderBg: '#f4f1ea', folderBorder: '#5a5a5a', folderText: '#2b2b2b',
                fileBg: '#e0dcd2', fileText: '#2b2b2b', fileBorder: '#2b2b2b',
                highlightBg: '#2b2b2b', highlightBorder: '#2b2b2b', highlightText: '#f4f1ea'
            }
        };

        function getStyle(themeName) {
            const t = themes[themeName] || themes.light;
            return [
                {
                    selector: 'node[type="folder"]',
                    style: {
                        'label': 'data(label)',
                        'shape': 'round-rectangle',
                        'background-color': t.folderBg,
                        'border-width': 1.5,
                        'border-color': t.folderBorder,
                        'font-size': '16px',
                        'font-family': 'Inter',
                        'font-weight': '600',
                        'color': t.folderText,
                        'text-valign': 'top',
                        'text-halign': 'center',
                        'padding': '16px'
                    }
                },
                {
                    selector: 'node[type="file"]',
                    style: {
                        'label': 'data(label)',
                        'shape': 'ellipse',
                        'background-color': t.fileBg,
                        'color': t.fileText,
                        'font-family': 'Inter',
                        'text-outline-color': t.fileBg,
                        'text-outline-width': 1.5,
                        'font-size': '12px',
                        'font-weight': '600',
                        'width': 'data(visualSize)',
                        'height': 'data(visualSize)',
                        'text-valign': 'center',
                        'text-halign': 'center'
                    }
                },
                {
                    selector: '.highlighted',
                    style: {
                        'background-color': t.highlightBg,
                        'border-color': t.highlightBorder,
                        'color': t.highlightText,
                        'text-outline-color': t.highlightBg,
                        'transition-property': 'background-color, border-color, color, text-outline-color',
                        'transition-duration': '0.2s'
                    }
                },
                {
                    selector: '.faded',
                    style: {
                        'opacity': 0.1,
                        'transition-property': 'opacity',
                        'transition-duration': '0.3s'
                    }
                }
            ];
        }

        const cy = cytoscape({
            container: document.getElementById('cy'),
            elements: elements,
            style: getStyle(document.documentElement.getAttribute('data-theme') || 'light'),
            layout: {
                name: 'fcose',
                animate: false,
                randomize: true,
                padding: 30,
                nodeDimensionsIncludeLabels: true,
                packComponents: true
            }
        });

        // UI Elements
        const titleEl = document.getElementById('panel-title');
        const contentEl = document.getElementById('panel-content');
        const resetBtn = document.getElementById('reset-btn');
        const themeSelector = document.getElementById('theme-selector');

        // Theme switcher logic
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
            // Update Cytoscape colors
            cy.style(getStyle(newTheme));
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

        function updateDetailsPanel(node) {
            const data = node.data();
            
            if (data.type === 'folder') {
                titleEl.textContent = `Folder: ${data.label}`;
                contentEl.innerHTML = `
                    <div class="detail-row">
                        <div class="detail-label">Path</div>
                        <div class="detail-value">${data.fullPath}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Total Size</div>
                        <div class="detail-value">${data.humanSize || '0B'}</div>
                    </div>
                `;
            } else if (data.type === 'file') {
                titleEl.textContent = `File: ${data.label}`;
                contentEl.innerHTML = `
                    <div class="detail-row">
                        <div class="detail-label">Path</div>
                        <div class="detail-value">${data.fullPath}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">File Type</div>
                        <div class="detail-value">${data.ext || 'unknown'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Size</div>
                        <div class="detail-value">${data.humanSize} (${data.size.toLocaleString()} bytes)</div>
                    </div>
                `;
            }
        }

        // Hover interaction
        cy.on('mouseover', 'node', function(e) {
            const node = e.target;
            document.body.style.cursor = 'pointer';
            updateDetailsPanel(node);
            
            // Highlight node and its parents
            cy.elements().removeClass('highlighted');
            node.addClass('highlighted');
            node.ancestors().addClass('highlighted');
        });

        cy.on('mouseout', 'node', function(e) {
            document.body.style.cursor = 'default';
            cy.elements().removeClass('highlighted');
        });

        resetBtn.addEventListener('click', resetView);

        function resetView() {
            cy.elements().removeClass('highlighted faded');
            titleEl.textContent = 'Select a Node';
            contentEl.innerHTML = 'Hover or click on a node to view its size and absolute path.';
            cy.fit();
        }

    } catch (err) {
        document.getElementById('cy').innerHTML = `<div style="padding: 20px; color: red;">Error loading graph: ${err.message}<br>Make sure you have run the folder-analyzer script to generate folder-data.json and are serving this file through a local web server (e.g. <code>npx serve</code>).</div>`;
    }
});
