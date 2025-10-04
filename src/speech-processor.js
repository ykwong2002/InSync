export class SpeechProcessor {
  constructor() {
    this.isActive = false;
    this.recognition = null;
    this.synthesis = null;
    this.currentTranscript = "";
    this.interimTranscript = "";
    this.language = "en-US";
    this.isContinuous = true;
    this.interimResults = true;

    this.init();
  }

  async init() {
    try {
      await this.initializeSpeechRecognition();
      this.initializeSpeechSynthesis();
      console.log("Speech processor initialized");
    } catch (error) {
      console.error("Failed to initialize speech processor:", error);
    }
  }

  async initializeSpeechRecognition() {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      throw new Error("Speech recognition not supported in this browser");
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure recognition settings
    this.recognition.continuous = this.isContinuous;
    this.recognition.interimResults = this.interimResults;
    this.recognition.lang = this.language;
    this.recognition.maxAlternatives = 1;

    // Set up event handlers
    this.recognition.onstart = () => {
      console.log("Speech recognition started");
      this.emit("recognition-started");
    };

    this.recognition.onresult = (event) => {
      this.handleRecognitionResult(event);
    };

    this.recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      this.emit("recognition-error", { error: event.error });
    };

    this.recognition.onend = () => {
      console.log("Speech recognition ended");
      this.emit("recognition-ended");

      // Restart if continuous mode and still active
      if (this.isActive && this.isContinuous) {
        setTimeout(() => {
          if (this.isActive) {
            this.startRecognition();
          }
        }, 100);
      }
    };
  }

  initializeSpeechSynthesis() {
    if (!("speechSynthesis" in window)) {
      console.warn("Speech synthesis not supported in this browser");
      return;
    }

    this.synthesis = window.speechSynthesis;

    // Load voices
    const loadVoices = () => {
      this.voices = this.synthesis.getVoices();
      console.log("Available voices:", this.voices.length);
    };

    // Load voices immediately if available
    loadVoices();

    // Load voices when they become available
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = loadVoices;
    }
  }

  handleRecognitionResult(event) {
    let interimTranscript = "";
    let finalTranscript = "";

    // Process all results
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    // Update current transcripts
    if (finalTranscript) {
      this.currentTranscript += finalTranscript;
      this.emit("speech-detected", {
        transcript: finalTranscript.trim(),
        confidence:
          event.results[event.results.length - 1][0].confidence || 0.9,
        isFinal: true,
      });
    }

    if (interimTranscript) {
      this.interimTranscript = interimTranscript;
      this.emit("interim-speech", {
        transcript: interimTranscript.trim(),
        confidence: 0.5, // Lower confidence for interim results
      });
    }

    // Emit combined transcript
    const fullTranscript = this.currentTranscript + this.interimTranscript;
    this.emit("transcript-update", {
      transcript: fullTranscript.trim(),
      isFinal: finalTranscript.length > 0,
    });
  }

  async start() {
    if (this.isActive) return;

    this.isActive = true;
    this.currentTranscript = "";
    this.interimTranscript = "";

    try {
      await this.startRecognition();
      console.log("Speech processing started");
      this.emit("processor-started");
    } catch (error) {
      console.error("Failed to start speech processing:", error);
      this.isActive = false;
      this.emit("processor-error", { error: error.message });
    }
  }

  stop() {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.recognition) {
      this.recognition.stop();
    }

    // Stop any ongoing speech synthesis
    if (this.synthesis) {
      this.synthesis.cancel();
    }

    console.log("Speech processing stopped");
    this.emit("processor-stopped");
  }

  startRecognition() {
    if (!this.recognition) {
      throw new Error("Speech recognition not initialized");
    }

    try {
      this.recognition.start();
    } catch (error) {
      // Handle case where recognition is already running
      if (error.name === "InvalidStateError") {
        console.log("Speech recognition already running");
      } else {
        throw error;
      }
    }
  }

  speak(text, options = {}) {
    if (!this.synthesis) {
      console.warn("Speech synthesis not available");
      return;
    }

    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Set speech options
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;
    utterance.lang = options.lang || this.language;

    // Select voice
    if (options.voice) {
      utterance.voice = options.voice;
    } else if (this.voices && this.voices.length > 0) {
      // Select best available voice
      const preferredVoice =
        this.voices.find(
          (voice) =>
            voice.lang.startsWith("en") &&
            (voice.name.includes("Female") || voice.name.includes("Samantha"))
        ) ||
        this.voices.find((voice) => voice.lang.startsWith("en")) ||
        this.voices[0];

      utterance.voice = preferredVoice;
    }

    // Set up event handlers
    utterance.onstart = () => {
      this.emit("synthesis-started", { text: text });
    };

    utterance.onend = () => {
      this.emit("synthesis-ended", { text: text });
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event.error);
      this.emit("synthesis-error", { error: event.error, text: text });
    };

    // Speak
    this.synthesis.speak(utterance);

    return utterance;
  }

  pauseSynthesis() {
    if (this.synthesis) {
      this.synthesis.pause();
      this.emit("synthesis-paused");
    }
  }

  resumeSynthesis() {
    if (this.synthesis) {
      this.synthesis.resume();
      this.emit("synthesis-resumed");
    }
  }

  stopSynthesis() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.emit("synthesis-stopped");
    }
  }

  setLanguage(language) {
    this.language = language;

    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  setContinuousMode(continuous) {
    this.isContinuous = continuous;

    if (this.recognition) {
      this.recognition.continuous = continuous;
    }
  }

  setInterimResults(interim) {
    this.interimResults = interim;

    if (this.recognition) {
      this.recognition.interimResults = interim;
    }
  }

  getCurrentTranscript() {
    return {
      current: this.currentTranscript,
      interim: this.interimTranscript,
      full: this.currentTranscript + this.interimTranscript,
    };
  }

  clearTranscript() {
    this.currentTranscript = "";
    this.interimTranscript = "";
    this.emit("transcript-cleared");
  }

  getAvailableVoices() {
    if (!this.synthesis) return [];

    return this.synthesis.getVoices().map((voice) => ({
      name: voice.name,
      lang: voice.lang,
      default: voice.default,
      localService: voice.localService,
    }));
  }

  isRecognitionSupported() {
    return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  }

  isSynthesisSupported() {
    return "speechSynthesis" in window;
  }

  // Event emitter functionality
  emit(event, data) {
    const customEvent = new CustomEvent(`speech-processor:${event}`, {
      detail: data,
    });
    window.dispatchEvent(customEvent);
  }
}
