document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('markdown-content');
    const themeSelector = document.getElementById('theme-selector');

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
        // Fetch the local README.md (via the symlink we created)
        const response = await fetch('README.md');
        if (!response.ok) {
            throw new Error(`Failed to load README.md (${response.status} ${response.statusText})`);
        }
        const markdownText = await response.text();
        
        // Parse markdown to HTML
        container.innerHTML = marked.parse(markdownText);

        // Inject Copy Buttons into code blocks
        const codeBlocks = container.querySelectorAll('pre');
        
        codeBlocks.forEach((pre) => {
            // Create a wrapper to position the copy button inside the pre block
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            
            // Move the pre into the wrapper
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);

            // Create the copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'markdown-copy-btn';
            copyBtn.innerHTML = 'Copy';
            copyBtn.title = 'Copy to clipboard';

            copyBtn.addEventListener('click', () => {
                const codeText = pre.innerText;
                navigator.clipboard.writeText(codeText).then(() => {
                    const originalText = copyBtn.innerHTML;
                    copyBtn.innerHTML = 'Copied!';
                    copyBtn.classList.add('copied');
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = originalText;
                        copyBtn.classList.remove('copied');
                    }, 2000);
                });
            });

            wrapper.appendChild(copyBtn);
        });

    } catch (err) {
        container.innerHTML = `
            <div style="padding: 20px; color: red;">
                <h2>Error loading Guide</h2>
                <p>${err.message}</p>
                <p>Ensure that the symlink <code>public/README.md</code> exists and points to the actual README file.</p>
            </div>
        `;
    }
});
