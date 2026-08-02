// app.js - Interactive Gurbani Reader with Dynamic Config from allBooks.json

document.addEventListener('DOMContentLoaded', () => {

    // --- Embedded Fallback Config (Used if allBooks.json cannot be fetched) ---
    const fallbackAllBooksConfig = {
        "srigranth": {
            "name": "Sri Guru Granth Sahib (SriGranth)",
            "folderName": "srigranth",
            "fileNameAlias": "gurbani_sggs-",
            "totalFiles": 1430,
            "displayOptions": [
                { "key": "punjabi", "label": "ਪੰਜਾਬੀ (Punjabi Script)", "default": true, "class": "punjabi", "type": "line" },
                { "key": "hindi", "label": "हिंदी (Hindi Script)", "default": true, "class": "hindi", "type": "line" },
                { "key": "english", "label": "English (Transliteration)", "default": true, "class": "english", "type": "line" },
                { "key": "punjabiArth", "label": "ਪੰਜਾਬੀ ਅਰਥ (Punjabi Arth)", "default": true, "class": "punjabi-arth", "type": "arth" },
                { "key": "hindiArth", "label": "हिंदी अर्थ (Hindi Arth)", "default": true, "class": "hindi-arth", "type": "arth" },
                { "key": "englishMeaning", "label": "Eng Meaning (English)", "default": true, "class": "english-meaning", "type": "arth" },
                { "key": "teekas", "label": "ਟੀਕਾ / पद अर्थ (Teekas)", "default": true, "class": "verse-teekas", "type": "teekas" },
                { "key": "info", "label": "Info (Author/Bani)", "default": true, "class": "verse-info", "type": "info" }
            ],
            "audioOptions": {
                "defaultLang": "pa",
                "defaultRate": 1.0,
                "voices": [
                    { "code": "pa", "label": "Punjabi (ਪੰਜਾਬੀ)", "langMatch": ["pa", "punjabi", "gurmukhi"], "textFields": ["punjabi", "punjabiArth"], "fallbackText": ["hindi", "english"] },
                    { "code": "hi", "label": "Hindi (हिंदी)", "langMatch": ["hi", "hindi"], "textFields": ["hindi", "hindiArth"], "fallbackText": ["english", "punjabi"] },
                    { "code": "en", "label": "English", "langMatch": ["en", "english"], "textFields": ["english", "englishMeaning"], "fallbackText": ["punjabi", "hindi"] }
                ]
            }
        },
        "gurbani": {
            "name": "Gurbani",
            "folderName": "gurbani",
            "fileNameAlias": "gurbani_sggs-",
            "totalFiles": 1410,
            "displayOptions": [
                { "key": "punjabi", "label": "ਪੰਜਾਬੀ (Punjabi Script)", "default": true, "class": "punjabi", "type": "line" },
                { "key": "hindi", "label": "हिंदी (Hindi Script)", "default": true, "class": "hindi", "type": "line" },
                { "key": "english", "label": "English (Transliteration)", "default": true, "class": "english", "type": "line" },
                { "key": "punjabiArth", "label": "ਪੰਜਾਬੀ ਅਰਥ (Punjabi Arth)", "default": true, "class": "punjabi-arth", "type": "arth" },
                { "key": "hindiArth", "label": "हिंदी अर्थ (Hindi Arth)", "default": true, "class": "hindi-arth", "type": "arth" },
                { "key": "englishMeaning", "label": "Eng Meaning (English)", "default": true, "class": "english-meaning", "type": "arth" },
                { "key": "teekas", "label": "ਟੀਕਾ / पद अर्थ (Teekas)", "default": true, "class": "verse-teekas", "type": "teekas" },
                { "key": "info", "label": "Info (Author/Bani)", "default": true, "class": "verse-info", "type": "info" }
            ],
            "audioOptions": {
                "defaultLang": "pa",
                "defaultRate": 1.0,
                "voices": [
                    { "code": "pa", "label": "Punjabi (ਪੰਜਾਬੀ)", "langMatch": ["pa", "punjabi", "gurmukhi"], "textFields": ["punjabi", "punjabiArth"], "fallbackText": ["hindi", "english"] },
                    { "code": "hi", "label": "Hindi (हिंदी)", "langMatch": ["hi", "hindi"], "textFields": ["hindi", "hindiArth"], "fallbackText": ["english", "punjabi"] },
                    { "code": "en", "label": "English", "langMatch": ["en", "english"], "textFields": ["english", "englishMeaning"], "fallbackText": ["punjabi", "hindi"] }
                ]
            }
        }
    };

    let allBooks = {};

    // --- Application State ---
    const state = {
        currentBookKey: '',
        currentAng: 1,
        totalAngs: 1430,
        verses: [],
        displayOptions: {},
        audio: {
            isPlayingAll: false,
            currentVerseIndex: -1,
            ttsLanguage: 'pa',
            ttsRate: 1.0,
            voices: []
        }
    };

    // --- DOM Element References ---
    const bookSelect = document.getElementById('bookSelect');
    const totalAngsSpan = document.getElementById('totalAngsSpan');
    const angInput = document.getElementById('angInput');
    const prevAngBtn = document.getElementById('prevAngBtn');
    const nextAngBtn = document.getElementById('nextAngBtn');
    const versesContainer = document.getElementById('versesContainer');
    const viewFiltersGrid = document.getElementById('viewFiltersGrid');

    const btnPlayAll = document.getElementById('btnPlayAll');
    const btnStopAudio = document.getElementById('btnStopAudio');
    const ttsLangSelect = document.getElementById('ttsLangSelect');
    const ttsRateSelect = document.getElementById('ttsRateSelect');

    const floatingAudioStatus = document.getElementById('floatingAudioStatus');
    const floatingAudioText = document.getElementById('floatingAudioText');

    // --- Speech Synthesis Setup ---
    const synth = window.speechSynthesis;
    let activeUtterance = null;

    function populateVoices() {
        if (!synth) return;
        state.audio.voices = synth.getVoices();
    }

    if (synth) {
        populateVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoices;
        }
    }

    // Match SpeechSynthesis voice based on voiceConfig.langMatch rules from allBooks.json
    function findVoiceForConfig(voiceConfig) {
        if (!state.audio.voices || state.audio.voices.length === 0) {
            populateVoices();
        }
        const voices = state.audio.voices || [];
        if (!voiceConfig || !voiceConfig.langMatch) return null;

        return voices.find(v => {
            const vLang = (v.lang || '').toLowerCase();
            const vName = (v.name || '').toLowerCase();
            return voiceConfig.langMatch.some(m => vLang.includes(m.toLowerCase()) || vName.includes(m.toLowerCase()));
        });
    }

    // --- Application Initialization ---
    async function initApp() {
        try {
            const res = await fetch('allBooks.json');
            if (res.ok) {
                allBooks = await res.json();
            } else {
                allBooks = fallbackAllBooksConfig;
            }
        } catch (err) {
            console.warn('Could not fetch allBooks.json, using fallback configuration:', err);
            allBooks = fallbackAllBooksConfig;
        }

        populateBookSelect();

        const defaultBookKey = Object.keys(allBooks)[0] || 'srigranth';
        setupBookConfig(defaultBookKey);
        loadAng(1);
    }

    // Populate book dropdown dynamically from allBooks object
    function populateBookSelect() {
        if (!bookSelect) return;
        bookSelect.innerHTML = '';
        Object.keys(allBooks).forEach(key => {
            const book = allBooks[key];
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = book.name || key;
            if (key === state.currentBookKey) {
                opt.selected = true;
            }
            bookSelect.appendChild(opt);
        });
    }

    // Set up display checkboxes and audio options based on selected book configuration
    function setupBookConfig(bookKey) {
        const book = allBooks[bookKey] || allBooks[Object.keys(allBooks)[0]];
        if (!book) return;

        state.currentBookKey = bookKey;
        state.totalAngs = book.totalFiles || 1430;

        if (totalAngsSpan) totalAngsSpan.textContent = `of ${state.totalAngs}`;
        if (angInput) angInput.max = state.totalAngs;

        // Setup display options state & DOM checkboxes
        state.displayOptions = {};
        if (viewFiltersGrid && book.displayOptions) {
            viewFiltersGrid.innerHTML = '';
            book.displayOptions.forEach(opt => {
                state.displayOptions[opt.key] = opt.default !== false;

                const label = document.createElement('label');
                label.className = 'checkbox-label';
                label.innerHTML = `
                    <input type="checkbox" class="view-toggle" data-key="${opt.key}" ${state.displayOptions[opt.key] ? 'checked' : ''}>
                    <span>${opt.label}</span>
                `;
                viewFiltersGrid.appendChild(label);
            });

            viewFiltersGrid.querySelectorAll('.view-toggle').forEach(chk => {
                chk.addEventListener('change', (e) => {
                    const key = e.target.dataset.key;
                    state.displayOptions[key] = e.target.checked;
                    renderVerses();
                });
            });
        }

        // Setup Audio Voice options dropdown
        if (ttsLangSelect && book.audioOptions && book.audioOptions.voices) {
            ttsLangSelect.innerHTML = '';
            book.audioOptions.voices.forEach(v => {
                const option = document.createElement('option');
                option.value = v.code;
                option.textContent = v.label;
                if (v.code === (book.audioOptions.defaultLang || 'pa')) {
                    option.selected = true;
                }
                ttsLangSelect.appendChild(option);
            });
            state.audio.ttsLanguage = ttsLangSelect.value || (book.audioOptions.voices[0] ? book.audioOptions.voices[0].code : 'pa');
            if (book.audioOptions.defaultRate) {
                state.audio.ttsRate = book.audioOptions.defaultRate;
            }
        }
    }

    if (bookSelect) {
        bookSelect.addEventListener('change', (e) => {
            const key = e.target.value;
            if (allBooks[key]) {
                setupBookConfig(key);
                loadAng(1);
            }
        });
    }

    // --- Data Loading ---
    async function loadAng(angNum) {
        const currentBook = allBooks[state.currentBookKey] || allBooks[Object.keys(allBooks)[0]];
        const folderName = currentBook.folderName;
        const fileNameAlias = currentBook.fileNameAlias;
        state.totalAngs = currentBook.totalFiles || 1430;

        state.currentAng = angNum;
        if (angInput) angInput.value = angNum;
        if (prevAngBtn) prevAngBtn.disabled = angNum <= 1;
        if (nextAngBtn) nextAngBtn.disabled = angNum >= state.totalAngs;
        if (totalAngsSpan) totalAngsSpan.textContent = `of ${state.totalAngs}`;

        stopSpeech();

        versesContainer.innerHTML = `
            <div class="loading-box">
                <div class="spinner"></div>
                <p>Loading Ang ${angNum} (${currentBook.name || ''})...</p>
            </div>
        `;

        try {
            const fileName = `${folderName}/${fileNameAlias}${angNum}.json`;
            const response = await fetch(fileName);
            if (!response.ok) {
                throw new Error(`Failed to load ${fileName}`);
            }
            const data = await response.json();
            state.verses = data;
            renderVerses();
        } catch (err) {
            console.warn('Could not fetch JSON file directly, trying fallback/current Ang data:', err);
            if (angNum === 1 && typeof fallbackAng1Data !== 'undefined') {
                state.verses = fallbackAng1Data;
                renderVerses();
            } else {
                versesContainer.innerHTML = `
                    <div class="loading-box" style="color: #e74c3c;">
                        <p>⚠️ Ang ${angNum} data file not available yet.</p>
                        <p style="font-size:0.85rem; color:#888; margin-top:6px;">Check if ${folderName}/${fileNameAlias}${angNum}.json exists.</p>
                    </div>
                `;
            }
        }
    }

    // --- Render Verses ---
    function renderVerses() {
        if (!state.verses || state.verses.length === 0) {
            versesContainer.innerHTML = `<div class="loading-box"><p>No verses found for this Ang.</p></div>`;
            return;
        }

        versesContainer.innerHTML = '';

        const currentBook = allBooks[state.currentBookKey] || {};
        const displayConfig = currentBook.displayOptions || [];

        state.verses.forEach((verse, index) => {
            const card = document.createElement('div');
            card.className = 'verse-card';
            card.id = `verse-card-${index}`;

            const isCurrentPlaying = (state.audio.currentVerseIndex === index);
            if (isCurrentPlaying) {
                card.classList.add('active-playing');
            }

            const headerHtml = `
                <div class="verse-header">
                    <span class="verse-badge">Ang ${verse.angNumber || state.currentAng} • Verse #${verse.verseNumber || (index + 1)}</span>
                    <div class="verse-actions">
                        <button class="btn-speaker ${isCurrentPlaying ? 'speaking' : ''}" data-index="${index}" title="Listen to verse">
                            🔊
                        </button>
                    </div>
                </div>
            `;

            let bodyHtml = `<div class="verse-body">`;

            displayConfig.forEach(opt => {
                const isEnabled = state.displayOptions[opt.key] !== false;
                const val = verse[opt.key];
                if (isEnabled && val) {
                    if (opt.type === 'line') {
                        bodyHtml += `<div class="verse-line ${opt.class || ''}">${val}</div>`;
                    } else if (opt.type === 'arth') {
                        bodyHtml += `<div class="verse-arth ${opt.class || ''}">${val}</div>`;
                    } else if (opt.type === 'teekas') {
                        bodyHtml += `<div class="verse-teekas"><span class="teekas-badge">Teekas:</span> ${val}</div>`;
                    } else if (opt.type === 'info') {
                        bodyHtml += `<div class="verse-info">ℹ️ ${val}</div>`;
                    } else {
                        bodyHtml += `<div class="${opt.class || ''}">${val}</div>`;
                    }
                }
            });

            bodyHtml += `</div>`;
            card.innerHTML = headerHtml + bodyHtml;

            // Speaker button click handler
            const speakerBtn = card.querySelector('.btn-speaker');
            speakerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (state.audio.currentVerseIndex === index && synth && (synth.speaking || synth.pending)) {
                    stopSpeech();
                } else {
                    state.audio.isPlayingAll = false;
                    speakVerse(index);
                }
            });

            versesContainer.appendChild(card);
        });
    }

    function cleanSpeechText(str) {
        if (!str) return '';
        return str
            .replace(/[॥|]+/g, ' ')
            .replace(/~+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function cancelSpeechOnly() {
        if (activeUtterance) {
            activeUtterance.onstart = null;
            activeUtterance.onend = null;
            activeUtterance.onerror = null;
            activeUtterance = null;
        }
        if (synth) {
            synth.cancel();
            if (synth.paused) {
                synth.resume();
            }
        }
    }

    // Select voice and compatible script text for requested language
    function getSpeechConfigForVerse(verse, reqLang) {
        populateVoices();
        const voices = state.audio.voices || [];

        // 1. Punjabi Requested
        if (reqLang === 'pa') {
            // Check for native Punjabi voice
            const paVoice = voices.find(v => {
                const l = (v.lang || '').toLowerCase();
                const n = (v.name || '').toLowerCase();
                return l.includes('pa') || n.includes('punjabi') || n.includes('gurmukhi');
            });
            if (paVoice) {
                const text = cleanSpeechText([verse.punjabi, verse.punjabiArth].filter(Boolean).join('. '));
                if (text) return { voice: paVoice, lang: paVoice.lang, text };
            }

            // Fallback for Punjabi if no Punjabi voice: Use Hindi voice with Hindi Devanagari text (Hindi engines read Devanagari cleanly)
            const hiVoice = voices.find(v => {
                const l = (v.lang || '').toLowerCase();
                const n = (v.name || '').toLowerCase();
                return l.includes('hi') || n.includes('hindi');
            });
            if (hiVoice) {
                const text = cleanSpeechText([verse.hindi, verse.hindiArth].filter(Boolean).join('. '));
                if (text) return { voice: hiVoice, lang: hiVoice.lang, text };
            }

            // Fallback if neither Punjabi nor Hindi voice is installed: Use English voice with English transliteration & meaning
            const enVoice = voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || voices[0];
            const text = cleanSpeechText([verse.english, verse.englishMeaning].filter(Boolean).join('. '));
            return { voice: enVoice, lang: enVoice ? enVoice.lang : 'en-US', text };
        }

        // 2. Hindi Requested
        if (reqLang === 'hi') {
            // Check for native Hindi voice
            const hiVoice = voices.find(v => {
                const l = (v.lang || '').toLowerCase();
                const n = (v.name || '').toLowerCase();
                return l.includes('hi') || n.includes('hindi');
            });
            if (hiVoice) {
                const text = cleanSpeechText([verse.hindi, verse.hindiArth].filter(Boolean).join('. '));
                if (text) return { voice: hiVoice, lang: hiVoice.lang, text };
            }

            // Fallback if no Hindi voice: Use English voice with English transliteration & meaning
            const enVoice = voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || voices[0];
            const text = cleanSpeechText([verse.english, verse.englishMeaning].filter(Boolean).join('. '));
            return { voice: enVoice, lang: enVoice ? enVoice.lang : 'en-US', text };
        }

        // 3. English Requested
        const enVoice = voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || voices[0];
        const text = cleanSpeechText([verse.english, verse.englishMeaning].filter(Boolean).join('. '));
        return { voice: enVoice, lang: enVoice ? enVoice.lang : 'en-US', text };
    }

    // --- Speech Control Functions ---
    function speakVerse(index) {
        if (!synth) {
            alert('Speech Synthesis is not supported in this browser.');
            return;
        }

        cancelSpeechOnly();

        if (index < 0 || index >= state.verses.length) {
            state.audio.isPlayingAll = false;
            state.audio.currentVerseIndex = -1;
            updateAudioUI();
            unhighlightAllVerseCards();
            return;
        }

        state.audio.currentVerseIndex = index;
        const verse = state.verses[index];
        const reqLang = state.audio.ttsLanguage; // 'pa', 'hi', or 'en'

        const speechConfig = getSpeechConfigForVerse(verse, reqLang);

        if (!speechConfig || !speechConfig.text) {
            if (state.audio.isPlayingAll && index < state.verses.length - 1) {
                speakVerse(index + 1);
            } else {
                stopSpeech();
            }
            return;
        }

        const utterance = new SpeechSynthesisUtterance(speechConfig.text);
        if (speechConfig.voice) {
            utterance.voice = speechConfig.voice;
            utterance.lang = speechConfig.voice.lang || speechConfig.lang || 'en-US';
        } else {
            utterance.lang = speechConfig.lang || 'en-US';
        }

        utterance.rate = state.audio.ttsRate || 1.0;
        utterance.volume = 1.0;

        activeUtterance = utterance;

        utterance.onstart = () => {
            updateAudioUI();
            highlightVerseCard(index);
        };

        utterance.onend = () => {
            activeUtterance = null;
            if (state.audio.isPlayingAll && index < state.verses.length - 1) {
                speakVerse(index + 1);
            } else {
                state.audio.isPlayingAll = false;
                state.audio.currentVerseIndex = -1;
                updateAudioUI();
                unhighlightAllVerseCards();
            }
        };

        utterance.onerror = (err) => {
            activeUtterance = null;
            if (err.error === 'canceled' || err.error === 'interrupted') {
                return;
            }
            console.warn('Speech synthesis utterance error:', err.error || err);
            if (state.audio.isPlayingAll && index < state.verses.length - 1) {
                speakVerse(index + 1);
            } else {
                stopSpeech();
            }
        };

        // Immediately update UI for instant user feedback
        updateAudioUI();
        highlightVerseCard(index);

        // Execute speak synchronously within click gesture thread
        synth.speak(utterance);
        if (synth.paused) {
            synth.resume();
        }
    }

    function stopSpeech() {
        if (activeUtterance) {
            activeUtterance.onstart = null;
            activeUtterance.onend = null;
            activeUtterance.onerror = null;
            activeUtterance = null;
        }
        if (synth) {
            synth.cancel();
        }
        state.audio.isPlayingAll = false;
        state.audio.currentVerseIndex = -1;
        updateAudioUI();
        unhighlightAllVerseCards();
    }

    function highlightVerseCard(index) {
        unhighlightAllVerseCards();
        const card = document.getElementById(`verse-card-${index}`);
        if (card) {
            card.classList.add('active-playing');
            const speakerBtn = card.querySelector('.btn-speaker');
            if (speakerBtn) speakerBtn.classList.add('speaking');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function unhighlightAllVerseCards() {
        document.querySelectorAll('.verse-card').forEach(card => {
            card.classList.remove('active-playing');
            const speakerBtn = card.querySelector('.btn-speaker');
            if (speakerBtn) speakerBtn.classList.remove('speaking');
        });
    }

    function updateAudioUI() {
        if (state.audio.currentVerseIndex >= 0) {
            if (state.audio.isPlayingAll) {
                btnPlayAll.classList.add('playing');
                btnPlayAll.innerHTML = `⏸️ Pause Auto-Play`;
            } else {
                btnPlayAll.classList.remove('playing');
                btnPlayAll.innerHTML = `▶️ Play Full Page`;
            }
            if (floatingAudioStatus && floatingAudioText) {
                floatingAudioStatus.classList.remove('hidden');
                floatingAudioText.textContent = `Playing Verse #${state.audio.currentVerseIndex + 1} of ${state.verses.length}`;
            }
        } else {
            btnPlayAll.classList.remove('playing');
            btnPlayAll.innerHTML = `▶️ Play Full Page`;
            if (floatingAudioStatus) {
                floatingAudioStatus.classList.add('hidden');
            }
        }
    }

    // --- Event Listeners ---

    // Page navigation
    prevAngBtn.addEventListener('click', () => {
        if (state.currentAng > 1) {
            loadAng(state.currentAng - 1);
        }
    });

    nextAngBtn.addEventListener('click', () => {
        if (state.currentAng < state.totalAngs) {
            loadAng(state.currentAng + 1);
        }
    });

    angInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > state.totalAngs) val = state.totalAngs;
        loadAng(val);
    });

    // Audio controls
    btnPlayAll.addEventListener('click', () => {
        if (synth.speaking && state.audio.isPlayingAll) {
            stopSpeech();
        } else {
            state.audio.isPlayingAll = true;
            const startIdx = state.audio.currentVerseIndex >= 0 ? state.audio.currentVerseIndex : 0;
            speakVerse(startIdx);
        }
    });

    btnStopAudio.addEventListener('click', () => {
        stopSpeech();
    });

    ttsLangSelect.addEventListener('change', (e) => {
        state.audio.ttsLanguage = e.target.value;
        if (synth.speaking) {
            const curr = state.audio.currentVerseIndex;
            speakVerse(curr >= 0 ? curr : 0);
        }
    });

    ttsRateSelect.addEventListener('change', (e) => {
        state.audio.ttsRate = parseFloat(e.target.value);
        if (synth.speaking) {
            const curr = state.audio.currentVerseIndex;
            speakVerse(curr >= 0 ? curr : 0);
        }
    });

    // Initialize application
    initApp();
});
