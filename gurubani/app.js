// app.js - Interactive Gurbani Reader with SpeechSynthesis (TTS) & Auto-Play

document.addEventListener('DOMContentLoaded', () => {
    const allBooks = {
        srigranth: {
            name: "Sri Guru Granth Sahib",
            folderName: "srigranth",
            fileNameAlias: "gurbani_sggs-",
            totalFiles: 1430
        },
        gurbani: {
            name: "Gurbani",
            folderName: "gurbani",
            fileNameAlias: "gurbani_sggs-",
            totalFiles: 1410
        }
    };

    const defaultBookKey = Object.keys(allBooks)[0] || 'gurbani';

    // --- Application State ---
    const state = {
        currentBookKey: defaultBookKey,
        currentAng: 1,
        totalAngs: allBooks[defaultBookKey].totalFiles || 1430,
        verses: [],
        displayOptions: {
            punjabi: true,
            hindi: true,
            english: true,
            punjabiArth: true,
            hindiArth: true,
            englishMeaning: true,
            info: true,
            teekas: true
        },
        audio: {
            isPlayingAll: false,
            currentVerseIndex: -1,
            ttsLanguage: 'pa', // 'pa' (Punjabi), 'hi' (Hindi), 'en' (English)
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

    populateBookSelect();

    if (bookSelect) {
        bookSelect.addEventListener('change', (e) => {
            const key = e.target.value;
            if (allBooks[key]) {
                state.currentBookKey = key;
                state.totalAngs = allBooks[key].totalFiles || 1430;
                if (angInput) {
                    angInput.max = state.totalAngs;
                }
                loadAng(1);
            }
        });
    }

    const btnPlayAll = document.getElementById('btnPlayAll');
    const btnStopAudio = document.getElementById('btnStopAudio');
    const ttsLangSelect = document.getElementById('ttsLangSelect');
    const ttsRateSelect = document.getElementById('ttsRateSelect');

    const floatingAudioStatus = document.getElementById('floatingAudioStatus');
    const floatingAudioText = document.getElementById('floatingAudioText');

    // --- Speech Synthesis Setup ---
    const synth = window.speechSynthesis;

    // Global reference to prevent Chrome SpeechSynthesisUtterance garbage collection bug
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

    // Determine matching SpeechSynthesisVoice for requested language without forcing mismatched voices
    function findVoiceForLang(langCode) {
        if (!state.audio.voices || state.audio.voices.length === 0) {
            populateVoices();
        }
        const voices = state.audio.voices || [];

        if (langCode === 'pa') {
            return voices.find(v => v.lang.toLowerCase().includes('pa') ||
                v.name.toLowerCase().includes('punjabi') ||
                v.name.toLowerCase().includes('gurmukhi'));
        } else if (langCode === 'hi') {
            return voices.find(v => v.lang.toLowerCase().includes('hi') ||
                v.name.toLowerCase().includes('hindi'));
        } else if (langCode === 'en') {
            return voices.find(v => v.lang.toLowerCase().startsWith('en') ||
                v.name.toLowerCase().includes('english'));
        }
        return null;
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

            if (state.displayOptions.punjabi && verse.punjabi) {
                bodyHtml += `<div class="verse-line punjabi">${verse.punjabi}</div>`;
            }
            if (state.displayOptions.hindi && verse.hindi) {
                bodyHtml += `<div class="verse-line hindi">${verse.hindi}</div>`;
            }
            if (state.displayOptions.english && verse.english) {
                bodyHtml += `<div class="verse-line english">${verse.english}</div>`;
            }

            if (state.displayOptions.punjabiArth && verse.punjabiArth) {
                bodyHtml += `<div class="verse-arth punjabi-arth">${verse.punjabiArth}</div>`;
            }
            if (state.displayOptions.hindiArth && verse.hindiArth) {
                bodyHtml += `<div class="verse-arth hindi-arth">${verse.hindiArth}</div>`;
            }
            if (state.displayOptions.englishMeaning && verse.englishMeaning) {
                bodyHtml += `<div class="verse-arth english-meaning">${verse.englishMeaning}</div>`;
            }
            if (state.displayOptions.teekas && verse.teekas) {
                bodyHtml += `<div class="verse-teekas"><span class="teekas-badge">Teekas:</span> ${verse.teekas}</div>`;
            }

            if (state.displayOptions.info && verse.info) {
                bodyHtml += `<div class="verse-info">ℹ️ ${verse.info}</div>`;
            }

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

    // --- Speech Control Functions ---
    function speakVerse(index) {
        if (!synth) {
            alert('Speech Synthesis is not supported in this browser.');
            return;
        }

        // Cancel any active/pending speech without resetting state.audio.isPlayingAll
        if (synth) {
            synth.cancel();
            if (synth.paused) {
                synth.resume();
            }
        }

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

        const rawPaText = [verse.punjabi, verse.punjabiArth].filter(Boolean).join('. ');
        const rawHiText = [verse.hindi, verse.hindiArth].filter(Boolean).join('. ');
        const rawEnText = [verse.english, verse.englishMeaning].filter(Boolean).join('. ');

        let textToSpeak = '';
        let targetLangCode = 'en-US';
        let matchedVoice = null;

        if (reqLang === 'pa') {
            const paVoice = findVoiceForLang('pa');
            if (paVoice) {
                textToSpeak = cleanSpeechText(rawPaText) || cleanSpeechText(rawEnText);
                targetLangCode = paVoice.lang || 'pa-IN';
                matchedVoice = paVoice;
            } else {
                const hiVoice = findVoiceForLang('hi');
                if (hiVoice) {
                    textToSpeak = cleanSpeechText(rawHiText) || cleanSpeechText(rawEnText);
                    targetLangCode = hiVoice.lang || 'hi-IN';
                    matchedVoice = hiVoice;
                } else {
                    textToSpeak = cleanSpeechText(rawEnText) || cleanSpeechText(rawPaText);
                    targetLangCode = 'en-US';
                    matchedVoice = findVoiceForLang('en');
                }
            }
        } else if (reqLang === 'hi') {
            const hiVoice = findVoiceForLang('hi');
            if (hiVoice) {
                textToSpeak = cleanSpeechText(rawHiText) || cleanSpeechText(rawEnText);
                targetLangCode = hiVoice.lang || 'hi-IN';
                matchedVoice = hiVoice;
            } else {
                const enVoice = findVoiceForLang('en');
                textToSpeak = cleanSpeechText(rawEnText) || cleanSpeechText(rawHiText);
                targetLangCode = 'en-US';
                matchedVoice = enVoice;
            }
        } else if (reqLang === 'en') {
            const enVoice = findVoiceForLang('en');
            textToSpeak = cleanSpeechText(rawEnText) || cleanSpeechText(rawPaText);
            targetLangCode = 'en-US';
            matchedVoice = enVoice;
        }

        if (!textToSpeak) {
            if (state.audio.isPlayingAll && index < state.verses.length - 1) {
                speakVerse(index + 1);
            }
            return;
        }

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = targetLangCode;
        if (matchedVoice) {
            utterance.voice = matchedVoice;
        }
        utterance.rate = state.audio.ttsRate;
        utterance.volume = 1.0;

        // Save global reference to prevent Chrome Garbage Collection mid-speech
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
            // Ignore normal cancellation/interruption events when switching verses or languages
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

            // Scroll into view smoothly if out of viewport
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
        if (state.audio.currentVerseIndex >= 0 && synth.speaking) {
            btnPlayAll.classList.add('playing');
            btnPlayAll.innerHTML = `⏸️ Pause Auto-Play`;
            floatingAudioStatus.classList.remove('hidden');
            floatingAudioText.textContent = `Playing Verse #${state.audio.currentVerseIndex + 1} of ${state.verses.length}`;
        } else {
            btnPlayAll.classList.remove('playing');
            btnPlayAll.innerHTML = `▶️ Play Full Page`;
            floatingAudioStatus.classList.add('hidden');
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

    // Checkbox toggles for views
    document.querySelectorAll('.view-toggle').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const key = e.target.dataset.key;
            if (key in state.displayOptions) {
                state.displayOptions[key] = e.target.checked;
                renderVerses();
            }
        });
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
            // Restart current verse in newly selected language
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

    // Initial load
    loadAng(1);
});

// Fallback embedded dataset for Ang 1 if loaded directly without web server
const fallbackAng1Data = [
    {
        "angNumber": 1,
        "verseNumber": 1,
        "punjabi": "ੴ ਸਤਿਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰਪ੍ਰਸਾਦਿ ॥",
        "hindi": "ੴ सतिनामु करता पुरखु निरभउ निरवैरु अकाल मूरति अजूनी सैभं गुरप्रसादि ॥",
        "english": "Ik-oamkkaari satinaamu karataa purakhu nirabhau niravairu akaal moorati ajoonee saibhann guraprsaadi ||",
        "punjabiArth": "ਅਕਾਲ ਪੁਰਖ ਇੱਕ ਹੈ, ਜਿਸ ਦਾ ਨਾਮ 'ਹੋਂਦ ਵਾਲਾ' ਹੈ ਜੋ ਸ੍ਰਿਸ਼ਟੀ ਦਾ ਰਚਨਹਾਰ ਹੈ, ਜੋ ਸਭ ਵਿਚ ਵਿਆਪਕ ਹੈ, ਭੈ ਤੋਂ ਰਹਿਤ ਹੈ, ਵੈਰ-ਰਹਿਤ ਹੈ, ਜਿਸ ਦਾ ਸਰੂਪ ਕਾਲ ਤੋਂ ਪਰੇ ਹੈ, (ਭਾਵ, ਜਿਸ ਦਾ ਸਰੀਰ ਨਾਸ-ਰਹਿਤ ਹੈ), ਜੋ ਜੂਨਾਂ ਵਿਚ ਨਹੀਂ ਆਉਂਦਾ, ਜਿਸ ਦਾ ਪ੍ਰਕਾਸ਼ ਆਪਣੇ ਆਪ ਤੋਂ ਹੋਇਆ ਹੈ ਅਤੇ ਜੋ ਸਤਿਗੁਰੂ ਦੀ ਕਿਰਪਾ ਨਾਲ ਮਿਲਦਾ ਹੈ ।",
        "hindiArth": "ੴ- इस शब्द का शुद्ध उच्चारण है - 'एक ओंकार'। इसके उच्चारण में इसके तीन अंश किए जाते हैं। इन तीनों के भावार्थ भी अलग-अलग ही हैं। १ - एक (अद्वितीय)। ऑ- वही। ओंकार (~) निरंकार ; अर्थात्-ब्रह्म, करतार, ईश्वर, परमात्मा, भगवान, वाहिगुरु । १ ऑ- निरंकार वही एक है। सति नामु - उसका नाम सत्य है। करता - वह सृष्टि व उसके जीवों की रचना करने वाला है। पुरखु - वह यह सब कुछ करने में परिपूर्ण (शक्तिवान) है। निरभउ - उसमें किसी तरह का भय व्याप्त नहीं। अर्थात् - अन्य देव-दैत्यों तथा सांसारिक जीवों की भाँति उसमें द्वेष अथवा जन्म-मरण का भय नहीं है ; वह इन सबसे परे हैं। निरवैरु- वह बैर (द्वेष/दुश्मनी) से रहित है। अकाल- वह काल (मृत्यु) से परे है; अर्थात्-वह अविनाशी है। मूरति - वह अविनाशी होने के कारण उसका अस्तित्व सदैव रहता है। अजूनी - वह कोई योनि धारण नहीं करता, क्योंकि वह आवागमन के चक्कर से रहित है। सैभं - वह स्वयं से प्रकाशमान हुआ है। गुर - अंधकार (अज्ञान) में प्रकाश (ज्ञान) करने वाला (गुरु)। प्रसादि- कृपा की बख्शिश। अर्थात्-गुरु की कृपा से यह सब उपलब्ध हो सकता है।",
        "englishMeaning": "One Universal Creator God, TheName Is Truth Creative Being Personified No Fear No Hatred Image Of The Undying, Beyond Birth, Self-Existent. By Guru's Grace~",
        "info": "Guru Nanak Dev ji /  / Mool Mantar / Guru Granth Sahib ji - Ang 1 (#1)",
        "author": "Guru Nanak Dev ji",
        "bani": "Mool Mantar"
    },
    {
        "angNumber": 1,
        "verseNumber": 2,
        "punjabi": "॥ ਜਪੁ ॥",
        "hindi": "॥ जपु ॥",
        "english": "|| japu ||",
        "punjabiArth": "(ਬਾਣੀ ਦਾ ਨਾਮ ਹੈ) ਜਾਪ ਕਰੋ।",
        "hindiArth": "जाप करो। (इसे गुरु की वाणी का शीर्षक भी माना गया है।)",
        "englishMeaning": "Chant And Meditate:",
        "info": "Guru Nanak Dev ji /  / Japji Sahib / Guru Granth Sahib ji - Ang 1 (#2)",
        "author": "Guru Nanak Dev ji",
        "bani": "Japji Sahib"
    },
    {
        "angNumber": 1,
        "verseNumber": 3,
        "punjabi": "ਆਦਿ ਸਚੁ ਜੁਗਾਦਿ ਸਚੁ ॥",
        "hindi": "आदि सचु जुगादि सचु ॥",
        "english": "Aadi sachu jugaadi sachu ||",
        "punjabiArth": "ਅਕਾਲ ਪੁਰਖ ਮੁੱਢ ਤੋਂ ਹੋਂਦ ਵਾਲਾ ਹੈ, ਜੁਗਾਂ ਦੇ ਮੁੱਢ ਤੋਂ ਮੌਜੂਦ ਹੈ ।",
        "hindiArth": "निरंकार (अकाल पुरुष) सृष्टि की रचना से पहले सत्य था, युगों के प्रारम्भ में भी सत्य (स्वरूप) था।",
        "englishMeaning": "True In The Primal Beginning. True Throughout The Ages.",
        "info": "Guru Nanak Dev ji /  / Japji Sahib / Guru Granth Sahib ji - Ang 1 (#3)",
        "author": "Guru Nanak Dev ji",
        "bani": "Japji Sahib"
    },
    {
        "angNumber": 1,
        "verseNumber": 4,
        "punjabi": "ਹੈ ਭੀ ਸਚੁ ਨਾਨਕ ਹੋਸੀ ਭੀ ਸਚੁ ॥੧॥",
        "hindi": "है भी सचु नानक होसी भी सचु ॥१॥",
        "english": "Hai bhee sachu naanak hosee bhee sachu ||1||",
        "punjabiArth": "ਹੇ ਨਾਨਕ! ਇਸ ਵੇਲੇ ਭੀ ਮੌਜੂਦ ਹੈ ਤੇ ਅਗਾਂਹ ਨੂੰ ਭੀ ਹੋਂਦ ਵਾਲਾ ਰਹੇਗਾ ॥੧॥",
        "hindiArth": "अब वर्तमान में भी उसी का अस्तित्व है, श्री गुरु नानक देव जी का कथन है भविष्य में भी उसी सत्यस्वरूप निरंकार का अस्तित्व होगा ॥ १ ॥",
        "englishMeaning": "True Here And Now. O Nanak, Forever And Ever True. ||1||",
        "info": "Guru Nanak Dev ji /  / Japji Sahib / Guru Granth Sahib ji - Ang 1 (#4)",
        "author": "Guru Nanak Dev ji",
        "bani": "Japji Sahib"
    }
];
