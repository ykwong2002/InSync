import { io } from "socket.io-client";

export class SignLanguageInterpreter {
  constructor(components = {}) {
    this.speechProcessor = components.speechProcessor;
    this.gestureRecognizer = components.gestureRecognizer;
    this.socket = null;
    this.isActive = false;
    this.settings = {
      signLanguage: "asl",
      speechRate: 1.0,
      gestureSensitivity: 0.7,
      showSubtitles: true,
      autoStart: true,
    };

    this.signToText = {
      hello: "Hello",
      thank_you: "Thank you",
      yes: "Yes",
      no: "No",
      please: "Please",
      help: "Help",
      stop: "Stop",
      go: "Go",
      wait: "Wait",
      question: "I have a question",
    };

    this.textToSign = {
      hello: "hello",
      thank: "thank_you",
      thanks: "thank_you",
      yes: "yes",
      no: "no",
      please: "please",
      help: "help",
      stop: "stop",
      go: "go",
      wait: "wait",
      question: "question",
    };

    this.init();
  }

  async init() {
    await this.initializeSocket();
    this.setupEventListeners();
    this.loadSettings();
  }

  async initializeSocket() {
    return new Promise((resolve, reject) => {
      this.socket = io("http://localhost:3000", {
        transports: ["websocket", "polling"],
      });

      this.socket.on("connect", () => {
        console.log("Connected to interpreter server");
        resolve();
      });

      this.socket.on("disconnect", () => {
        console.log("Disconnected from interpreter server");
      });

      this.socket.on("sign-animation", (data) => {
        this.handleSignAnimation(data);
      });

      this.socket.on("speech-synthesis", (data) => {
        this.handleSpeechSynthesis(data);
      });

      this.socket.on("transcription-partial", (data) => {
        this.handlePartialTranscription(data);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.socket.connected) {
          reject(new Error("Socket connection timeout"));
        }
      }, 10000);
    });
  }

  setupEventListeners() {
    // Speech to sign events
    if (this.speechProcessor) {
      this.speechProcessor.on("speech-detected", (data) => {
        this.processSpeechToSign(data);
      });
    }

    // Gesture to speech events
    if (this.gestureRecognizer) {
      this.gestureRecognizer.on("gesture-detected", (data) => {
        this.processGestureToSpeech(data);
      });
    }
  }

  processSpeechToSign(data) {
    const { transcript, confidence } = data;

    if (!transcript || confidence < 0.5) return;

    console.log("Processing speech to sign:", transcript);

    // Send to server for processing
    this.socket.emit("speech-to-sign", {
      transcript: transcript,
      confidence: confidence,
      timestamp: Date.now(),
    });

    // Emit event for UI updates
    this.emit("speech-processed", {
      transcript: transcript,
      confidence: confidence,
    });
  }

  processGestureToSpeech(data) {
    const { gesture, confidence, landmarks } = data;

    if (!gesture || confidence < this.settings.gestureSensitivity) return;

    console.log("Processing gesture to speech:", gesture);

    // Send to server for processing
    this.socket.emit("sign-to-speech", {
      gesture: gesture,
      confidence: confidence,
      handPositions: landmarks,
      timestamp: Date.now(),
    });

    // Emit event for UI updates
    this.emit("gesture-processed", {
      gesture: gesture,
      confidence: confidence,
    });
  }

  handleSignAnimation(data) {
    const { signs, originalText } = data;

    // Emit event for UI to display sign animation
    this.emit("sign-animation", {
      signs: signs,
      originalText: originalText,
      timestamp: Date.now(),
    });

    // Update subtitle display if enabled
    if (this.settings.showSubtitles) {
      this.updateSubtitles(originalText, signs);
    }
  }

  handleSpeechSynthesis(data) {
    const { text, gesture } = data;

    // Emit event for UI to display speech output
    this.emit("speech-output", {
      text: text,
      gesture: gesture,
      timestamp: Date.now(),
    });

    // Synthesize speech
    this.synthesizeSpeech(text);
  }

  handlePartialTranscription(data) {
    const { text, confidence } = data;

    // Emit event for real-time transcript updates
    this.emit("transcript-update", {
      text: text,
      confidence: confidence,
      timestamp: Date.now(),
    });
  }

  synthesizeSpeech(text) {
    if (!("speechSynthesis" in window)) {
      console.warn("Speech synthesis not supported");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.settings.speechRate;
    utterance.volume = 1;

    // Select appropriate voice
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (voice) => voice.lang.startsWith("en") && voice.name.includes("Female")
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    speechSynthesis.speak(utterance);
  }

  updateSubtitles(originalText, signs) {
    // This would update subtitle overlay in the UI
    this.emit("subtitle-update", {
      originalText: originalText,
      signs: signs,
    });
  }

  joinMeeting(meetingData) {
    if (!this.socket) return;

    this.socket.emit("meeting-join", {
      meetingId: meetingData.meetingId,
      participantId: meetingData.participantId,
      isDeaf: meetingData.isDeaf,
      timestamp: Date.now(),
    });

    console.log("Joined meeting:", meetingData.meetingId);
  }

  leaveMeeting() {
    if (!this.socket) return;

    this.socket.emit("meeting-leave", {
      timestamp: Date.now(),
    });

    console.log("Left meeting");
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };

    // Update components with new settings
    if (this.gestureRecognizer) {
      this.gestureRecognizer.updateSensitivity(newSettings.gestureSensitivity);
    }

    // Save settings
    this.saveSettings();

    // Emit settings change event
    this.emit("settings-updated", this.settings);
  }

  loadSettings() {
    const saved = localStorage.getItem("signLanguageInterpreterSettings");
    if (saved) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(
        "signLanguageInterpreterSettings",
        JSON.stringify(this.settings)
      );
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  start() {
    if (this.isActive) return;

    this.isActive = true;

    // Start speech processing
    if (this.speechProcessor) {
      this.speechProcessor.start();
    }

    // Start gesture recognition
    if (this.gestureRecognizer) {
      this.gestureRecognizer.start();
    }

    this.emit("interpreter-started");
    console.log("Interpreter started");
  }

  stop() {
    if (!this.isActive) return;

    this.isActive = false;

    // Stop speech processing
    if (this.speechProcessor) {
      this.speechProcessor.stop();
    }

    // Stop gesture recognition
    if (this.gestureRecognizer) {
      this.gestureRecognizer.stop();
    }

    this.emit("interpreter-stopped");
    console.log("Interpreter stopped");
  }

  // Event emitter functionality
  emit(event, data) {
    const customEvent = new CustomEvent(`signspeak:${event}`, {
      detail: data,
    });
    window.dispatchEvent(customEvent);
  }
}
