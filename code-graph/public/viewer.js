document.addEventListener('DOMContentLoaded', async () => {
    // Register fcose layout
    cytoscape.use(cytoscapeFcose);

    try {
        const response = await fetch('graph-data.json');
        if (!response.ok) throw new Error("Failed to load graph-data.json");
        const data = await response.json();
        const elements = data.elements || data; // Fallback to raw array if old format
        
        // Show project path if available
        if (data.projectPath) {
            document.getElementById('project-path').textContent = `Root: ${data.projectPath}`;
        }

        const themes = {
            light: {
                fileBg: '#f8fafc', fileBorder: '#94a3b8', fileText: '#0f172a',
                funcBg: '#e0e7ff', funcBorder: '#6366f1', funcText: '#3730a3',
                edge: '#cbd5e1', highlightBg: '#ef4444', highlightText: '#ffffff'
            },
            dark: {
                fileBg: '#1e293b', fileBorder: '#475569', fileText: '#f1f5f9',
                funcBg: '#312e81', funcBorder: '#6366f1', funcText: '#c7d2fe',
                edge: '#475569', highlightBg: '#facc15', highlightText: '#000000'
            },
            'e-paper': {
                fileBg: '#f4f1ea', fileBorder: '#5a5a5a', fileText: '#2b2b2b',
                funcBg: '#e0dcd2', funcBorder: '#2b2b2b', funcText: '#2b2b2b',
                edge: '#999999', highlightBg: '#2b2b2b', highlightText: '#f4f1ea'
            }
        };

        function getStyle(themeName) {
            const t = themes[themeName] || themes.light;
            return [
                {
                    selector: 'node[type="file"]',
                    style: {
                        'label': 'data(label)',
                        'shape': 'round-rectangle',
                        'background-color': t.fileBg,
                        'border-width': 1.5,
                        'border-color': t.fileBorder,
                        'font-size': '14px',
                        'font-family': 'Inter',
                        'font-weight': '600',
                        'color': t.fileText,
                        'text-valign': 'top',
                        'text-halign': 'center',
                        'padding': '16px'
                    }
                },
                {
                    selector: 'node[type="function"]',
                    style: {
                        'label': 'data(label)',
                        'shape': 'round-rectangle',
                        'background-color': t.funcBg,
                        'border-width': 1.5,
                        'border-color': t.funcBorder,
                        'color': t.funcText,
                        'font-family': 'Inter',
                        'font-size': '12px',
                        'font-weight': '600',
                        'width': 'label',
                        'height': 'label',
                        'padding': '10px 14px',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'border-radius': '6px'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 1.5,
                        'line-color': t.edge,
                        'target-arrow-color': t.edge,
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'arrow-scale': 1.2
                    }
                },
                {
                    selector: '.highlighted',
                    style: {
                        'background-color': t.highlightBg,
                        'line-color': t.highlightBg,
                        'target-arrow-color': t.highlightBg,
                        'color': t.highlightText,
                        'border-color': t.highlightBg,
                        'transition-property': 'background-color, line-color, target-arrow-color, color, border-color',
                        'transition-duration': '0.3s'
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
                padding: 50,
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
            
            if (data.type === 'file') {
                titleEl.textContent = `File: ${data.label}`;
                contentEl.innerHTML = `
                    <div class="detail-row">
                        <div class="detail-label">Path</div>
                        <div class="detail-value">${data.fullPath}</div>
                    </div>
                `;
            } else if (data.type === 'function') {
                titleEl.textContent = `Function: ${data.label}`;
                
                const parent = cy.getElementById(data.parent);
                const filePath = parent.length ? parent.data('fullPath') : 'Unknown';

                contentEl.innerHTML = `
                    <div class="detail-row">
                        <div class="detail-label">File</div>
                        <div class="detail-value">${filePath}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Parameters (Input)</div>
                        <div class="detail-value">${data.params || '()'}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Return Type (Output)</div>
                        <div class="detail-value">${data.returnType || 'void'}</div>
                    </div>
                `;
            }
        }

        // Hover interaction
        cy.on('mouseover', 'node', function(e) {
            const node = e.target;
            document.body.style.cursor = 'pointer';
            updateDetailsPanel(node);
        });

        cy.on('mouseout', 'node', function(e) {
            document.body.style.cursor = 'default';
        });

        // Click interaction (highlight connections)
        cy.on('tap', 'node', function(e) {
            const node = e.target;
            
            // Only highlight if it's a function (or file, but usually function is better)
            cy.elements().removeClass('highlighted faded');
            
            if (node.data('type') === 'function') {
                const connectedEdges = node.connectedEdges();
                const connectedNodes = connectedEdges.connectedNodes();
                
                cy.elements().addClass('faded');
                node.removeClass('faded').addClass('highlighted');
                connectedEdges.removeClass('faded').addClass('highlighted');
                connectedNodes.removeClass('faded'); // keep original color for connected nodes
            }
            
            updateDetailsPanel(node);
        });

        // Click background to reset
        cy.on('tap', function(e) {
            if (e.target === cy) {
                resetView();
            }
        });

        resetBtn.addEventListener('click', resetView);

        function resetView() {
            cy.elements().removeClass('highlighted faded');
            titleEl.textContent = 'Select a Node';
            contentEl.innerHTML = 'Hover or click on a node to view its parameters, return types, and file path.';
            cy.fit();
        }

    } catch (err) {
        document.getElementById('cy').innerHTML = `<div style="padding: 20px; color: red;">Error loading graph: ${err.message}<br>Make sure you have run the analyzer script to generate graph-data.json and are serving this file through a local web server (e.g. <code>npx serve</code>).</div>`;
    }
});
