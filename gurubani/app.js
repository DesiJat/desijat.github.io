// app.js - Interactive Gurbani Reader with Dynamic Config & Optimized Modular Architecture

document.addEventListener('DOMContentLoaded', () => {

    // --- Helper Factory for Default Book Display & Audio Settings (DRY) ---
    function createDefaultBookConfig(name, folderName, fileNameAlias, totalFiles) {
        return {
            name,
            folderName,
            fileNameAlias,
            totalFiles,
            displayOptions: [
                { key: "punjabi", label: "ਪੰਜਾਬੀ (Punjabi Script)", default: true, class: "punjabi", type: "line" },
                { key: "hindi", label: "हिंदी (Hindi Script)", default: true, class: "hindi", type: "line" },
                { key: "english", label: "English (Transliteration)", default: true, class: "english", type: "line" },
                { key: "punjabiArth", label: "ਪੰਜਾਬੀ ਅਰਥ (Punjabi Arth)", default: true, class: "punjabi-arth", type: "arth" },
                { key: "hindiArth", label: "हिंदी अर्थ (Hindi Arth)", default: true, class: "hindi-arth", type: "arth" },
                { key: "englishMeaning", label: "Eng Meaning (English)", default: true, class: "english-meaning", type: "arth" },
                { key: "teekas", label: "ਟੀਕਾ / पद अर्थ (Teekas)", default: true, class: "verse-teekas", type: "teekas" },
                { key: "info", label: "Info (Author/Bani)", default: true, class: "verse-info", type: "info" }
            ],
            audioOptions: {
                defaultLang: "pa",
                defaultRate: 1.0,
                voices: [
                    { code: "pa", label: "Punjabi (ਪੰਜਾਬੀ)", langMatch: ["pa", "punjabi", "gurmukhi"], textFields: ["punjabi", "punjabiArth"], fallbackText: ["hindi", "english"] },
                    { code: "hi", label: "Hindi (हिंदी)", langMatch: ["hi", "hindi"], textFields: ["hindi", "hindiArth"], fallbackText: ["english", "punjabi"] },
                    { code: "en", label: "English", langMatch: ["en", "english"], textFields: ["english", "englishMeaning"], fallbackText: ["punjabi", "hindi"] }
                ]
            }
        };
    }

    // Embedded Fallback Configuration if allBooks.json is unreachable
    const fallbackAllBooksConfig = {
        srigranth: createDefaultBookConfig("Sri Guru Granth Sahib (SriGranth)", "srigranth", "gurbani_sggs-", 1430),
        gurbani: createDefaultBookConfig("Gurbani", "gurbani", "gurbani_sggs-", 1410)
    };

    let allBooks = {};

    // --- Global Application State ---
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

    // --- DOM Element Cache ---
    const dom = {
        bookSelect: document.getElementById('bookSelect'),
        totalAngsSpan: document.getElementById('totalAngsSpan'),
        angInput: document.getElementById('angInput'),
        prevAngBtn: document.getElementById('prevAngBtn'),
        nextAngBtn: document.getElementById('nextAngBtn'),
        versesContainer: document.getElementById('versesContainer'),
        viewFiltersGrid: document.getElementById('viewFiltersGrid'),
        btnPlayAll: document.getElementById('btnPlayAll'),
        btnStopAudio: document.getElementById('btnStopAudio'),
        ttsLangSelect: document.getElementById('ttsLangSelect'),
        ttsRateSelect: document.getElementById('ttsRateSelect'),
        floatingAudioStatus: document.getElementById('floatingAudioStatus'),
        floatingAudioText: document.getElementById('floatingAudioText')
    };

    // --- Speech Synthesis Engine ---
    const synth = window.speechSynthesis;
    let activeUtterance = null;

    function populateVoices() {
        if (synth) {
            state.audio.voices = synth.getVoices() || [];
        }
    }

    if (synth) {
        populateVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoices;
        }
    }

    // --- Voice & Script Matching System ---
    // Precise matching: lang code must START with prefix (e.g. 'hi-IN' matches 'hi' but NOT 'chi-nese')
    // Name keyword must appear as a whole word (e.g. 'hindi' matches 'Google हिन्दी' but NOT 'Ting-Ting')
    function findVoiceForLangMatches(langPrefixes, nameKeywords) {
        populateVoices();
        const voices = state.audio.voices || [];
        return voices.find(v => {
            const l = (v.lang || '').toLowerCase();
            const n = (v.name || '').toLowerCase();
            const langMatch = (langPrefixes || []).some(p => l === p.toLowerCase() || l.startsWith(p.toLowerCase() + '-'));
            const nameMatch = (nameKeywords || []).some(k => {
                const kl = k.toLowerCase();
                return n === kl || n.startsWith(kl + ' ') || n.endsWith(' ' + kl) || n.includes(' ' + kl + ' ');
            });
            return langMatch || nameMatch;
        });
    }

    // Build voice priority chain from allBooks.json voice config for the requested language code
    function getSpeechConfigForVerse(verse, reqLang) {
        const currentBook = allBooks[state.currentBookKey] || {};
        const voices = (currentBook.audioOptions && currentBook.audioOptions.voices) || [];
        const voiceConfig = voices.find(v => v.code === reqLang) || voices[0];

        if (!voiceConfig) {
            // Absolute fallback if config missing
            const allVoices = state.audio.voices || [];
            const enVoice = allVoices.find(v => (v.lang || '').toLowerCase().startsWith('en-')) || allVoices[0] || null;
            const text = cleanSpeechText([verse.english, verse.englishMeaning].filter(Boolean).join('. '));
            return { voice: enVoice, lang: enVoice ? enVoice.lang : 'en-US', text };
        }

        // Build ordered priority chain: primary voice config + its fallbackChain entries
        const priorityChain = [
            { langPrefixes: voiceConfig.langPrefixes || [], nameKeywords: voiceConfig.nameKeywords || [], fields: voiceConfig.textFields || [] },
            ...(voiceConfig.fallbackChain || []).map(fb => ({
                langPrefixes: fb.langPrefixes || [],
                nameKeywords: fb.nameKeywords || [],
                fields: fb.textFields || []
            }))
        ];

        for (const step of priorityChain) {
            const voice = findVoiceForLangMatches(step.langPrefixes, step.nameKeywords);
            if (voice) {
                const text = cleanSpeechText(step.fields.map(f => verse[f]).filter(Boolean).join('. '));
                if (text) {
                    console.log(`[TTS] reqLang=${reqLang} voice="${voice.name}" (${voice.lang}) text: ${text.slice(0, 60)}`);
                    return { voice, lang: voice.lang, text };
                }
            }
        }

        // No voice found for any step — use English TTS + English text (avoids Indic script silence)
        const allVoices = state.audio.voices || [];
        const enVoice = allVoices.find(v => (v.lang || '').toLowerCase().startsWith('en-')) || allVoices[0] || null;
        const fallbackText = cleanSpeechText([verse.english, verse.englishMeaning].filter(Boolean).join('. '));
        console.warn(`[TTS] No native voice for "${reqLang}", using "${enVoice ? enVoice.name : 'none'}" with English text.`);
        return { voice: enVoice, lang: enVoice ? enVoice.lang : 'en-US', text: fallbackText };
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

    // Dynamic Book Selector Population
    function populateBookSelect() {
        if (!dom.bookSelect) return;
        dom.bookSelect.innerHTML = '';
        Object.keys(allBooks).forEach(key => {
            const book = allBooks[key];
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = book.name || key;
            if (key === state.currentBookKey) {
                opt.selected = true;
            }
            dom.bookSelect.appendChild(opt);
        });
    }

    // Dynamic Book Configuration Setup
    function setupBookConfig(bookKey) {
        const book = allBooks[bookKey] || allBooks[Object.keys(allBooks)[0]];
        if (!book) return;

        state.currentBookKey = bookKey;
        state.totalAngs = book.totalFiles || 1430;

        if (dom.totalAngsSpan) dom.totalAngsSpan.textContent = `of ${state.totalAngs}`;
        if (dom.angInput) dom.angInput.max = state.totalAngs;

        // Setup Display Filters Checkboxes Grid
        state.displayOptions = {};
        if (dom.viewFiltersGrid && book.displayOptions) {
            dom.viewFiltersGrid.innerHTML = '';
            book.displayOptions.forEach(opt => {
                state.displayOptions[opt.key] = opt.default !== false;

                const label = document.createElement('label');
                label.className = 'checkbox-label';
                label.innerHTML = `
                    <input type="checkbox" class="view-toggle" data-key="${opt.key}" ${state.displayOptions[opt.key] ? 'checked' : ''}>
                    <span>${opt.label}</span>
                `;
                dom.viewFiltersGrid.appendChild(label);
            });

            dom.viewFiltersGrid.querySelectorAll('.view-toggle').forEach(chk => {
                chk.addEventListener('change', (e) => {
                    state.displayOptions[e.target.dataset.key] = e.target.checked;
                    renderVerses();
                });
            });
        }

        // Setup Audio Voice Options Selector
        if (dom.ttsLangSelect && book.audioOptions && book.audioOptions.voices) {
            dom.ttsLangSelect.innerHTML = '';
            book.audioOptions.voices.forEach(v => {
                const option = document.createElement('option');
                option.value = v.code;
                option.textContent = v.label;
                if (v.code === (book.audioOptions.defaultLang || 'pa')) {
                    option.selected = true;
                }
                dom.ttsLangSelect.appendChild(option);
            });
            state.audio.ttsLanguage = dom.ttsLangSelect.value || 'pa';
            if (book.audioOptions.defaultRate) {
                state.audio.ttsRate = book.audioOptions.defaultRate;
            }
        }
    }

    // --- Data Loading ---
    async function loadAng(angNum) {
        const currentBook = allBooks[state.currentBookKey] || allBooks[Object.keys(allBooks)[0]];
        const folderName = currentBook.folderName;
        const fileNameAlias = currentBook.fileNameAlias;
        state.totalAngs = currentBook.totalFiles || 1430;

        state.currentAng = angNum;
        if (dom.angInput) dom.angInput.value = angNum;
        if (dom.prevAngBtn) dom.prevAngBtn.disabled = angNum <= 1;
        if (dom.nextAngBtn) dom.nextAngBtn.disabled = angNum >= state.totalAngs;
        if (dom.totalAngsSpan) dom.totalAngsSpan.textContent = `of ${state.totalAngs}`;

        stopSpeech();

        dom.versesContainer.innerHTML = `
            <div class="loading-box">
                <div class="spinner"></div>
                <p>Loading Ang ${angNum} (${currentBook.name || ''})...</p>
            </div>
        `;

        try {
            const fileName = `${folderName}/${fileNameAlias}${angNum}.json`;
            const response = await fetch(fileName);
            if (!response.ok) throw new Error(`Failed to load ${fileName}`);
            const data = await response.json();
            state.verses = data;
            renderVerses();
        } catch (err) {
            console.warn('Could not fetch JSON file directly, trying fallback data:', err);
            if (angNum === 1 && typeof fallbackAng1Data !== 'undefined') {
                state.verses = fallbackAng1Data;
                renderVerses();
            } else {
                dom.versesContainer.innerHTML = `
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
            dom.versesContainer.innerHTML = `<div class="loading-box"><p>No verses found for this Ang.</p></div>`;
            return;
        }

        dom.versesContainer.innerHTML = '';
        const currentBook = allBooks[state.currentBookKey] || {};
        const displayConfig = currentBook.displayOptions || [];

        state.verses.forEach((verse, index) => {
            const card = document.createElement('div');
            card.className = 'verse-card';
            card.id = `verse-card-${index}`;

            const isCurrentPlaying = (state.audio.currentVerseIndex === index);
            if (isCurrentPlaying) card.classList.add('active-playing');

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

            // Speaker Button Handler
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

            dom.versesContainer.appendChild(card);
        });
    }

    function cleanSpeechText(str) {
        if (!str) return '';
        return str.replace(/[॥|]+/g, ' ').replace(/~+/g, '').replace(/\s+/g, ' ').trim();
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
            if (synth.paused) synth.resume();
        }
    }

    function handleSpeechNext(index) {
        if (state.audio.isPlayingAll && index < state.verses.length - 1) {
            speakVerse(index + 1);
        } else {
            stopSpeech();
        }
    }

    // --- Speech Control Functions ---
    function speakVerse(index) {
        if (!synth) {
            alert('Speech Synthesis is not supported in this browser.');
            return;
        }

        cancelSpeechOnly();

        if (index < 0 || index >= state.verses.length) {
            stopSpeech();
            return;
        }

        state.audio.currentVerseIndex = index;
        const verse = state.verses[index];
        const reqLang = state.audio.ttsLanguage;
        const speechConfig = getSpeechConfigForVerse(verse, reqLang);

        if (!speechConfig || !speechConfig.text) {
            handleSpeechNext(index);
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
            handleSpeechNext(index);
        };

        utterance.onerror = (err) => {
            activeUtterance = null;
            if (err.error === 'canceled' || err.error === 'interrupted') return;
            console.warn('Speech synthesis utterance error:', err.error || err);
            handleSpeechNext(index);
        };

        // Instant UI feedback & synchronous gesture execution
        updateAudioUI();
        highlightVerseCard(index);

        synth.speak(utterance);
        if (synth.paused) synth.resume();
    }

    function stopSpeech() {
        cancelSpeechOnly();
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
                dom.btnPlayAll.classList.add('playing');
                dom.btnPlayAll.innerHTML = `⏸️ Pause Auto-Play`;
            } else {
                dom.btnPlayAll.classList.remove('playing');
                dom.btnPlayAll.innerHTML = `▶️ Play Full Page`;
            }
            if (dom.floatingAudioStatus && dom.floatingAudioText) {
                dom.floatingAudioStatus.classList.remove('hidden');
                dom.floatingAudioText.textContent = `Playing Verse #${state.audio.currentVerseIndex + 1} of ${state.verses.length}`;
            }
        } else {
            dom.btnPlayAll.classList.remove('playing');
            dom.btnPlayAll.innerHTML = `▶️ Play Full Page`;
            if (dom.floatingAudioStatus) dom.floatingAudioStatus.classList.add('hidden');
        }
    }

    // --- Centralized Event Listeners ---
    if (dom.bookSelect) {
        dom.bookSelect.addEventListener('change', (e) => {
            const key = e.target.value;
            if (allBooks[key]) {
                setupBookConfig(key);
                loadAng(1);
            }
        });
    }

    dom.prevAngBtn.addEventListener('click', () => {
        if (state.currentAng > 1) loadAng(state.currentAng - 1);
    });

    dom.nextAngBtn.addEventListener('click', () => {
        if (state.currentAng < state.totalAngs) loadAng(state.currentAng + 1);
    });

    dom.angInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > state.totalAngs) val = state.totalAngs;
        loadAng(val);
    });

    dom.btnPlayAll.addEventListener('click', () => {
        if (synth.speaking && state.audio.isPlayingAll) {
            stopSpeech();
        } else {
            state.audio.isPlayingAll = true;
            const startIdx = state.audio.currentVerseIndex >= 0 ? state.audio.currentVerseIndex : 0;
            speakVerse(startIdx);
        }
    });

    dom.btnStopAudio.addEventListener('click', () => {
        stopSpeech();
    });

    dom.ttsLangSelect.addEventListener('change', (e) => {
        state.audio.ttsLanguage = e.target.value;
        if (synth.speaking) {
            const curr = state.audio.currentVerseIndex;
            speakVerse(curr >= 0 ? curr : 0);
        }
    });

    dom.ttsRateSelect.addEventListener('change', (e) => {
        state.audio.ttsRate = parseFloat(e.target.value);
        if (synth.speaking) {
            const curr = state.audio.currentVerseIndex;
            speakVerse(curr >= 0 ? curr : 0);
        }
    });

    // Start Application
    initApp();
});
