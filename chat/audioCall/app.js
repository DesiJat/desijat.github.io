let OLLAMA_ENDPOINT = window.location.protocol + "//" + window.location.hostname + ":11434";
OLLAMA_ENDPOINT = prompt(`Enter url:like http://192.168.3.91:11434 or ${OLLAMA_ENDPOINT}`);
// const SYSTEM_PROMPT = `Ai assistant for user helping them learn English.`;
let SYSTEM_PROMPT = '';  // This will be dynamically set based on dropdown selection
let prompts = []; // Store the available system prompts
let recognition;

class ChatApp {
    constructor() {
        document.getElementById('baseUrlInput').value = OLLAMA_ENDPOINT;
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

        this.audioButton = document.getElementById('audioButton');
        this.audioButton.addEventListener('click', () => this.audioCall());        

        this.loadModels();
        this.loadPrompts();  // Load the prompts from JSON
        this.audioCall();
    }
    async audioCall() {
        if (!('webkitSpeechRecognition' in window)) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = async function (event) {
            const transcript = event.results[event.resultIndex][0].transcript;
            console.log("User said: ", transcript);
            appendMessage('You: ' + transcript);
            await generateStreamingResponse('llama3.2:3b', transcript, chatBox);
        };
        recognition.start();

        recognition.onstart = function () {
            console.log('Speech recognition started');
        };

        recognition.onerror = function (event) {
            console.error('Speech recognition error:', event.error);
        };

        recognition.onresult = async function (event) {
            const transcript = event.results[event.resultIndex][0].transcript;
            console.log("User said: ", transcript);
            document.getElementById('userInput').value = transcript;
            document.getElementById('userInput').focus();
            // this.userInput.value = transcript;            
        };
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
            OLLAMA_ENDPOINT=await document.getElementById('baseUrlInput').value;
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

                            // text to speech start
                            this.speakText(fullResponse);
                            // text to speech end

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
            OLLAMA_ENDPOINT=await document.getElementById('baseUrlInput').value;
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

    speakText(text) {
        // responsiveVoice.speak(text, "US English Male", { rate: 0.9 });
        const speechSpeed = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.0];
        responsiveVoice.speak(text, "US English Male", { rate: speechSpeed[2] });
        // this.speakText_offline(text);
    }

    speakText_offline(text) {
        console.log("Speaking text:", text);
        
        // Only trigger speech if it's user-activated
        const synth = window.speechSynthesis;

        // Ensure there's valid text to speak
        if (text.trim() === "") {
            console.warn("No text to speak");
            return;
        }

        // Create an utterance
        const utterance = new SpeechSynthesisUtterance(text);

        // Wait for voices to be loaded
        const voicesChanged = () => {
            const voices = synth.getVoices();
            console.log("Available voices:", voices);

            // Set the voice to the desired one (e.g., Google US English)
            utterance.voice = voices.find(voice => voice.name === 'Google US English') || voices[0]; // Default to the first available voice

            // Handle speech end event
            utterance.onend = function() {
                console.log("Speech finished.");
            };
            console.log("utterance utterance:", utterance);
            // Speak the text
            synth.speak(utterance);

            // Remove the event listener after it's triggered
            synth.removeEventListener('voiceschanged', voicesChanged);
        };

        // Add event listener to detect when voices are available
        if (synth.onvoiceschanged !== undefined) {
            synth.addEventListener('voiceschanged', voicesChanged);
        } else {
            voicesChanged(); // If voices are already loaded
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
