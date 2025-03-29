const OLLAMA_ENDPOINT = window.location.protocol + "//" + window.location.hostname + ":11434";
// const SYSTEM_PROMPT = `Ai assistant for user helping them learn English.`;
let SYSTEM_PROMPT = '';  // This will be dynamically set based on dropdown selection
let prompts = []; // Store the available system prompts

class ChatApp {
    constructor() {
        this.messageList = document.getElementById('messageList');
        this.chatForm = document.getElementById('chatForm');
        this.userInput = document.getElementById('userInput');
        this.modelSelect = document.getElementById('modelSelect');
        this.fileInput = document.getElementById('fileInput');
        this.documents = new Map();
        this.webpages = new Map();
        this.currentMessageId = 0;

        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files));
        this.saveButton = document.getElementById('saveButton');
        this.saveButton.addEventListener('click', () => this.saveConversation());

        this.loadModels();
        this.loadPrompts();  // Load the prompts from JSON
    }

    async loadPrompts() {
        try {
            // const response = await fetch('prompts.json');
            // const data = await response.json();
            // prompts = data.prompts;

            prompts = await promptsObjects.prompts;

            // Populate the dropdown with prompts
            const promptSelect = document.getElementById('promptSelect');
            prompts.forEach(prompt => {
                const option = document.createElement('option');
                option.value = prompt.prompt;
                option.textContent = prompt.name;
                promptSelect.appendChild(option);
            });

            // Set default system prompt
            if (prompts.length > 0) {
                SYSTEM_PROMPT = prompts[0].prompt;
            }

            // Listen for prompt selection changes
            promptSelect.addEventListener('change', (e) => {
                // console.log('SYSTEM_PROMPT:1', SYSTEM_PROMPT);
                SYSTEM_PROMPT = e.target.value;
                // console.log('SYSTEM_PROMPT:2', SYSTEM_PROMPT);
            });

        } catch (error) {
            console.error('Error loading prompts:', error);
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    async fetchWebpage(url) {
        try {
            const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            return data.contents;
        } catch (error) {
            console.error('Error fetching webpage:', error);
            throw error;
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const message = this.userInput.value.trim();
        if (!message) return;

        const messageId = this.currentMessageId++;
        this.addMessage(message, 'user', messageId);
        this.userInput.value = '';

        // Check if the message contains a URL
        if (this.isValidUrl(message)) {
            try {
                this.addMessage('Fetching webpage content...', 'system', this.currentMessageId++);
                const content = await this.fetchWebpage(message);
                this.webpages.set(message, content);
                this.addMessage(`Webpage content fetched successfully: ${message}`, 'system', this.currentMessageId++);
            } catch (error) {
                this.addMessage(`Failed to fetch webpage: ${error.message}`, 'system', this.currentMessageId++);
            }
        }

        const model = this.modelSelect.value;
        try {
            const responseDiv = this.addMessage('', 'assistant', this.currentMessageId++);
            await this.generateStreamingResponse(model, message, responseDiv);
        } catch (error) {
            console.error('Error:', error);
            this.addMessage('Sorry, there was an error generating the response.', 'assistant', this.currentMessageId++);
        }
    }

    addMessage(content, sender, messageId) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        messageDiv.setAttribute('data-id', messageId);

        messageDiv.innerHTML = `<div class="message-content"></div>`;
        const contentDiv = messageDiv.querySelector('.message-content');

        if (content) {
            marked.setOptions({
                highlight: function (code, language) {
                    if (language && hljs.getLanguage(language)) {
                        return hljs.highlight(code, { language }).value;
                    }
                    return code;
                }
            });
            contentDiv.innerHTML = marked.parse(content);
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
            });
        }

        if (sender === 'system') {
            messageDiv.classList.add('system-message');
        }

        this.messageList.appendChild(messageDiv);
        this.messageList.scrollTop = this.messageList.scrollHeight;
        return messageDiv;
    }

    async handleFileUpload(files) {
        for (const file of files) {
            try {
                const content = await file.text();
                console.log(`File uploaded: ${file.name}, content size: ${content.length} characters`);
                this.documents.set(file.name, content);

                // Check if document content exceeds a limit
                const MAX_FILE_SIZE = 1000; // Set a max size (in characters)
                if (content.length > MAX_FILE_SIZE) {
                    content = content.substring(0, MAX_FILE_SIZE) + '...'; // Truncate content
                }

                this.addDocumentMessage(file.name);
            } catch (error) {
                console.error('Error reading file:', error);
            }
        }
        this.fileInput.value = ''; // Reset file input
    }

    addDocumentMessage(filename) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', 'system-message');

        messageDiv.innerHTML = `
            <div class="document-message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
                <span>Uploaded: ${filename}</span>
            </div>
        `;

        this.messageList.appendChild(messageDiv);
        this.messageList.scrollTop = this.messageList.scrollHeight;
    }

    async generateStreamingResponse(model, prompt, messageDiv) {
        let fullPrompt = prompt;
        let context = '';

        // Add document context if exists
        if (this.documents.size > 0) {
            context += 'Here are the relevant documents:\n\n';
            this.documents.forEach((content, filename) => {
                context += `File: ${filename}\n${content}\n\n`;
            });
        }

        // Add webpage context if exists
        if (this.webpages.size > 0) {
            context += 'Here are the relevant webpages:\n\n';
            this.webpages.forEach((content, url) => {
                context += `URL: ${url}\nContent:\n${content}\n\n`;
            });
        }

        if (context) {
            fullPrompt = context + 'Based on this information, please respond to: ' + prompt;
        }

        try {
            const response = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: fullPrompt }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate response');
            }

            const reader = response.body.getReader();
            const contentDiv = messageDiv.querySelector('.message-content');
            let fullResponse = '';
            let currentMarkdown = '';

            // Read and process the stream
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    try {
                        const data = JSON.parse(line);

                        // Check if 'message' exists in the response
                        if (data.message) {
                            const messageContent = data.message.content;
                            fullResponse += messageContent;  // Append the response content
                            currentMarkdown = marked.parse(fullResponse); // Convert to markdown
                            contentDiv.innerHTML = currentMarkdown;

                            // Apply syntax highlighting to any code blocks
                            contentDiv.querySelectorAll('pre code').forEach((block) => {
                                hljs.highlightBlock(block);
                            });

                            // Auto-scroll to bottom
                            this.messageList.scrollTop = this.messageList.scrollHeight;
                        }

                        // If the response is complete (done: true), break out of the loop
                        if (data.done) {
                            break;
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }

            return fullResponse;

        } catch (error) {
            console.error('Error generating response:', error);
            this.addMessage('Sorry, there was an error generating the response.', 'assistant', this.currentMessageId++);
        }
    }

    async loadModels() {
        console.log('Starting to load models...');
        this.modelSelect.innerHTML = '<option disabled>Loading models...</option>';

        try {
            const response = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            this.modelSelect.innerHTML = '';

            if (!data.models || data.models.length === 0) {
                throw new Error('No models found in response');
            }

            data.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name;
                this.modelSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Detailed error loading models:', error);
            this.modelSelect.innerHTML = `<option disabled>Error: ${error.message}</option>`;
        }
    }

    saveConversation() {
        let markdown = '';
        const messages = this.messageList.children;

        for (const message of messages) {
            const content = message.querySelector('.message-content');
            const role = message.classList.contains('user-message') ? 'User' :
                message.classList.contains('assistant-message') ? 'Assistant' : 'System';

            if (!content.textContent.trim()) continue;

            markdown += `## ${role}\n\n`;

            if (role === 'System') {
                markdown += `${content.textContent.trim()}\n\n`;
                continue;
            }

            const rawContent = content.innerHTML;
            const processedContent = rawContent
                .replace(/<pre><code class="language-(\w+)">/g, '```$1\n')
                .replace(/<\/code><\/pre>/g, '\n```\n')
                .replace(/<code>/g, '`')
                .replace(/<\/code>/g, '`')
                .replace(/<[^>]+>/g, '');

            markdown += `${processedContent}\n\n`;
        }

        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = `conversation-${timestamp}.md`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
