/**
 * Kids Interactive Learning System - Core Application Script
 * Rebuilt from scratch with robust 250ms transition TTS cancellation settle delay,
 * modular dynamic loading from data.json, and Easy/Medium/Hard quiz modes.
 */

// --- GLOBAL CURRICULUM DATA STATE ---
let appData = {
  alphabet: [],
  varnamala: [],
  numbers: [],
  rhymes: [],
  quizzes: {}
};

// --- APP STATE ---
const state = {
  activeSection: 'home',
  theme: 'light',
  soundEnabled: true,
  
  // Alphabet State
  alphaDifficulty: 'easy', // 'easy', 'medium', 'hard'
  alphaQuizActive: false,
  alphaQuizScore: 0,
  alphaQuizCount: 0,
  alphaCurrentTarget: null,
  
  // Varnamala State
  varnaDifficulty: 'easy', // 'easy', 'medium', 'hard'
  varnaQuizActive: false,
  varnaQuizScore: 0,
  varnaQuizCount: 0,
  varnaCurrentTarget: null,
  
  // Numbers State
  numDifficulty: 'easy', // 'easy', 'medium', 'hard'
  selectedNumber: 1,
  numQuizActive: false,
  numQuizScore: 0,
  numQuizCount: 0,
  numCurrentTarget: null,
  
  // Rhymes State
  selectedRhyme: null,
  isPlayingRhyme: false,
  currentLyricLineIndex: -1,
  rhymeLanguageMode: 'native' // 'native' (Hindi) or 'romanized' (English transliteration)
};

// --- ASYNC DYNAMIC DATA LOADER ---
async function loadCurriculumData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    appData = await response.json();
    // Set default initial states from loaded data
    if (appData.rhymes && appData.rhymes.length > 0) {
      state.selectedRhyme = appData.rhymes[0];
    }
    console.log("Curriculum data dynamically loaded successfully.");
  } catch (error) {
    console.error("Error loading curriculum data. Falling back to static values.", error);
    alert("Could not load data.json! Please verify it is in the same directory.");
  }
}

// --- AUDIO SYNTHESIS (Web Audio API) ---
const AudioSynth = {
  ctx: null,
  supported: false,

  init() {
    if (!this.ctx) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          this.supported = true;
        }
      } catch (e) {
        console.warn("Web Audio API failed to initialize:", e);
        this.supported = false;
      }
    }
  },

  play(type) {
    if (!state.soundEnabled) return;
    this.init();
    if (!this.supported || !this.ctx) return;
    
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.warn("Failed to resume AudioContext:", e);
      return;
    }

    const t = this.ctx.currentTime;
    
    switch (type) {
      case 'tap': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
        
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        
        osc.start(t);
        osc.stop(t + 0.12);
        break;
      }
      
      case 'pop': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
        
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      }
      
      case 'correct': {
        // Double tone (major third chord effect)
        [523.25, 659.25].forEach((f, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t + idx * 0.05);
          
          gain.gain.setValueAtTime(0.12, t + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.05 + 0.2);
          
          osc.start(t + idx * 0.05);
          osc.stop(t + idx * 0.05 + 0.25);
        });
        break;
      }
      
      case 'wrong': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130.81, t); // low buzz (C3)
        osc.frequency.linearRampToValueAtTime(110.0, t + 0.3);
        
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        
        osc.start(t);
        osc.stop(t + 0.35);
        break;
      }
      
      case 'success': {
        // Fast ascending arpeggio (C major triad)
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((f, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t + idx * 0.08);
          
          gain.gain.setValueAtTime(0.1, t + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.08 + 0.25);
          
          osc.start(t + idx * 0.08);
          osc.stop(t + idx * 0.08 + 0.3);
        });
        break;
      }
    }
  }
};

// --- REDESIGNED BULLETPROOF SPEECH ENGINE (TTS) ---
const TTS = {
  supported: false,
  voices: [],
  activeUtterance: null,
  pendingTimeout: null,

  init() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window && !!window.speechSynthesis;
    if (!this.supported) {
      console.warn("Speech synthesis is not supported in this browser.");
      return;
    }

    try {
      this.voices = window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.voices = window.speechSynthesis.getVoices();
          if (typeof app !== 'undefined' && app.updateRhymeLangButtonUI) {
            app.updateRhymeLangButtonUI();
          }
        };
      }
    } catch (e) {
      console.warn("Speech synthesis initialization failed:", e);
      this.supported = false;
    }
  },

  hasHindiVoice() {
    if (!this.supported) return false;
    try {
      if (this.voices.length === 0) {
        this.voices = window.speechSynthesis.getVoices();
      }
      return this.voices.some(voice => {
        const vLang = voice.lang.toLowerCase();
        const vName = voice.name.toLowerCase();
        return vLang.startsWith('hi') || vName.includes('hindi');
      });
    } catch (e) {
      return false;
    }
  },

  cancel() {
    if (!this.supported) return;
    try {
      if (this.pendingTimeout) {
        clearTimeout(this.pendingTimeout);
        this.pendingTimeout = null;
      }
      window.speechSynthesis.cancel();
      this.activeUtterance = null;
    } catch (e) {
      console.warn("Error calling speechSynthesis.cancel:", e);
    }
  },

  speak(text, lang = 'en-US', onBoundary = null, onEnd = null, interrupt = true) {
    if (!state.soundEnabled) {
      if (onEnd) onEnd();
      return null;
    }

    if (!this.supported) {
      if (onEnd) setTimeout(onEnd, 2000);
      return null;
    }

    // Cancel any active timeouts to prevent multiple speech queueing overlap
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }

    if (interrupt) {
      this.cancel();
      
      // Strict 250ms transition settle delay to let Chrome SpeechSynthesis engine clear queue
      this.pendingTimeout = setTimeout(() => {
        this.performSpeak(text, lang, onBoundary, onEnd);
      }, 250);
    } else {
      this.performSpeak(text, lang, onBoundary, onEnd);
    }
  },

  performSpeak(text, lang, onBoundary, onEnd) {
    try {
      // Force resume in case queue is paused
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (err) {}

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.volume = 1;
      utterance.rate = 0.85; // Slightly slower for children clarity

      if (this.voices.length === 0) {
        this.voices = window.speechSynthesis.getVoices();
      }

      // Voice selection heuristics
      const isHindi = lang.toLowerCase().startsWith('hi');
      const preferredVoices = isHindi
        ? ['google हिन्दी', 'lekha', 'rishi', 'hi-in', 'hi_in'] 
        : ['google us english', 'samantha', 'en-us', 'en_us'];
        
      const prefix = isHindi ? 'hi' : 'en';
      const langVoices = this.voices.filter(voice => voice.lang.toLowerCase().startsWith(prefix));
      
      let matchingVoice = null;
      if (langVoices.length > 0) {
        // Preferred Local
        matchingVoice = langVoices.find(voice => 
          voice.localService && preferredVoices.some(pref => voice.name.toLowerCase().includes(pref) || voice.lang.toLowerCase().includes(pref))
        );
        // Fallback Any Local
        if (!matchingVoice) {
          matchingVoice = langVoices.find(voice => voice.localService);
        }
        // Preferred Cloud
        if (!matchingVoice) {
          matchingVoice = langVoices.find(voice => 
            preferredVoices.some(pref => voice.name.toLowerCase().includes(pref) || voice.lang.toLowerCase().includes(pref))
          );
        }
        // First of language
        if (!matchingVoice) {
          matchingVoice = langVoices[0];
        }
      }

      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      if (onBoundary) {
        utterance.onboundary = onBoundary;
      }

      this.activeUtterance = utterance;

      // Keep strong reference in a global window array to prevent Chrome Garbage Collection bug
      if (!window._speechUtterances) {
        window._speechUtterances = [];
      }
      window._speechUtterances.push(utterance);

      let callbackTriggered = false;
      const doneCallback = (event) => {
        if (callbackTriggered) return;
        callbackTriggered = true;

        if (watchdog) {
          clearTimeout(watchdog);
          watchdog = null;
        }

        // Clean up global array reference
        if (window._speechUtterances) {
          const idx = window._speechUtterances.indexOf(utterance);
          if (idx > -1) {
            window._speechUtterances.splice(idx, 1);
          }
        }

        if (this.activeUtterance === utterance) {
          this.activeUtterance = null;
        }

        if (onEnd) {
          onEnd(event);
        }
      };

      // Watchdog fallback (7 seconds safety lock)
      let watchdog = setTimeout(() => {
        console.warn("TTS fallback watchdog triggered:", text);
        doneCallback({ type: 'watchdog' });
      }, 7000);

      utterance.onend = doneCallback;
      utterance.onerror = (event) => {
        const errType = event.error || '';
        
        // If preferred voice fails (e.g. cloud voice connection timeout) and it wasn't cancelled, retry with browser default
        if (errType !== 'interrupted' && errType !== 'canceled' && errType !== 'cancelled' && utterance.voice) {
          console.warn(`TTS voice '${utterance.voice.name}' failed with '${errType}'. Retrying with default voice.`);
          
          if (watchdog) {
            clearTimeout(watchdog);
            watchdog = null;
          }
          if (window._speechUtterances) {
            const idx = window._speechUtterances.indexOf(utterance);
            if (idx > -1) {
              window._speechUtterances.splice(idx, 1);
            }
          }
          
          setTimeout(() => {
            try {
              const fallback = new SpeechSynthesisUtterance(text);
              fallback.lang = lang;
              fallback.volume = 1;
              fallback.rate = 0.85;
              fallback.onend = doneCallback;
              fallback.onerror = doneCallback;
              window.speechSynthesis.speak(fallback);
            } catch (err) {
              doneCallback();
            }
          }, 100);
          return;
        }
        doneCallback(event);
      };

      try {
        window.speechSynthesis.resume();
      } catch (err) {}
      window.speechSynthesis.speak(utterance);
      return utterance;
    } catch (e) {
      console.error("Error in performSpeak:", e);
      if (onEnd) onEnd();
      return null;
    }
  }
};

// --- TRACING CANVAS BOARD MODULE ---
const tracingBoard = {
  canvas: null,
  ctx: null,
  isDrawing: false,
  currentChar: 'A',
  lastX: 0,
  lastY: 0,
  drawnPoints: [],

  init() {
    this.canvas = document.getElementById('tracing-canvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Canvas drawing handlers
    this.canvas.addEventListener('mousedown', (e) => this.startDraw(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.stopDraw());
    this.canvas.addEventListener('mouseout', () => this.stopDraw());

    this.canvas.addEventListener('touchstart', (e) => this.startDraw(e));
    this.canvas.addEventListener('touchmove', (e) => this.draw(e));
    this.canvas.addEventListener('touchend', () => this.stopDraw());

    // Controls
    document.getElementById('tracing-clear-btn').addEventListener('click', () => {
      this.clear();
      AudioSynth.play('pop');
    });

    document.getElementById('tracing-done-btn').addEventListener('click', () => {
      this.closeModal(true);
    });

    document.getElementById('tracing-close-btn').addEventListener('click', () => {
      this.closeModal(false);
    });
  },

  resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    
    // Store current drawings as image
    let tempImage = null;
    try {
      if (this.canvas.width > 0 && this.canvas.height > 0) {
        tempImage = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      }
    } catch (e) {}

    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    // Reset styles
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = 14;
    this.ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--canvas-brush').trim() || '#ffffff';

    if (tempImage) {
      try {
        this.ctx.putImageData(tempImage, 0, 0);
      } catch (e) {}
    }
  },

  open(char) {
    this.currentChar = char;
    this.drawnPoints = [];
    
    const isNum = /^[0-9]+$/.test(char);
    const isHindi = !isNum && !/[a-zA-Z]/.test(char);

    const titleEl = document.querySelector('.tracing-title');
    if (titleEl) {
      if (isNum) {
        titleEl.innerHTML = `Trace the Number <span id="tracing-letter-title">${char}</span>`;
      } else if (isHindi) {
        titleEl.innerHTML = `अक्षर <span id="tracing-letter-title">${char}</span> लिखें`;
      } else {
        titleEl.innerHTML = `Trace the Letter <span id="tracing-letter-title">${char}</span>`;
      }
    }

    document.getElementById('tracing-guide-char').textContent = char;
    
    const modal = document.getElementById('tracing-modal');
    if (modal) {
      modal.classList.add('active');
    }
    
    // Resize & Clear
    setTimeout(() => {
      this.resizeCanvas();
      this.clear();
      if (isNum) {
        TTS.speak(`Trace the number ${char}`, 'en-US');
      } else if (isHindi) {
        TTS.speak(`अक्षर ${char} लिखें`, 'hi-IN');
      } else {
        TTS.speak(`Trace the letter ${char}`, 'en-US');
      }
    }, 150);
  },

  closeModal(spawnConfetti = false) {
    if (spawnConfetti) {
      const isNum = /^[0-9]+$/.test(this.currentChar);
      const isHindi = !isNum && !/[a-zA-Z]/.test(this.currentChar);

      if (this.drawnPoints.length < 6) {
        AudioSynth.play('wrong');
        if (isNum) {
          app.showToast("Draw a bit more to cover the number! 📝");
          TTS.speak("Please draw a bit more to cover the number outline!", 'en-US');
        } else if (isHindi) {
          app.showToast("कृपया पहले अक्षर लिखें! ✍️");
          TTS.speak("कृपया पहले अक्षर लिखें", 'hi-IN');
        } else {
          app.showToast("Draw a bit more to cover the letter! 📝");
          TTS.speak("Please draw a bit more to cover the letter outline!", 'en-US');
        }
        return;
      }

      // Generate mask from offscreen canvas
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = this.canvas.width;
      maskCanvas.height = this.canvas.height;
      const maskCtx = maskCanvas.getContext('2d');

      // Setup styling exactly matching guide character
      const guideCharEl = document.getElementById('tracing-guide-char');
      const fontSize = getComputedStyle(guideCharEl).fontSize;
      maskCtx.font = `bold ${fontSize} Fredoka, Quicksand, sans-serif`;
      maskCtx.textAlign = 'center';
      maskCtx.textBaseline = 'middle';
      maskCtx.fillStyle = 'red';
      maskCtx.fillText(this.currentChar, maskCanvas.width / 2, maskCanvas.height / 2);

      // Extract mask coordinates
      const imgData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const data = imgData.data;
      const letterPixels = [];
      const sampleStep = 8;
      for (let y = 0; y < maskCanvas.height; y += sampleStep) {
        for (let x = 0; x < maskCanvas.width; x += sampleStep) {
          const idx = (y * maskCanvas.width + x) * 4;
          const alpha = data[idx + 3];
          if (alpha > 40) { // Found a filled letter pixel
            letterPixels.push({ x, y });
          }
        }
      }

      if (letterPixels.length === 0) {
        this.closeAndReward(spawnConfetti);
        return;
      }

      // Calculate accuracy & coverage
      const tolerance = 40; // Pixels distance limit
      let closeUserPoints = 0;

      this.drawnPoints.forEach(p => {
        let minD = Infinity;
        for (let i = 0; i < letterPixels.length; i++) {
          const lp = letterPixels[i];
          const dx = p.x - lp.x;
          const dy = p.y - lp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minD) {
            minD = dist;
          }
          if (minD < tolerance) break;
        }
        if (minD < tolerance) {
          closeUserPoints++;
        }
      });

      const accuracy = closeUserPoints / this.drawnPoints.length;

      let coveredLetterPixels = 0;
      letterPixels.forEach(lp => {
        let hasClosePoint = false;
        for (let i = 0; i < this.drawnPoints.length; i++) {
          const p = this.drawnPoints[i];
          const dx = p.x - lp.x;
          const dy = p.y - lp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < tolerance) {
            hasClosePoint = true;
            break;
          }
        }
        if (hasClosePoint) {
          coveredLetterPixels++;
        }
      });

      const coverage = coveredLetterPixels / letterPixels.length;

      // Check thresholds
      if (accuracy < 0.95) {
        AudioSynth.play('wrong');
        if (isNum) {
          app.showToast("Try to stay inside the number outline! ✍️");
          TTS.speak("Try to stay inside the lines!", 'en-US');
        } else if (isHindi) {
          app.showToast("अक्षर की रेखाओं के अंदर लिखने का प्रयास करें! ✍️");
          TTS.speak("रेखाओं के अंदर लिखने का प्रयास करें", 'hi-IN');
        } else {
          app.showToast("Try to stay inside the letter outline! ✍️");
          TTS.speak("Try to stay inside the lines!", 'en-US');
        }
        return;
      }

      if (coverage < 0.90) {
        AudioSynth.play('wrong');
        if (isNum) {
          app.showToast("Draw a bit more to cover the number! 📝");
          TTS.speak("Please cover the whole number outline!", 'en-US');
        } else if (isHindi) {
          app.showToast("पूरा अक्षर लिखने का प्रयास करें! 📝");
          TTS.speak("कृपया पूरा अक्षर लिखें", 'hi-IN');
        } else {
          app.showToast("Draw a bit more to cover the letter! 📝");
          TTS.speak("Please cover the whole letter outline!", 'en-US');
        }
        return;
      }
    }

    this.closeAndReward(spawnConfetti);
  },

  closeAndReward(spawnConfetti = false) {
    const modal = document.getElementById('tracing-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    AudioSynth.play('tap');
    if (spawnConfetti) {
      AudioSynth.play('success');
      confettiEffect.createConfetti(40);
      
      const isNum = /^[0-9]+$/.test(this.currentChar);
      const isHindi = !isNum && !/[a-zA-Z]/.test(this.currentChar);
      
      if (isNum) {
        app.showToast("Awesome number tracing! ⭐");
      } else if (isHindi) {
        app.showToast("शानदार लेखन! ⭐");
      } else {
        app.showToast("Awesome tracing! ⭐");
      }
    }
  },

  clear() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawnPoints = [];
  },

  getEventCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  },

  startDraw(e) {
    e.preventDefault();
    this.isDrawing = true;
    const coords = this.getEventCoords(e);
    this.lastX = coords.x;
    this.lastY = coords.y;
    this.drawnPoints.push({ x: coords.x, y: coords.y });
  },

  draw(e) {
    if (!this.isDrawing) return;
    e.preventDefault();
    
    const coords = this.getEventCoords(e);
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.stroke();
    
    this.lastX = coords.x;
    this.lastY = coords.y;
    this.drawnPoints.push({ x: coords.x, y: coords.y });
  },

  stopDraw() {
    this.isDrawing = false;
  }
};

// --- SPEECH DIAGNOSTICS & TROUBLESHOOTER CONTROLLER ---
const Diagnostics = {
  modal: null,
  closeBtn: null,
  voiceSelect: null,
  testTextInput: null,
  speechTestBtn: null,
  audioTestBtn: null,
  copyBtn: null,
  consoleEl: null,
  statusAudio: null,
  statusSpeech: null,
  statusVoicesCount: null,

  init() {
    this.modal = document.getElementById('diagnostics-modal');
    if (!this.modal) return;

    this.closeBtn = document.getElementById('diagnostics-close-btn');
    this.voiceSelect = document.getElementById('diag-voice-select');
    this.testTextInput = document.getElementById('diag-test-text');
    this.speechTestBtn = document.getElementById('diag-btn-speech-test');
    this.audioTestBtn = document.getElementById('diag-btn-audio-test');
    this.copyBtn = document.getElementById('diag-btn-copy-command');
    this.consoleEl = document.getElementById('diag-log-console');
    this.statusAudio = document.getElementById('diag-status-audio');
    this.statusSpeech = document.getElementById('diag-status-speech');
    this.statusVoicesCount = document.getElementById('diag-status-voices-count');

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
    
    this.modal.addEventListener('click', (e) => {
      if (e.target.id === 'diagnostics-modal') {
        this.close();
      }
    });

    if (this.speechTestBtn) {
      this.speechTestBtn.addEventListener('click', () => this.runSpeechTest());
    }

    if (this.audioTestBtn) {
      this.audioTestBtn.addEventListener('click', () => this.runAudioTest());
    }

    if (this.copyBtn) {
      this.copyBtn.addEventListener('click', () => this.copyCommand());
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.populateVoices();
      };
    }
  },

  log(msg, type = 'info') {
    if (!this.consoleEl) return;
    const line = document.createElement('div');
    line.className = `diag-log-line log-${type}`;
    const timestamp = new Date().toLocaleTimeString();
    line.textContent = `[${timestamp}] ${msg}`;
    this.consoleEl.appendChild(line);
    this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
    console.log(`[Diag Log] ${msg}`);
  },

  open() {
    if (!this.modal) return;
    this.modal.classList.add('active');
    this.log("Diagnostics panel opened", "info");
    this.checkAPIStatus();
    this.populateVoices();
  },

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('active');
    AudioSynth.play('tap');
  },

  checkAPIStatus() {
    this.log("Checking API Support...", "info");
    
    // Web Audio API Status
    if (AudioSynth.supported) {
      const stateStr = AudioSynth.ctx ? AudioSynth.ctx.state : 'uninitialized';
      this.log(`Web Audio API is supported. State: ${stateStr}`, "success");
      if (this.statusAudio) {
        this.statusAudio.textContent = stateStr.toUpperCase();
        this.statusAudio.className = 'badge ' + (stateStr === 'running' ? 'status-ok' : 'status-warn');
      }
    } else {
      this.log("Web Audio API is not supported in this browser.", "err");
      if (this.statusAudio) {
        this.statusAudio.textContent = 'NOT SUPPORTED';
        this.statusAudio.className = 'badge status-error';
      }
    }

    // Speech Synthesis Status
    if (TTS.supported) {
      this.log("Web Speech Synthesis API is supported.", "success");
      const speaking = window.speechSynthesis.speaking;
      const pending = window.speechSynthesis.pending;
      const paused = window.speechSynthesis.paused;
      this.log(`Speech synthesis states - speaking: ${speaking}, pending: ${pending}, paused: ${paused}`, "info");
      
      let statusText = 'READY';
      let badgeClass = 'status-ok';
      if (speaking) {
        statusText = 'SPEAKING';
        badgeClass = 'status-warn';
      } else if (paused) {
        statusText = 'PAUSED';
        badgeClass = 'status-warn';
      }
      
      if (this.statusSpeech) {
        this.statusSpeech.textContent = statusText;
        this.statusSpeech.className = `badge ${badgeClass}`;
      }
    } else {
      this.log("Web Speech Synthesis API is NOT supported.", "err");
      if (this.statusSpeech) {
        this.statusSpeech.textContent = 'NOT SUPPORTED';
        this.statusSpeech.className = 'badge status-error';
      }
    }
  },

  populateVoices() {
    if (!this.voiceSelect || !TTS.supported) return;
    
    const voices = window.speechSynthesis.getVoices();
    this.log(`Voices found: ${voices.length}`, "info");
    
    if (this.statusVoicesCount) {
      this.statusVoicesCount.textContent = voices.length;
      this.statusVoicesCount.className = 'badge ' + (voices.length > 0 ? 'status-ok' : 'status-error');
    }

    const prevSelected = this.voiceSelect.value;
    this.voiceSelect.innerHTML = '<option value="">(Default Browser Voice)</option>';
    
    voices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})${voice.localService ? ' [Local]' : ''}`;
      if (voice.name === prevSelected) {
        option.selected = true;
      }
      this.voiceSelect.appendChild(option);
    });
  },

  runAudioTest() {
    this.log("Triggering Web Audio pop test...", "info");
    try {
      AudioSynth.play('pop');
      this.log("Web Audio pop command sent successfully.", "success");
      setTimeout(() => this.checkAPIStatus(), 200);
    } catch (e) {
      this.log(`Web Audio test failed: ${e.message}`, "err");
    }
  },

  runSpeechTest() {
    if (!TTS.supported) {
      this.log("Cannot run speech test: SpeechSynthesis is not supported.", "err");
      return;
    }

    const text = this.testTextInput ? this.testTextInput.value : "Testing voice output";
    const selectedVoiceName = this.voiceSelect ? this.voiceSelect.value : "";
    
    this.log(`Initiating speech test: "${text}"`, "info");
    TTS.cancel();

    // Re-check support and run
    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        
        if (selectedVoiceName) {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.name === selectedVoiceName);
          if (voice) {
            utterance.voice = voice;
            this.log(`Testing voice: ${voice.name}`, "info");
          }
        }

        utterance.onstart = () => {
          this.log("Speech Event: ONSTART", "success");
          this.checkAPIStatus();
        };

        utterance.onend = (e) => {
          this.log(`Speech Event: ONEND. Elapsed: ${e.elapsedTime}ms`, "success");
          this.checkAPIStatus();
        };

        utterance.onerror = (e) => {
          this.log(`Speech Event: ONERROR - error: "${e.error}"`, "err");
          this.checkAPIStatus();
        };

        this.log("Invoking speechSynthesis.speak()...", "info");
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        this.log(`Exception during test: ${e.message}`, "err");
      }
    }, 250); // Settle cancellation
  },

  copyCommand() {
    const cmdText = document.getElementById('diag-terminal-command').textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cmdText).then(() => {
        this.log("Terminal fix command copied to clipboard!", "success");
        if (this.copyBtn) {
          const originalText = this.copyBtn.textContent;
          this.copyBtn.textContent = '✅ Copied!';
          setTimeout(() => {
            this.copyBtn.textContent = originalText;
          }, 2000);
        }
      }).catch(err => {
        this.log(`Failed to copy command: ${err}`, "err");
      });
    } else {
      this.log("Clipboard API not supported in browser. Copy manually.", "warn");
    }
  }
};

// --- APP ROUTING & CORE GAMEPLAY LOGIC ---
const app = {
  _userToggledLanguage: false,

  async init() {
    // 1. Fetch JSON curriculum configurations
    await loadCurriculumData();

    // 2. Setup systems
    TTS.init();
    tracingBoard.init();
    Diagnostics.init();

    // 3. Render dynamic content
    this.setupEventListeners();
    this.renderAlphabetCards();
    this.renderVarnamalaCards();
    this.renderNumbersGrid();
    this.renderRhymesList();

    // 4. Set Defaults
    this.updateTheme(state.theme);
    this.updateSoundButtonUI();
    this.updateRhymeLangButtonUI();
    this.selectNumber(1, false);

    if (appData.rhymes && appData.rhymes.length > 0) {
      this.selectRhyme(appData.rhymes[0].id, false);
    }
    
    // 5. iOS sound tip display detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
      const banner = document.getElementById('ios-sound-banner');
      if (banner) {
        banner.style.display = 'flex';
      }
    }
  },

  switchSection(sectionId) {
    TTS.cancel();
    state.isPlayingRhyme = false;
    this.updateRhymePlayButtonUI();
    
    this.resetAlphabetQuiz();
    this.resetVarnamalaQuiz();
    this.resetNumbersQuiz();

    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });
    
    const activeSection = document.getElementById(`${sectionId}-section`);
    if (activeSection) {
      activeSection.classList.add('active');
      state.activeSection = sectionId;
    }

    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-target') === sectionId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    AudioSynth.play('tap');
  },

  updateTheme(themeName) {
    document.body.className = `theme-${themeName}`;
    state.theme = themeName;
    
    document.querySelectorAll('.theme-btn').forEach(btn => {
      if (btn.getAttribute('data-theme') === themeName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const mobThemeBtn = document.getElementById('mobile-theme-btn');
    if (mobThemeBtn) {
      mobThemeBtn.textContent = themeName === 'light' ? '☀️' : (themeName === 'dark' ? '🌙' : '📖');
    }
  },

  toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    if (!state.soundEnabled) {
      TTS.cancel();
      state.isPlayingRhyme = false;
      this.updateRhymePlayButtonUI();
    }
    this.updateSoundButtonUI();
    AudioSynth.play('tap');
  },

  updateSoundButtonUI() {
    const soundToggle = document.getElementById('sound-toggle');
    const mobSoundBtn = document.getElementById('mobile-sound-btn');
    const icon = state.soundEnabled ? '🔊' : '🔇';
    const text = state.soundEnabled ? 'Sound: ON' : 'Sound: OFF';

    if (soundToggle) {
      const soundIcon = document.getElementById('sound-icon');
      const soundText = document.getElementById('sound-text');
      if (soundIcon) soundIcon.textContent = icon;
      if (soundText) soundText.textContent = text;
    }
    if (mobSoundBtn) {
      mobSoundBtn.textContent = icon;
    }
  },

  setupEventListeners() {
    // Navigation link buttons
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        this.switchSection(target);
      });
    });

    // Theme select buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.getAttribute('data-theme');
        this.updateTheme(selected);
        AudioSynth.play('tap');
      });
    });

    // Mobile theme select button cycling
    const mobThemeBtn = document.getElementById('mobile-theme-btn');
    if (mobThemeBtn) {
      mobThemeBtn.addEventListener('click', () => {
        const themes = ['light', 'dark', 'epaper'];
        const currentIdx = themes.indexOf(state.theme);
        const nextTheme = themes[(currentIdx + 1) % themes.length];
        this.updateTheme(nextTheme);
        AudioSynth.play('tap');
      });
    }

    // Sound toggle buttons
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => this.toggleSound());
    }
    const mobSoundBtn = document.getElementById('mobile-sound-btn');
    if (mobSoundBtn) {
      mobSoundBtn.addEventListener('click', () => this.toggleSound());
    }

    // Alphabet Section Toggle Mode Buttons
    document.getElementById('alpha-mode-cards').addEventListener('click', () => {
      this.toggleAlphabetMode('cards');
      AudioSynth.play('tap');
    });
    document.getElementById('alpha-mode-quiz').addEventListener('click', () => {
      this.toggleAlphabetMode('quiz');
      AudioSynth.play('tap');
    });
    document.getElementById('alpha-restart-btn').addEventListener('click', () => {
      this.startAlphabetQuiz();
      AudioSynth.play('tap');
    });

    // Varnamala Section Toggle Mode Buttons
    document.getElementById('varna-mode-cards').addEventListener('click', () => {
      this.toggleVarnamalaMode('cards');
      AudioSynth.play('tap');
    });
    document.getElementById('varna-mode-quiz').addEventListener('click', () => {
      this.toggleVarnamalaMode('quiz');
      AudioSynth.play('tap');
    });
    document.getElementById('varna-restart-btn').addEventListener('click', () => {
      this.startVarnamalaQuiz();
      AudioSynth.play('tap');
    });

    // Numbers Section Toggle Mode Buttons
    document.getElementById('num-mode-learn').addEventListener('click', () => {
      this.toggleNumbersMode('learn');
      AudioSynth.play('tap');
    });
    document.getElementById('num-mode-quiz').addEventListener('click', () => {
      this.toggleNumbersMode('quiz');
      AudioSynth.play('tap');
    });
    document.getElementById('num-restart-btn').addEventListener('click', () => {
      this.startNumbersQuiz();
      AudioSynth.play('tap');
    });

    // Rhyme Playback Buttons
    document.getElementById('rhyme-play-btn').addEventListener('click', () => {
      this.togglePlayRhyme();
    });
    document.getElementById('rhyme-stop-btn').addEventListener('click', () => {
      this.stopRhyme();
      AudioSynth.play('tap');
    });
    const langBtn = document.getElementById('rhyme-lang-btn');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        state.rhymeLanguageMode = state.rhymeLanguageMode === 'native' ? 'romanized' : 'native';
        this._userToggledLanguage = true;
        this.stopRhyme();
        this.updateRhymeLangButtonUI();
        AudioSynth.play('tap');
      });
    }

    // Diagnostics buttons
    const diagOpenBtn = document.getElementById('diag-open-btn');
    if (diagOpenBtn) {
      diagOpenBtn.addEventListener('click', () => {
        Diagnostics.open();
        AudioSynth.play('tap');
      });
    }
    const mobDiagBtn = document.getElementById('mobile-diag-btn');
    if (mobDiagBtn) {
      mobDiagBtn.addEventListener('click', () => {
        Diagnostics.open();
        AudioSynth.play('tap');
      });
    }
    const homeDiagLink = document.getElementById('home-diag-link');
    if (homeDiagLink) {
      homeDiagLink.addEventListener('click', (e) => {
        e.preventDefault();
        Diagnostics.open();
        AudioSynth.play('tap');
      });
    }

    // Quiz Difficulty Selector Menus Bindings
    document.querySelectorAll('#alpha-diff-tabs .diff-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const diff = tab.getAttribute('data-diff');
        state.alphaDifficulty = diff;
        document.querySelectorAll('#alpha-diff-tabs .diff-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        AudioSynth.play('tap');
        this.startAlphabetQuiz();
      });
    });

    document.querySelectorAll('#varna-diff-tabs .diff-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const diff = tab.getAttribute('data-diff');
        state.varnaDifficulty = diff;
        document.querySelectorAll('#varna-diff-tabs .diff-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        AudioSynth.play('tap');
        this.startVarnamalaQuiz();
      });
    });

    document.querySelectorAll('#num-diff-tabs .diff-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const diff = tab.getAttribute('data-diff');
        state.numDifficulty = diff;
        document.querySelectorAll('#num-diff-tabs .diff-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        AudioSynth.play('tap');
        this.startNumbersQuiz();
      });
    });
  },

  // --- ALPHABET MODULE ---
  renderAlphabetCards() {
    const container = document.getElementById('alpha-cards-container');
    if (!container) return;
    container.innerHTML = '';

    appData.alphabet.forEach(item => {
      const card = document.createElement('div');
      card.className = 'letter-card';
      card.setAttribute('data-char', item.char);

      card.innerHTML = `
        <div class="letter-card-inner">
          <div class="letter-card-front" style="border-color: ${item.color}">
            <span class="letter-char" style="color: ${item.color}">${item.char}</span>
          </div>
          <div class="letter-card-back" style="background-color: ${item.color}15; border-color: ${item.color}">
            <div class="letter-icon-back" style="font-size: 2.5rem; margin-bottom: 5px;">${item.emoji}</div>
            <span class="letter-word-back">${item.word}</span>
            <button class="tracing-btn-mini" style="margin-top: 10px; font-size: 0.85rem; padding: 4px 8px; border: 2px solid ${item.color}; border-radius: 6px; font-weight: bold; background: var(--bg-card); color: var(--text-main);" onclick="event.stopPropagation(); tracingBoard.open('${item.char}');">✍️ Trace</button>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        card.classList.toggle('flipped');
        AudioSynth.play('pop');
        
        if (card.classList.contains('flipped')) {
          TTS.speak(`${item.char} for ${item.word}`);
        } else {
          TTS.speak(item.char);
        }
      });

      container.appendChild(card);
    });
  },

  toggleAlphabetMode(mode) {
    const cardsBtn = document.getElementById('alpha-mode-cards');
    const quizBtn = document.getElementById('alpha-mode-quiz');
    const cardsGrid = document.getElementById('alpha-cards-container');
    const quizContainer = document.getElementById('alpha-quiz-container');
    const resultContainer = document.getElementById('alpha-result-container');

    if (mode === 'cards') {
      cardsBtn.classList.add('active');
      quizBtn.classList.remove('active');
      cardsGrid.style.display = 'grid';
      quizContainer.style.display = 'none';
      resultContainer.style.display = 'none';
      this.resetAlphabetQuiz();
    } else {
      cardsBtn.classList.remove('active');
      quizBtn.classList.add('active');
      cardsGrid.style.display = 'none';
      quizContainer.style.display = 'block';
      resultContainer.style.display = 'none';
      this.startAlphabetQuiz();
    }
  },

  resetAlphabetQuiz() {
    state.alphaQuizActive = false;
    state.alphaQuizScore = 0;
    state.alphaQuizCount = 0;
    state.alphaCurrentTarget = null;
  },

  startAlphabetQuiz() {
    state.alphaQuizActive = true;
    state.alphaQuizScore = 0;
    state.alphaQuizCount = 0;
    document.getElementById('alpha-result-container').classList.remove('active');
    document.getElementById('alpha-quiz-container').style.display = 'block';
    this.nextAlphabetQuestion();
  },

  nextAlphabetQuestion() {
    if (state.alphaQuizCount >= 10) {
      this.showAlphabetResults();
      return;
    }

    state.alphaQuizCount++;
    document.getElementById('alpha-score').textContent = state.alphaQuizScore;
    
    // Select target randomly
    const targetIdx = Math.floor(Math.random() * appData.alphabet.length);
    const target = appData.alphabet[targetIdx];
    state.alphaCurrentTarget = target;

    const targetDisplay = document.getElementById('alpha-quiz-target');
    const quizPromptText = document.getElementById('alpha-quiz-prompt-text');
    const quizInstruction = document.getElementById('alpha-quiz-instruction');

    // Load question layout according to Difficulty Menu selection
    if (state.alphaDifficulty === 'easy') {
      // Find letter
      quizPromptText.textContent = "Find the letter:";
      quizInstruction.textContent = "Tap the card for the letter:";
      targetDisplay.textContent = target.char;
      targetDisplay.style.color = target.color;
      TTS.speak(`Find the letter ${target.char}`);
    } else if (state.alphaDifficulty === 'medium') {
      // Find matching item (Vocabulary)
      quizPromptText.textContent = "Find the word:";
      quizInstruction.textContent = "Which emoji matches the word:";
      targetDisplay.textContent = target.word;
      targetDisplay.style.color = target.color;
      TTS.speak(`Find the ${target.word}`);
    } else {
      // Hard: Spelling (Spell the word for emoji)
      quizPromptText.textContent = "Spell the item:";
      quizInstruction.textContent = "Choose the correct spelling for:";
      targetDisplay.textContent = target.emoji;
      TTS.speak(`Spell the word for ${target.word}`);
    }

    // Generate 4 MC Options
    let options = [target];
    while (options.length < 4) {
      const randOpt = appData.alphabet[Math.floor(Math.random() * appData.alphabet.length)];
      if (!options.some(opt => opt.char === randOpt.char)) {
        options.push(randOpt);
      }
    }
    options.sort(() => Math.random() - 0.5);

    // Render option buttons
    const optionsGrid = document.getElementById('alpha-quiz-options');
    optionsGrid.innerHTML = '';

    // Hard difficulty: Generate spelling alternatives (misspellings) for the target
    let spellingOptions = [];
    if (state.alphaDifficulty === 'hard') {
      spellingOptions = this.getSpellingOptions(target.word);
    }

    options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.style.borderColor = opt.color;

      if (state.alphaDifficulty === 'easy') {
        // Options show big letters
        btn.innerHTML = `<span style="font-size: 2.8rem; font-weight: 800; color: ${opt.color}">${opt.char}</span>`;
      } else if (state.alphaDifficulty === 'medium') {
        // Options show emoji + word description
        btn.innerHTML = `
          <div style="font-size: 2.2rem;">${opt.emoji}</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: var(--text-main);">${opt.word}</div>
        `;
      } else {
        // Hard mode: Spellings choices (we display text choices, adjusting styles to prevent wrapping)
        btn.classList.add('word-option');
        const wordText = spellingOptions[idx];
        btn.style.borderColor = target.color;
        btn.innerHTML = `<span style="font-weight: 800;">${wordText}</span>`;
      }

      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        
        // Prevent double taps
        optionsGrid.querySelectorAll('.quiz-option-btn').forEach(b => b.disabled = true);

        let isCorrect = false;
        if (state.alphaDifficulty === 'easy') {
          isCorrect = (opt.char === target.char);
        } else if (state.alphaDifficulty === 'medium') {
          isCorrect = (opt.char === target.char);
        } else {
          isCorrect = (spellingOptions[idx] === target.word);
        }

        if (isCorrect) {
          btn.classList.add('correct');
          AudioSynth.play('correct');
          state.alphaQuizScore++;
          document.getElementById('alpha-score').textContent = state.alphaQuizScore;
          
          confettiEffect.createConfetti(15);
          
          const speakPhrase = (state.alphaDifficulty === 'hard') 
            ? `Correct spelling! ${target.word}!`
            : `Correct! ${target.char} for ${target.word}`;
            
          TTS.speak(speakPhrase, 'en-US', null, () => {
            setTimeout(() => this.nextAlphabetQuestion(), 1200);
          });
        } else {
          btn.classList.add('wrong');
          AudioSynth.play('wrong');
          
          // Highlight correct option
          optionsGrid.querySelectorAll('.quiz-option-btn').forEach((b, oIdx) => {
            let matchesTarget = false;
            if (state.alphaDifficulty === 'easy' || state.alphaDifficulty === 'medium') {
              matchesTarget = (options[oIdx].char === target.char);
            } else {
              matchesTarget = (spellingOptions[oIdx] === target.word);
            }
            if (matchesTarget) {
              b.classList.add('correct');
            }
          });

          const wrongPhrase = (state.alphaDifficulty === 'hard')
            ? `Oops! That's spelled differently. Correct is ${target.word}.`
            : `Oops! That's the card for ${opt.word}.`;

          TTS.speak(wrongPhrase, 'en-US', null, () => {
            setTimeout(() => this.nextAlphabetQuestion(), 1600);
          });
        }
      });

      optionsGrid.appendChild(btn);
    });
  },

  // Helper spelling generator for hard quiz
  getSpellingOptions(word) {
    let list = [word];

    // Swapped adjacent characters
    if (word.length > 3) {
      let chars = word.split('');
      let idx = 1 + Math.floor(Math.random() * (chars.length - 2));
      let tmp = chars[idx];
      chars[idx] = chars[idx+1];
      chars[idx+1] = tmp;
      let misspelled = chars.join('');
      if (misspelled !== word) list.push(misspelled);
    }

    // Double letter insertion
    if (list.length < 4 && word.length > 2) {
      let chars = word.split('');
      let idx = Math.floor(Math.random() * chars.length);
      chars.splice(idx, 0, chars[idx]);
      let misspelled = chars.join('');
      if (misspelled !== word && !list.includes(misspelled)) {
        list.push(misspelled);
      }
    }

    // Dropped letter
    if (list.length < 4 && word.length > 3) {
      let chars = word.split('');
      let idx = 1 + Math.floor(Math.random() * (chars.length - 2));
      chars.splice(idx, 1);
      let misspelled = chars.join('');
      if (misspelled !== word && !list.includes(misspelled)) {
        list.push(misspelled);
      }
    }

    // Random fallback word options
    while (list.length < 4) {
      const fallbackItem = appData.alphabet[Math.floor(Math.random() * appData.alphabet.length)];
      if (!list.includes(fallbackItem.word)) {
        list.push(fallbackItem.word);
      }
    }

    // Shuffle spelling options list
    return list.sort(() => Math.random() - 0.5);
  },

  showAlphabetResults() {
    document.getElementById('alpha-quiz-container').style.display = 'none';
    const results = document.getElementById('alpha-result-container');
    results.classList.add('active');
    
    document.getElementById('alpha-final-score').textContent = state.alphaQuizScore;
    
    if (state.alphaQuizScore >= 7) {
      AudioSynth.play('success');
      confettiEffect.createConfetti(55);
      TTS.speak(`Superb job! You scored ${state.alphaQuizScore} stars out of ten!`);
    } else {
      AudioSynth.play('correct');
      TTS.speak(`Great effort! You scored ${state.alphaQuizScore} stars. Play again to improve!`);
    }
  },

  // --- VARNAMALA MODULE ---
  renderVarnamalaCards() {
    const container = document.getElementById('varna-cards-container');
    if (!container) return;
    container.innerHTML = '';

    appData.varnamala.forEach(item => {
      const card = document.createElement('div');
      card.className = 'letter-card';
      card.setAttribute('data-char', item.char);

      card.innerHTML = `
        <div class="letter-card-inner">
          <div class="letter-card-front" style="border-color: ${item.color}">
            <span class="letter-char" style="color: ${item.color}">${item.char}</span>
          </div>
          <div class="letter-card-back" style="background-color: ${item.color}15; border-color: ${item.color}">
            <div class="letter-icon-back" style="font-size: 2.5rem; margin-bottom: 5px;">${item.emoji}</div>
            <span class="letter-word-back">${item.word}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted); display: block;">(${item.englishWord})</span>
            <button class="tracing-btn-mini" style="margin-top: 6px; font-size: 0.85rem; padding: 4px 8px; border: 2px solid ${item.color}; border-radius: 6px; font-weight: bold; background: var(--bg-card); color: var(--text-main);" onclick="event.stopPropagation(); tracingBoard.open('${item.char}');">✍️ Trace</button>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        card.classList.toggle('flipped');
        AudioSynth.play('pop');
        
        if (card.classList.contains('flipped')) {
          TTS.speak(`${item.char} से ${item.word}`, 'hi-IN');
        } else {
          TTS.speak(item.char, 'hi-IN');
        }
      });

      container.appendChild(card);
    });
  },

  toggleVarnamalaMode(mode) {
    const cardsBtn = document.getElementById('varna-mode-cards');
    const quizBtn = document.getElementById('varna-mode-quiz');
    const cardsGrid = document.getElementById('varna-cards-container');
    const quizContainer = document.getElementById('varna-quiz-container');
    const resultContainer = document.getElementById('varna-result-container');

    if (mode === 'cards') {
      cardsBtn.classList.add('active');
      quizBtn.classList.remove('active');
      cardsGrid.style.display = 'grid';
      quizContainer.style.display = 'none';
      resultContainer.style.display = 'none';
      this.resetVarnamalaQuiz();
    } else {
      cardsBtn.classList.remove('active');
      quizBtn.classList.add('active');
      cardsGrid.style.display = 'none';
      quizContainer.style.display = 'block';
      resultContainer.style.display = 'none';
      this.startVarnamalaQuiz();
    }
  },

  resetVarnamalaQuiz() {
    state.varnaQuizActive = false;
    state.varnaQuizScore = 0;
    state.varnaQuizCount = 0;
    state.varnaCurrentTarget = null;
  },

  startVarnamalaQuiz() {
    state.varnaQuizActive = true;
    state.varnaQuizScore = 0;
    state.varnaQuizCount = 0;
    document.getElementById('varna-result-container').classList.remove('active');
    document.getElementById('varna-quiz-container').style.display = 'block';
    this.nextVarnamalaQuestion();
  },

  nextVarnamalaQuestion() {
    if (state.varnaQuizCount >= 10) {
      this.showVarnamalaResults();
      return;
    }

    state.varnaQuizCount++;
    document.getElementById('varna-score').textContent = state.varnaQuizScore;
    
    // Select target randomly
    const targetIdx = Math.floor(Math.random() * appData.varnamala.length);
    const target = appData.varnamala[targetIdx];
    state.varnaCurrentTarget = target;

    const targetDisplay = document.getElementById('varna-quiz-target');
    const quizPromptText = document.getElementById('varna-quiz-prompt-text');
    const quizInstruction = document.getElementById('varna-quiz-instruction');

    if (state.varnaDifficulty === 'easy') {
      quizPromptText.textContent = "अक्षर ढूंढें (Find the letter):";
      quizInstruction.textContent = "इस अक्षर के कार्ड को छुएं (Tap the card for):";
      targetDisplay.textContent = target.char;
      targetDisplay.style.color = target.color;
      TTS.speak(`${target.char} ढूंढें`, 'hi-IN');
    } else if (state.varnaDifficulty === 'medium') {
      quizPromptText.textContent = "शब्द ढूंढें (Find the word):";
      quizInstruction.textContent = "कौन सा चित्र इस शब्द से मेल खाता है (Which matches the word):";
      targetDisplay.textContent = target.word;
      targetDisplay.style.color = target.color;
      TTS.speak(`${target.word} ढूंढें`, 'hi-IN');
    } else {
      quizPromptText.textContent = "शब्द की वर्तनी (Spell the item):";
      quizInstruction.textContent = "इस चित्र के लिए सही शब्द चुनें (Choose correct spelling for):";
      targetDisplay.textContent = target.emoji;
      TTS.speak(`${target.word} की वर्तनी चुनें`, 'hi-IN');
    }

    // Generate 4 MC Options
    let options = [target];
    while (options.length < 4) {
      const randOpt = appData.varnamala[Math.floor(Math.random() * appData.varnamala.length)];
      if (!options.some(opt => opt.char === randOpt.char)) {
        options.push(randOpt);
      }
    }
    options.sort(() => Math.random() - 0.5);

    // Render option buttons
    const optionsGrid = document.getElementById('varna-quiz-options');
    optionsGrid.innerHTML = '';

    // Hard difficulty: Generate spelling alternatives (misspellings) for Hindi
    let spellingOptions = [];
    if (state.varnaDifficulty === 'hard') {
      spellingOptions = this.getHindiSpellingOptions(target.word);
    }

    options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.style.borderColor = opt.color;

      if (state.varnaDifficulty === 'easy') {
        btn.innerHTML = `<span style="font-size: 2.8rem; font-weight: 800; color: ${opt.color}">${opt.char}</span>`;
      } else if (state.varnaDifficulty === 'medium') {
        btn.innerHTML = `
          <div style="font-size: 2.2rem;">${opt.emoji}</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: var(--text-main);">${opt.word}</div>
        `;
      } else {
        btn.classList.add('word-option');
        const wordText = spellingOptions[idx];
        btn.style.borderColor = target.color;
        btn.innerHTML = `<span style="font-weight: 800;">${wordText}</span>`;
      }

      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        
        optionsGrid.querySelectorAll('.quiz-option-btn').forEach(b => b.disabled = true);

        let isCorrect = false;
        if (state.varnaDifficulty === 'easy' || state.varnaDifficulty === 'medium') {
          isCorrect = (opt.char === target.char);
        } else {
          isCorrect = (spellingOptions[idx] === target.word);
        }

        if (isCorrect) {
          btn.classList.add('correct');
          AudioSynth.play('correct');
          state.varnaQuizScore++;
          document.getElementById('varna-score').textContent = state.varnaQuizScore;
          
          confettiEffect.createConfetti(15);
          
          const speakPhrase = (state.varnaDifficulty === 'hard')
            ? `सही उत्तर! ${target.word}!`
            : `बिल्कुल सही! ${target.char} से ${target.word}`;
            
          TTS.speak(speakPhrase, 'hi-IN', null, () => {
            setTimeout(() => this.nextVarnamalaQuestion(), 1200);
          });
        } else {
          btn.classList.add('wrong');
          AudioSynth.play('wrong');
          
          optionsGrid.querySelectorAll('.quiz-option-btn').forEach((b, oIdx) => {
            let matchesTarget = false;
            if (state.varnaDifficulty === 'easy' || state.varnaDifficulty === 'medium') {
              matchesTarget = (options[oIdx].char === target.char);
            } else {
              matchesTarget = (spellingOptions[oIdx] === target.word);
            }
            if (matchesTarget) {
              b.classList.add('correct');
            }
          });

          const wrongPhrase = (state.varnaDifficulty === 'hard')
            ? `गलत जवाब! सही वर्तनी है ${target.word}.`
            : `ओह! यह ${opt.word} का कार्ड है।`;

          TTS.speak(wrongPhrase, 'hi-IN', null, () => {
            setTimeout(() => this.nextVarnamalaQuestion(), 1600);
          });
        }
      });

      optionsGrid.appendChild(btn);
    });
  },

  getHindiSpellingOptions(word) {
    let list = [word];
    const matras = ['ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', ''];
    while (list.length < 4) {
      let alt = word;
      if (word.length > 1) {
        const charIndex = Math.floor(Math.random() * word.length);
        const randMatra = matras[Math.floor(Math.random() * matras.length)];
        alt = word.substring(0, charIndex) + randMatra + word.substring(charIndex + 1);
      } else {
        alt = word + "ा";
      }
      alt = alt.trim();
      if (alt && alt !== word && !list.includes(alt)) {
        list.push(alt);
      }
      if (list.length >= 4) break;
      if (Math.random() > 0.8) {
        list.push(word + (list.length === 1 ? 'म' : (list.length === 2 ? 'क' : 'प')));
      }
    }
    return list.sort(() => Math.random() - 0.5);
  },

  showVarnamalaResults() {
    document.getElementById('varna-quiz-container').style.display = 'none';
    const resultContainer = document.getElementById('varna-result-container');
    resultContainer.classList.add('active');
    
    document.getElementById('varna-final-score').textContent = state.varnaQuizScore;
    
    let praise = "शानदार! (Fantastic!)";
    if (state.varnaQuizScore === 10) {
      praise = "अति उत्तम! (Perfect score!) 🏆";
      AudioSynth.play('success');
      confettiEffect.createConfetti(50);
    } else if (state.varnaQuizScore >= 7) {
      praise = "बहुत बढ़िया! (Super job!) ⭐";
      AudioSynth.play('success');
    } else {
      AudioSynth.play('tap');
    }
    
    TTS.speak(`${praise} आपने दस में से ${state.varnaQuizScore} अंक प्राप्त किए।`, 'hi-IN');
  },

  // --- NUMBERS MODULE ---
  renderNumbersGrid() {
    const grid = document.getElementById('numbers-grid-buttons');
    if (!grid) return;
    grid.innerHTML = '';

    appData.numbers.forEach(item => {
      const btn = document.createElement('button');
      btn.className = `number-card`;
      btn.setAttribute('data-num', item.num);
      btn.style.color = item.color;
      btn.style.borderColor = item.color;
      btn.textContent = item.num;

      btn.addEventListener('click', () => {
        this.selectNumber(item.num);
      });

      grid.appendChild(btn);
    });
  },

  selectNumber(numVal, shouldSpeak = true) {
    state.selectedNumber = numVal;
    
    document.querySelectorAll('#numbers-grid-buttons .number-card').forEach(btn => {
      if (parseInt(btn.getAttribute('data-num')) === numVal) {
        btn.classList.add('active');
        btn.style.backgroundColor = btn.style.borderColor + '15';
      } else {
        btn.classList.remove('active');
        btn.style.backgroundColor = '';
      }
    });

    const item = appData.numbers.find(n => n.num === numVal);
    if (!item) return;

    const bigNum = document.getElementById('number-display-big');
    bigNum.textContent = item.num;
    bigNum.style.color = item.color;

    const traceBtn = document.getElementById('number-trace-btn');
    if (traceBtn) {
      traceBtn.style.borderColor = item.color;
    }

    document.getElementById('number-display-word').textContent = item.word;

    // Render interactive count items
    const playground = document.getElementById('counting-playground');
    playground.innerHTML = '';

    if (shouldSpeak) {
      TTS.speak(`${item.num}. ${item.word}`);
      AudioSynth.play('pop');
    }

    for (let i = 1; i <= item.num; i++) {
      const countItem = document.createElement('span');
      countItem.className = 'counting-item';
      countItem.textContent = item.emoji;
      countItem.style.animationDelay = `${i * 0.06}s`;

      countItem.addEventListener('click', (e) => {
        e.stopPropagation();
        AudioSynth.play('pop');
        TTS.speak(i.toString());
        
        countItem.style.transform = 'scale(1.4) rotate(15deg)';
        setTimeout(() => {
          countItem.style.transform = '';
        }, 300);
      });

      playground.appendChild(countItem);
    }
  },

  toggleNumbersMode(mode) {
    const learnBtn = document.getElementById('num-mode-learn');
    const quizBtn = document.getElementById('num-mode-quiz');
    const learnContainer = document.getElementById('num-learn-container');
    const quizContainer = document.getElementById('num-quiz-container');
    const resultContainer = document.getElementById('num-result-container');

    if (mode === 'learn') {
      learnBtn.classList.add('active');
      quizBtn.classList.remove('active');
      learnContainer.style.display = 'grid';
      quizContainer.style.display = 'none';
      resultContainer.style.display = 'none';
      this.resetNumbersQuiz();
      this.selectNumber(state.selectedNumber);
    } else {
      learnBtn.classList.remove('active');
      quizBtn.classList.add('active');
      learnContainer.style.display = 'none';
      quizContainer.style.display = 'block';
      resultContainer.style.display = 'none';
      this.startNumbersQuiz();
    }
  },

  resetNumbersQuiz() {
    state.numQuizActive = false;
    state.numQuizScore = 0;
    state.numQuizCount = 0;
    state.numCurrentTarget = null;
  },

  startNumbersQuiz() {
    state.numQuizActive = true;
    state.numQuizScore = 0;
    state.numQuizCount = 0;
    document.getElementById('num-result-container').classList.remove('active');
    document.getElementById('num-quiz-container').style.display = 'block';
    this.nextNumbersQuestion();
  },

  nextNumbersQuestion() {
    if (state.numQuizCount >= 10) {
      this.showNumbersResults();
      return;
    }

    state.numQuizCount++;
    document.getElementById('num-score').textContent = state.numQuizScore;

    // Pick target
    const targetIdx = Math.floor(Math.random() * appData.numbers.length);
    const target = appData.numbers[targetIdx];
    state.numCurrentTarget = target;

    const quizPlayground = document.getElementById('num-quiz-playground');
    quizPlayground.innerHTML = '';

    const quizPromptText = document.getElementById('num-quiz-prompt-text');
    const quizInstruction = document.getElementById('num-quiz-instruction');

    let sumVal = target.num;
    let addend1 = 0;
    let addend2 = 0;

    // Setup UI according to dynamic Quiz Menu difficulty tabs
    if (state.numDifficulty === 'easy') {
      // Find the single number identification
      quizPromptText.textContent = "Find the number:";
      quizInstruction.textContent = "Select the card matching the number:";
      
      const numLabel = document.createElement('div');
      numLabel.style.fontSize = '6rem';
      numLabel.style.fontWeight = '800';
      numLabel.style.color = target.color;
      numLabel.textContent = target.num;
      quizPlayground.appendChild(numLabel);

      TTS.speak(`Find the number ${target.num}`);
    } else if (state.numDifficulty === 'medium') {
      // Count items (existing counting mode)
      quizPromptText.textContent = "Count & Play:";
      quizInstruction.textContent = "Count the items and choose the correct number:";
      
      for (let i = 1; i <= target.num; i++) {
        const item = document.createElement('span');
        item.className = 'counting-item';
        item.textContent = target.emoji;
        item.style.fontSize = '2.8rem';
        item.addEventListener('click', () => {
          AudioSynth.play('pop');
          item.style.transform = 'scale(1.3) rotate(10deg)';
          setTimeout(() => item.style.transform = '', 200);
        });
        quizPlayground.appendChild(item);
      }
      TTS.speak("Count the items and choose the correct number.");
    } else {
      // Hard: Simple Addition (e.g. solve 2 + 1)
      quizPromptText.textContent = "Solve the equation:";
      quizInstruction.textContent = "Solve the addition puzzle:";

      // Calculate addends summing up to target.num
      if (target.num > 1) {
        addend1 = Math.floor(Math.random() * (target.num - 1)) + 1;
        addend2 = target.num - addend1;
      } else {
        addend1 = 1;
        addend2 = 0;
      }

      // Render math problem: Group 1, Plus symbol, Group 2, Equals Question mark
      const mathWrapper = document.createElement('div');
      mathWrapper.style.display = 'flex';
      mathWrapper.style.alignItems = 'center';
      mathWrapper.style.justifyContent = 'center';
      mathWrapper.style.gap = '15px';
      mathWrapper.style.flexWrap = 'wrap';

      // Group 1
      const g1 = document.createElement('div');
      g1.style.display = 'flex';
      g1.style.gap = '5px';
      for (let k = 0; k < addend1; k++) {
        const item = document.createElement('span');
        item.style.fontSize = '2.4rem';
        item.textContent = target.emoji;
        g1.appendChild(item);
      }
      mathWrapper.appendChild(g1);

      // Plus Sign
      const plusSign = document.createElement('span');
      plusSign.style.fontSize = '2.5rem';
      plusSign.style.fontWeight = '800';
      plusSign.style.color = 'var(--text-main)';
      plusSign.textContent = '+';
      mathWrapper.appendChild(plusSign);

      // Group 2
      const g2 = document.createElement('div');
      g2.style.display = 'flex';
      g2.style.gap = '5px';
      for (let k = 0; k < addend2; k++) {
        const item = document.createElement('span');
        item.style.fontSize = '2.4rem';
        item.textContent = target.emoji;
        g2.appendChild(item);
      }
      mathWrapper.appendChild(g2);

      // Equals Question
      const equalsSign = document.createElement('span');
      equalsSign.style.fontSize = '2.5rem';
      equalsSign.style.fontWeight = '800';
      equalsSign.style.color = 'var(--text-main)';
      equalsSign.textContent = '=  ❓';
      mathWrapper.appendChild(equalsSign);

      quizPlayground.appendChild(mathWrapper);

      // Equations Subtitle text helper
      const mathEqText = document.createElement('div');
      mathEqText.style.fontSize = '1.8rem';
      mathEqText.style.fontWeight = '800';
      mathEqText.style.marginTop = '15px';
      mathEqText.style.color = target.color;
      mathEqText.textContent = `${addend1} + ${addend2} = ?`;
      quizPlayground.appendChild(mathEqText);

      TTS.speak(`Solve the addition: ${addend1} plus ${addend2}`);
    }

    // Generate 4 Options
    let options = [target.num];
    while (options.length < 4) {
      const randNum = Math.floor(Math.random() * 10) + 1;
      if (!options.includes(randNum)) {
        options.push(randNum);
      }
    }
    options.sort(() => Math.random() - 0.5);

    // Render option buttons
    const optionsGrid = document.getElementById('num-quiz-options');
    optionsGrid.innerHTML = '';

    options.forEach(optVal => {
      const optItem = appData.numbers.find(n => n.num === optVal);
      const btn = document.createElement('button');
      btn.className = 'quiz-option-btn';
      btn.style.padding = '18px';
      btn.style.borderColor = optItem ? optItem.color : 'var(--text-main)';
      btn.innerHTML = `<span style="font-size: 2.6rem; font-weight: 800; color: ${optItem ? optItem.color : 'inherit'}">${optVal}</span>`;

      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        
        optionsGrid.querySelectorAll('.quiz-option-btn').forEach(b => b.disabled = true);

        if (optVal === target.num) {
          btn.classList.add('correct');
          AudioSynth.play('correct');
          state.numQuizScore++;
          document.getElementById('num-score').textContent = state.numQuizScore;
          
          confettiEffect.createConfetti(15);
          
          const correctText = (state.numDifficulty === 'hard')
            ? `Correct! ${addend1} plus ${addend2} is indeed ${target.num}!`
            : `Excellent! That is ${target.word}!`;

          TTS.speak(correctText, 'en-US', null, () => {
            setTimeout(() => this.nextNumbersQuestion(), 1200);
          });
        } else {
          btn.classList.add('wrong');
          AudioSynth.play('wrong');
          
          // Show correct option
          optionsGrid.querySelectorAll('.quiz-option-btn').forEach((b, idx) => {
            if (options[idx] === target.num) {
              b.classList.add('correct');
            }
          });

          const wrongText = (state.numDifficulty === 'hard')
            ? `Oops! ${addend1} plus ${addend2} is ${target.num}.`
            : `Oops! That's the number ${optVal}.`;

          TTS.speak(wrongText, 'en-US', null, () => {
            setTimeout(() => this.nextNumbersQuestion(), 1600);
          });
        }
      });

      optionsGrid.appendChild(btn);
    });
  },

  showNumbersResults() {
    document.getElementById('num-quiz-container').style.display = 'none';
    const results = document.getElementById('num-result-container');
    results.classList.add('active');
    
    document.getElementById('num-final-score').textContent = state.numQuizScore;
    
    if (state.numQuizScore >= 7) {
      AudioSynth.play('success');
      confettiEffect.createConfetti(55);
      TTS.speak(`Super job! You scored ${state.numQuizScore} stars out of ten!`);
    } else {
      AudioSynth.play('correct');
      TTS.speak(`Nice effort! You scored ${state.numQuizScore} stars. Let's play again to learn more!`);
    }
  },

  // --- RHYMES MODULE ---
  renderRhymesList() {
    const list = document.getElementById('rhymes-selection-list');
    if (!list) return;
    list.innerHTML = '';

    appData.rhymes.forEach(item => {
      const li = document.createElement('li');
      li.className = 'rhyme-item';
      li.setAttribute('data-id', item.id);
      
      li.innerHTML = `
        <span style="font-size: 1.8rem;">${item.emoji}</span>
        <div class="rhyme-item-details">
          <div class="rhyme-item-title-hi">${item.titleHi}</div>
          <div class="rhyme-item-title-en">${item.titleEn}</div>
        </div>
      `;

      li.addEventListener('click', () => {
        this.selectRhyme(item.id);
      });

      list.appendChild(li);
    });
  },

  selectRhyme(rhymeId, shouldPlay = true) {
    const item = appData.rhymes.find(r => r.id === rhymeId);
    if (!item) return;

    this.stopRhyme();
    state.selectedRhyme = item;

    // Highlight selected side list item
    document.querySelectorAll('#rhymes-selection-list .rhyme-item').forEach(li => {
      if (li.getAttribute('data-id') === rhymeId) {
        li.classList.add('active');
      } else {
        li.classList.remove('active');
      }
    });

    // Render active background animated scene
    document.querySelectorAll('.rhyme-visuals-screen .rhyme-scene').forEach(sc => {
      sc.classList.remove('active');
    });
    const targetScene = document.getElementById(`scene-${item.id}`);
    if (targetScene) {
      targetScene.classList.add('active');
    }

    // Render lyrics lines
    const lyricsContainer = document.getElementById('rhymes-lyrics-container');
    lyricsContainer.innerHTML = '';

    item.lyrics.forEach((line, idx) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'lyric-line';
      lineDiv.setAttribute('data-line-index', idx);
      
      lineDiv.innerHTML = `
        <div class="lyric-line-hi">${line.hi}</div>
        <div class="lyric-line-en">${line.en}</div>
        <span class="lyric-line-trans">${line.tr}</span>
      `;

      // Touch direct line play support
      lineDiv.addEventListener('click', () => {
        if (state.isPlayingRhyme) {
          this.stopRhyme();
        }
        this.highlightLyricLine(idx);
        const hasHindi = TTS.hasHindiVoice() && state.rhymeLanguageMode === 'native';
        const txt = hasHindi ? line.hi : line.en;
        const lMode = hasHindi ? 'hi-IN' : 'en-US';
        TTS.speak(txt, lMode);
      });

      lyricsContainer.appendChild(lineDiv);
    });

    this.updateRhymeLangButtonUI();

    if (shouldPlay) {
      this.togglePlayRhyme();
    }
  },

  togglePlayRhyme() {
    if (!state.selectedRhyme) return;
    
    if (state.isPlayingRhyme) {
      this.stopRhyme();
      AudioSynth.play('tap');
    } else {
      state.isPlayingRhyme = true;
      this.updateRhymePlayButtonUI();
      this.playActiveRhymeSequence();
      AudioSynth.play('tap');
    }
  },

  updateRhymePlayButtonUI() {
    const playBtn = document.getElementById('rhyme-play-btn');
    if (playBtn) {
      playBtn.textContent = state.isPlayingRhyme ? '⏸️ Pause Song' : '▶️ Play Song';
      if (state.isPlayingRhyme) {
        playBtn.classList.remove('btn-play');
        playBtn.classList.add('btn-stop');
      } else {
        playBtn.classList.remove('btn-stop');
        playBtn.classList.add('btn-play');
      }
    }
  },

  updateRhymeLangButtonUI() {
    const langBtn = document.getElementById('rhyme-lang-btn');
    if (!langBtn) return;

    const hasHindi = TTS.hasHindiVoice();
    if (!hasHindi) {
      langBtn.disabled = true;
      langBtn.classList.add('disabled');
      langBtn.textContent = '🗣️ Voice: Romanized (No Hindi Voice)';
      langBtn.title = 'No Native Hindi voice is supported on this browser. Falling back to English voice.';
      state.rhymeLanguageMode = 'romanized';
    } else {
      langBtn.disabled = false;
      langBtn.classList.remove('disabled');
      if (state.rhymeLanguageMode === 'romanized' && !this._userToggledLanguage) {
        state.rhymeLanguageMode = 'native';
      }
      if (state.rhymeLanguageMode === 'native') {
        langBtn.textContent = '🗣️ Voice: Native Hindi';
        langBtn.title = 'Click to switch to Romanized English voice';
      } else {
        langBtn.textContent = '🗣️ Voice: Romanized English';
        langBtn.title = 'Click to switch to Native Hindi voice';
      }
    }
  },

  highlightLyricLine(index) {
    state.currentLyricLineIndex = index;
    
    document.querySelectorAll('#rhymes-lyrics-container .lyric-line').forEach(line => {
      const lineIdx = parseInt(line.getAttribute('data-line-index'));
      if (lineIdx === index) {
        line.classList.add('active');
        line.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        line.classList.remove('active');
      }
    });

    // Speed up active character animation slightly during line playback!
    const activeScene = document.querySelector('.rhyme-scene.active');
    if (activeScene) {
      const animElement = activeScene.querySelector('.fish, .moon, .butterfly, .horse');
      if (animElement) {
        animElement.style.animationDuration = '1.3s';
        setTimeout(() => {
          if (animElement) animElement.style.animationDuration = '';
        }, 1500);
      }
    }
  },

  playActiveRhymeSequence() {
    const lyrics = state.selectedRhyme.lyrics;
    let currentLine = 0;

    const speakLine = () => {
      // Safety guard check: If player was stopped or target rhyme was switched
      if (!state.isPlayingRhyme || currentLine >= lyrics.length) {
        this.stopRhyme();
        return;
      }

      this.highlightLyricLine(currentLine);
      
      const hasHindi = TTS.hasHindiVoice() && state.rhymeLanguageMode === 'native';
      const lineData = lyrics[currentLine];
      const textToSpeak = hasHindi ? lineData.hi : lineData.en;
      const speakLang = hasHindi ? 'hi-IN' : 'en-US';

      TTS.speak(textToSpeak, speakLang, null, () => {
        // Only queue next line if song is still playing and wasn't stopped mid-utterance
        if (state.isPlayingRhyme) {
          currentLine++;
          setTimeout(speakLine, 600); // 600ms breathing space between lyrics lines
        }
      }, false); // Do not interrupt because rhyme sequence reads sequentially
    };

    speakLine();
  },

  stopRhyme() {
    state.isPlayingRhyme = false;
    state.currentLyricLineIndex = -1;
    this.updateRhymePlayButtonUI();
    TTS.cancel();
    
    document.querySelectorAll('#rhymes-lyrics-container .lyric-line').forEach(line => {
      line.classList.remove('active');
    });
  },

  // Toast UI notification utility
  showToast(msg, duration = 3000) {
    const existing = document.querySelector('.toast-notice');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notice';
    toast.style.cssText = `
      position: fixed;
      bottom: 85px;
      left: 50%;
      transform: translateX(-50%);
      background-color: var(--text-main);
      color: var(--bg-card);
      padding: 10px 20px;
      border-radius: 30px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-size: 0.95rem;
      animation: popIn 0.3s ease;
      pointer-events: none;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeIn 0.3s ease reverse forwards';
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }
};

// --- ELEGANT CONFETTI EFFECTS MODULE ---
const confettiEffect = {
  createConfetti(numPieces = 30) {
    const container = document.getElementById('confetti-container');
    if (!container) return;

    const colors = ['#ff6b6b', '#4ecdc4', '#fecb2f', '#ff8e53', '#a29bfe', '#fd79a8'];
    const shapes = ['circle', 'square', 'triangle'];

    for (let i = 0; i < numPieces; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      piece.style.backgroundColor = color;
      
      // Random position
      piece.style.left = `${Math.random() * 100}vw`;
      
      // Random scale/shape
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      if (shape === 'circle') {
        piece.style.borderRadius = '50%';
      } else if (shape === 'triangle') {
        piece.style.width = '0';
        piece.style.height = '0';
        piece.style.borderLeft = '6px solid transparent';
        piece.style.borderRight = '6px solid transparent';
        piece.style.borderBottom = `12px solid ${color}`;
        piece.style.backgroundColor = 'transparent';
      }

      // Timing configs
      const duration = 2 + Math.random() * 2;
      piece.style.animationDuration = `${duration}s`;
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      
      const size = 8 + Math.random() * 8;
      if (shape !== 'triangle') {
        piece.style.width = `${size}px`;
        piece.style.height = `${size}px`;
      }
      
      setTimeout(() => piece.remove(), duration * 1000 + 400);
      container.appendChild(piece);
    }
  }
};

// --- GLOBAL RUN INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  await app.init();
});
