class SignLanguageInterpreter {
  constructor() {
    this.socket = null;
    this.recognition = null;
    this.synthesis = null;
    this.camera = null;
    this.hands = null;
    this.isListening = false;
    this.isRecognizingGestures = false;
    this.currentTab = "speech-to-sign";
    this.settings = {
      signLanguage: "asl",
      speechRate: 1.0,
      gestureSensitivity: 0.7,
      showSubtitles: true,
      autoStart: true,
    };

    // Gesture recognition state
    this.lastGestureTime = 0;
    this.gestureHistory = [];
    this.maxHistoryLength = 5;

    this.init();
  }

  async init() {
    console.log("Initializing Sign Language Interpreter...");

    // Show loading overlay
    this.showLoading();

    try {
      await this.initializeSocket();
      await this.initializeSpeechRecognition();
      await this.initializeSpeechSynthesis();
      await this.initializeCamera();
      await this.initializeGestureRecognition();
      this.initializeUI();
      this.loadSettings();

      // Hide loading overlay
      setTimeout(() => {
        this.hideLoading();
      }, 2000);

      console.log("Sign Language Interpreter initialized successfully!");
    } catch (error) {
      console.error("Initialization failed:", error);
      this.hideLoading();
      this.showError(
        "Failed to initialize the interpreter. Please refresh the page."
      );
    }
  }

  async initializeSocket() {
    return new Promise((resolve, reject) => {
      this.socket = io();

      this.socket.on("connect", () => {
        console.log("Connected to server");
        this.updateConnectionStatus(true);
        resolve();
      });

      this.socket.on("disconnect", () => {
        console.log("Disconnected from server");
        this.updateConnectionStatus(false);
      });

      this.socket.on("sign-animation", (data) => {
        this.displaySignAnimation(data);
      });

      this.socket.on("speech-synthesis", (data) => {
        this.synthesizeSpeech(data);
      });

      this.socket.on("interpreter-joined", (data) => {
        this.handleInterpreterJoined(data);
      });

      this.socket.on("transcription-partial", (data) => {
        this.updateTranscript(data);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.socket.connected) {
          reject(new Error("Socket connection timeout"));
        }
      }, 10000);
    });
  }

  async initializeSpeechRecognition() {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      throw new Error("Speech recognition not supported");
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.recognition.onstart = () => {
      console.log("Speech recognition started");
      this.isListening = true;
      this.updateListeningState(true);
    };

    this.recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.processSpeech(finalTranscript);
      }

      this.updateTranscriptDisplay(finalTranscript, interimTranscript);
    };

    this.recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      this.updateListeningState(false);
      this.isListening = false;
    };

    this.recognition.onend = () => {
      console.log("Speech recognition ended");
      this.updateListeningState(false);
      this.isListening = false;
    };
  }

  async initializeSpeechSynthesis() {
    if (!("speechSynthesis" in window)) {
      throw new Error("Speech synthesis not supported");
    }

    this.synthesis = window.speechSynthesis;

    // Preload voices
    const voices = this.synthesis.getVoices();
    console.log("Available voices:", voices.length);
  }

  async initializeCamera() {
    try {
      this.camera = document.getElementById("userVideo");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });

      this.camera.srcObject = stream;
      this.camera.play();

      console.log("Camera initialized");
    } catch (error) {
      console.error("Camera initialization failed:", error);
      throw new Error("Camera access denied or not available");
    }
  }

  async initializeGestureRecognition() {
    try {
      // Initialize MediaPipe Hands with enhanced features
      this.hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5, // Lower detection threshold
        minTrackingConfidence: 0.7, // Higher tracking threshold for stability
      });

      this.hands.onResults((results) => {
        this.processHandResults(results);
      });

      // Setup canvas for landmark visualization
      this.setupLandmarkCanvas();

      const camera = new Camera(this.camera, {
        onFrame: async () => {
          await this.hands.send({ image: this.camera });
        },
        width: 640,
        height: 480,
      });

      camera.start();
      console.log("Enhanced gesture recognition with landmarks initialized");
    } catch (error) {
      console.error("Gesture recognition initialization failed:", error);
      // Fallback to simple gesture recognition
      this.initializeSimpleGestureRecognition();
    }
  }

  async initializeSimpleGestureRecognition() {
    try {
      // Initialize MediaPipe Hands (fallback)
      this.hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: this.settings.gestureSensitivity,
        minTrackingConfidence: 0.5,
      });

      this.hands.onResults((results) => {
        this.processHandResults(results);
      });

      const camera = new Camera(this.camera, {
        onFrame: async () => {
          await this.hands.send({ image: this.camera });
        },
        width: 640,
        height: 480,
      });

      camera.start();
      console.log("Simple gesture recognition initialized");
    } catch (error) {
      console.error("Simple gesture recognition initialization failed:", error);
    }
  }

  initializeUI() {
    // Tab switching
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Speech controls
    document.getElementById("startListening").addEventListener("click", () => {
      this.startListening();
    });

    document.getElementById("stopListening").addEventListener("click", () => {
      this.stopListening();
    });

    // Gesture controls
    document.getElementById("startGestures").addEventListener("click", () => {
      this.startGestureRecognition();
    });

    document.getElementById("stopGestures").addEventListener("click", () => {
      this.stopGestureRecognition();
    });

    // Landmark toggle
    document.getElementById("toggleLandmarks").addEventListener("click", () => {
      this.toggleLandmarks();
    });

    // Meeting controls
    document.getElementById("joinMeeting").addEventListener("click", () => {
      this.joinMeeting();
    });

    // Settings
    document
      .getElementById("floatingSettings")
      .addEventListener("click", () => {
        this.openSettings();
      });

    document.getElementById("closeSettings").addEventListener("click", () => {
      this.closeSettings();
    });

    // Settings controls
    document.getElementById("signLanguage").addEventListener("change", (e) => {
      this.settings.signLanguage = e.target.value;
      this.saveSettings();
    });

    document.getElementById("speechRate").addEventListener("input", (e) => {
      this.settings.speechRate = parseFloat(e.target.value);
      document.getElementById("speechRateValue").textContent = e.target.value;
      this.saveSettings();
    });

    document
      .getElementById("gestureSensitivity")
      .addEventListener("input", (e) => {
        this.settings.gestureSensitivity = parseFloat(e.target.value);
        document.getElementById("gestureSensitivityValue").textContent =
          e.target.value;
        this.saveSettings();
      });

    document
      .getElementById("gestureCooldown")
      .addEventListener("input", (e) => {
        const cooldown = parseInt(e.target.value);
        document.getElementById("gestureCooldownValue").textContent = cooldown;

        if (this.gestureRecognizer) {
          this.gestureRecognizer.setGestureCooldown(cooldown);
        }
      });

    document.getElementById("showSubtitles").addEventListener("change", (e) => {
      this.settings.showSubtitles = e.target.checked;
      this.saveSettings();
    });

    document.getElementById("autoStart").addEventListener("change", (e) => {
      this.settings.autoStart = e.target.checked;
      this.saveSettings();
    });
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

    // Update tab content
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });
    document.getElementById(tabName).classList.add("active");

    this.currentTab = tabName;

    // Auto-start if enabled
    if (this.settings.autoStart) {
      if (tabName === "speech-to-sign" && !this.isListening) {
        setTimeout(() => this.startListening(), 500);
      } else if (tabName === "sign-to-speech" && !this.isRecognizingGestures) {
        setTimeout(() => this.startGestureRecognition(), 500);
      }
    }
  }

  startListening() {
    if (!this.recognition) return;

    try {
      this.recognition.start();
      document.getElementById("startListening").disabled = true;
      document.getElementById("stopListening").disabled = false;
    } catch (error) {
      console.error("Failed to start listening:", error);
      this.showError("Failed to start speech recognition");
    }
  }

  stopListening() {
    if (!this.recognition) return;

    this.recognition.stop();
    document.getElementById("startListening").disabled = false;
    document.getElementById("stopListening").disabled = true;
  }

  startGestureRecognition() {
    this.isRecognizingGestures = true;
    this.updateGestureIndicator("listening");
    document.getElementById("startGestures").disabled = true;
    document.getElementById("stopGestures").disabled = false;

    // Update landmark button to show it's always on
    const landmarkButton = document.getElementById("toggleLandmarks");
    landmarkButton.innerHTML = '<i class="fas fa-eye"></i> Landmarks Always On';
    landmarkButton.classList.add("active");
    landmarkButton.disabled = false;

    console.log("Gesture recognition with landmarks started");
  }

  stopGestureRecognition() {
    this.isRecognizingGestures = false;
    this.updateGestureIndicator("idle");
    document.getElementById("startGestures").disabled = false;
    document.getElementById("stopGestures").disabled = true;

    // Clear landmarks when stopping
    if (this.landmarkCanvas && this.landmarkCtx) {
      this.landmarkCtx.clearRect(
        0,
        0,
        this.landmarkCanvas.width,
        this.landmarkCanvas.height
      );
    }

    // Update landmark button
    const landmarkButton = document.getElementById("toggleLandmarks");
    landmarkButton.innerHTML = '<i class="fas fa-eye"></i> Show Landmarks';
    landmarkButton.classList.remove("active");
    landmarkButton.disabled = true;

    console.log("Gesture recognition stopped");
  }

  processSpeech(transcript) {
    console.log("Processing speech:", transcript);

    // Send to server for sign language conversion
    this.socket.emit("speech-to-sign", {
      transcript: transcript,
      confidence: 0.9,
      timestamp: Date.now(),
    });
  }

  processHandResults(results) {
    if (!this.isRecognizingGestures) return;

    // Clear canvas
    if (this.landmarkCanvas && this.landmarkCtx) {
      this.landmarkCtx.clearRect(
        0,
        0,
        this.landmarkCanvas.width,
        this.landmarkCanvas.height
      );
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks, index) => {
        // Draw landmarks
        this.drawLandmarks(landmarks, index);

        // Analyze gesture
        const gesture = this.recognizeGesture(landmarks);
        if (gesture) {
          this.processGesture(gesture, landmarks);
        }
      });
    }
  }

  recognizeGesture(landmarks) {
    // Enhanced gesture recognition with better accuracy
    const now = Date.now();

    // Check cooldown to prevent spam
    if (this.lastGestureTime && now - this.lastGestureTime < 2000) {
      return null;
    }

    // Check each gesture pattern with improved algorithms
    const gestures = [
      { name: "yes", confidence: this.detectThumbUp(landmarks) },
      { name: "hello", confidence: this.detectWave(landmarks) },
      { name: "stop", confidence: this.detectStop(landmarks) },
      { name: "question", confidence: this.detectQuestion(landmarks) },
      { name: "no", confidence: this.detectThumbDown(landmarks) },
    ];

    // Find the gesture with highest confidence above threshold
    let bestGesture = null;
    let bestConfidence = 0;

    gestures.forEach((gesture) => {
      if (gesture.confidence > bestConfidence && gesture.confidence >= 0.7) {
        bestGesture = gesture.name;
        bestConfidence = gesture.confidence;
      }
    });

    // Add to history for stability check
    if (bestGesture) {
      this.gestureHistory.push({
        gesture: bestGesture,
        confidence: bestConfidence,
        timestamp: now,
      });

      // Keep only recent history
      if (this.gestureHistory.length > this.maxHistoryLength) {
        this.gestureHistory.shift();
      }

      // Check if gesture is consistent in recent history
      if (this.isGestureStable(bestGesture)) {
        this.lastGestureTime = now;
        console.log(
          `Gesture detected: ${bestGesture} (confidence: ${bestConfidence.toFixed(
            2
          )})`
        );
        return bestGesture;
      }
    }

    return null;
  }

  isGestureStable(gesture) {
    // Check if the same gesture appears in recent history
    const recentHistory = this.gestureHistory.filter(
      (entry) => Date.now() - entry.timestamp < 1000 // Last 1 second
    );

    if (recentHistory.length < 2) return false;

    // Count occurrences of the same gesture
    const sameGestureCount = recentHistory.filter(
      (entry) => entry.gesture === gesture
    ).length;

    // Require at least 60% consistency in recent history
    return sameGestureCount >= Math.ceil(recentHistory.length * 0.6);
  }

  // Enhanced gesture detection methods
  detectThumbUp(landmarks) {
    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // Check if thumb is extended (thumb tip is above thumb IP joint)
    const thumbExtended = thumbTip.y < thumbIP.y - 0.02;

    // Check if other fingers are closed
    const otherFingersClosed =
      !this.isFingerExtended(landmarks, 8) &&
      !this.isFingerExtended(landmarks, 12) &&
      !this.isFingerExtended(landmarks, 16) &&
      !this.isFingerExtended(landmarks, 20);

    if (thumbExtended && otherFingersClosed) {
      return 0.9;
    }
    return 0;
  }

  detectWave(landmarks) {
    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];

    // Check if index and middle fingers are extended
    const indexExtended = this.isFingerExtended(landmarks, 8);
    const middleExtended = this.isFingerExtended(landmarks, 12);
    const otherFingersClosed =
      !this.isFingerExtended(landmarks, 16) &&
      !this.isFingerExtended(landmarks, 20) &&
      !this.isFingerExtended(landmarks, 4);

    if (indexExtended && middleExtended && otherFingersClosed) {
      return 0.8;
    }
    return 0;
  }

  detectStop(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // Check if all fingers are extended
    const allExtended =
      this.isFingerExtended(landmarks, 8) &&
      this.isFingerExtended(landmarks, 12) &&
      this.isFingerExtended(landmarks, 16) &&
      this.isFingerExtended(landmarks, 20);

    // Check if thumb is closed (not extended)
    const thumbClosed = !this.isFingerExtended(landmarks, 4);

    if (allExtended && thumbClosed) {
      return 0.9;
    }
    return 0;
  }

  detectQuestion(landmarks) {
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const thumbTip = landmarks[4];

    // Check if only index finger is extended
    const indexExtended = this.isFingerExtended(landmarks, 8);
    const otherFingersClosed =
      !this.isFingerExtended(landmarks, 12) &&
      !this.isFingerExtended(landmarks, 16) &&
      !this.isFingerExtended(landmarks, 20) &&
      !this.isFingerExtended(landmarks, 4);

    if (indexExtended && otherFingersClosed) {
      return 0.85;
    }
    return 0;
  }

  detectThumbDown(landmarks) {
    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];
    const indexTip = landmarks[8];

    // Check if thumb is pointing down (thumb tip is below thumb IP joint)
    const thumbDown = thumbTip.y > thumbIP.y + 0.02;

    // Check if index finger is extended and others are closed
    const indexExtended = this.isFingerExtended(landmarks, 8);
    const otherFingersClosed =
      !this.isFingerExtended(landmarks, 12) &&
      !this.isFingerExtended(landmarks, 16) &&
      !this.isFingerExtended(landmarks, 20);

    if (thumbDown && indexExtended && otherFingersClosed) {
      return 0.8;
    }
    return 0;
  }

  isFingerExtended(landmarks, fingerIndex) {
    const fingerTip = landmarks[fingerIndex];
    const palm = landmarks[0];

    // Different logic for thumb vs other fingers
    if (fingerIndex === 4) {
      // Thumb
      const thumbIP = landmarks[3];
      // Thumb is extended if tip is above IP joint
      return fingerTip.y < thumbIP.y - 0.01;
    } else {
      // For other fingers, check if tip is above the MCP joint
      let mcpJoint;
      switch (fingerIndex) {
        case 8:
          mcpJoint = landmarks[5];
          break; // Index
        case 12:
          mcpJoint = landmarks[9];
          break; // Middle
        case 16:
          mcpJoint = landmarks[13];
          break; // Ring
        case 20:
          mcpJoint = landmarks[17];
          break; // Pinky
        default:
          return false;
      }
      return fingerTip.y < mcpJoint.y - 0.02;
    }
  }

  processGesture(gesture, landmarks) {
    console.log("Recognized gesture:", gesture);

    // Add to gesture list
    this.addGestureToList(gesture);

    // Send to server for speech conversion
    this.socket.emit("sign-to-speech", {
      gesture: gesture,
      confidence: 0.8,
      handPositions: landmarks,
      timestamp: Date.now(),
    });
  }

  displaySignAnimation(data) {
    const { signs, originalText } = data;

    // Update sign animation display
    const currentSignEl = document.getElementById("currentSign");
    const signGlossEl = document.getElementById("signGloss");

    if (signs.length > 0) {
      const primarySign = signs[0];
      currentSignEl.textContent = this.getSignSymbol(primarySign.sign);
      signGlossEl.textContent = `${primarySign.sign} (${primarySign.word})`;

      // Animate avatar
      this.animateAvatar(primarySign.sign);
    } else {
      currentSignEl.textContent = "No sign found";
      signGlossEl.textContent = originalText;
    }

    // Update transcript
    document.getElementById(
      "transcriptText"
    ).innerHTML = `<p><strong>Original:</strong> ${originalText}</p>`;
  }

  synthesizeSpeech(data) {
    const { text, gesture } = data;

    // Update speech output display
    document.getElementById(
      "speechText"
    ).innerHTML = `<p><strong>Gesture:</strong> ${gesture}<br><strong>Speech:</strong> ${text}</p>`;

    // Create speech synthesis utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.settings.speechRate;
    utterance.volume = 1;

    // Select appropriate voice
    const voices = this.synthesis.getVoices();
    const preferredVoice = voices.find(
      (voice) => voice.lang.startsWith("en") && voice.name.includes("Female")
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    this.synthesis.speak(utterance);

    console.log("Synthesizing speech:", text);
  }

  getSignSymbol(sign) {
    const signSymbols = {
      hello: "👋",
      thank_you: "🙏",
      yes: "👍",
      no: "👎",
      please: "🤲",
      help: "🆘",
      stop: "✋",
      go: "👉",
      wait: "⏳",
      question: "❓",
    };

    return signSymbols[sign] || "🤷";
  }

  animateAvatar(sign) {
    const leftArm = document.getElementById("leftArm");
    const rightArm = document.getElementById("rightArm");

    // Remove existing animations
    leftArm.classList.remove("signing");
    rightArm.classList.remove("signing");

    // Add animation based on sign
    setTimeout(() => {
      if (["hello", "thank_you", "stop"].includes(sign)) {
        leftArm.classList.add("signing");
        rightArm.classList.add("signing");
      } else if (["yes", "go"].includes(sign)) {
        rightArm.classList.add("signing");
      } else if (["no", "wait"].includes(sign)) {
        leftArm.classList.add("signing");
      }
    }, 100);
  }

  addGestureToList(gesture) {
    const gestureList = document.getElementById("gestureList");
    const placeholder = gestureList.querySelector(".placeholder");

    if (placeholder) {
      placeholder.remove();
    }

    const gestureItem = document.createElement("div");
    gestureItem.className = "gesture-item";
    gestureItem.innerHTML = `
            <i class="fas fa-hand-paper"></i>
            <span>${gesture} (${new Date().toLocaleTimeString()})</span>
        `;

    gestureList.insertBefore(gestureItem, gestureList.firstChild);

    // Limit to 5 items
    while (gestureList.children.length > 5) {
      gestureList.removeChild(gestureList.lastChild);
    }
  }

  updateTranscript(data) {
    const { text, confidence } = data;
    document.getElementById(
      "transcriptText"
    ).innerHTML = `<p>${text} <span style="opacity: 0.6;">(${Math.round(
      confidence * 100
    )}%)</span></p>`;
  }

  updateTranscriptDisplay(final, interim) {
    const transcriptEl = document.getElementById("transcriptText");

    if (final) {
      transcriptEl.innerHTML = `<p><strong>Final:</strong> ${final}</p>`;
    } else if (interim) {
      transcriptEl.innerHTML = `<p><em>Listening...</em> ${interim}</p>`;
    }
  }

  updateListeningState(isListening) {
    const indicator = document.getElementById("gestureIndicator");
    const icon = indicator.querySelector("i");
    const text = indicator.querySelector("span");

    if (isListening) {
      indicator.classList.add("listening");
      icon.className = "fas fa-microphone";
      text.textContent = "Listening...";
    } else {
      indicator.classList.remove("listening");
      icon.className = "fas fa-hand-paper";
      text.textContent = "Ready";
    }
  }

  updateGestureIndicator(state) {
    const indicator = document.getElementById("gestureIndicator");
    const icon = indicator.querySelector("i");
    const text = indicator.querySelector("span");

    indicator.className = `gesture-indicator ${state}`;

    switch (state) {
      case "listening":
        icon.className = "fas fa-hand-paper";
        text.textContent = "Recognizing...";
        break;
      case "processing":
        icon.className = "fas fa-cog";
        text.textContent = "Processing...";
        break;
      case "speaking":
        icon.className = "fas fa-volume-up";
        text.textContent = "Speaking...";
        break;
      default:
        icon.className = "fas fa-hand-paper";
        text.textContent = "Ready";
    }
  }

  updateConnectionStatus(connected) {
    const status = document.getElementById("connectionStatus");
    const icon = status.querySelector("i");
    const text = status.querySelector("span");

    if (connected) {
      status.classList.add("connected");
      text.textContent = "Connected";
    } else {
      status.classList.remove("connected");
      text.textContent = "Disconnected";
    }
  }

  joinMeeting() {
    const meetingId = document.getElementById("meetingId").value;
    const participantType = document.querySelector(
      'input[name="participantType"]:checked'
    ).value;

    if (!meetingId) {
      this.showError("Please enter a meeting ID");
      return;
    }

    this.socket.emit("meeting-join", {
      meetingId: meetingId,
      participantId: this.socket.id,
      isDeaf: participantType === "deaf",
    });

    document.getElementById("interpreterStatus").textContent = "Connected";
    console.log(
      `Joined meeting ${meetingId} as ${participantType} participant`
    );
  }

  handleInterpreterJoined(data) {
    const { participantId, isDeaf } = data;
    const countEl = document.getElementById("participantCount");
    const currentCount = parseInt(countEl.textContent) || 0;
    countEl.textContent = currentCount + 1;

    console.log(
      `Interpreter joined: ${participantId} (${isDeaf ? "deaf" : "hearing"})`
    );
  }

  openSettings() {
    document.getElementById("settingsPanel").classList.add("open");
  }

  closeSettings() {
    document.getElementById("settingsPanel").classList.remove("open");
  }

  loadSettings() {
    const saved = localStorage.getItem("signLanguageInterpreterSettings");
    if (saved) {
      this.settings = { ...this.settings, ...JSON.parse(saved) };
    }

    // Apply settings to UI
    document.getElementById("signLanguage").value = this.settings.signLanguage;
    document.getElementById("speechRate").value = this.settings.speechRate;
    document.getElementById("gestureSensitivity").value =
      this.settings.gestureSensitivity;
    document.getElementById("showSubtitles").checked =
      this.settings.showSubtitles;
    document.getElementById("autoStart").checked = this.settings.autoStart;

    document.getElementById("speechRateValue").textContent =
      this.settings.speechRate;
    document.getElementById("gestureSensitivityValue").textContent =
      this.settings.gestureSensitivity;
  }

  saveSettings() {
    localStorage.setItem(
      "signLanguageInterpreterSettings",
      JSON.stringify(this.settings)
    );
  }

  showLoading() {
    document.getElementById("loadingOverlay").classList.remove("hidden");
  }

  hideLoading() {
    document.getElementById("loadingOverlay").classList.add("hidden");
  }

  setupLandmarkCanvas() {
    if (!this.camera) return;

    // Create canvas element
    this.landmarkCanvas = document.createElement("canvas");
    this.landmarkCanvas.style.position = "absolute";
    this.landmarkCanvas.style.top = "0";
    this.landmarkCanvas.style.left = "0";
    this.landmarkCanvas.style.pointerEvents = "none";
    this.landmarkCanvas.style.zIndex = "10";
    this.landmarkCanvas.style.borderRadius = "20px";

    // Position canvas over video
    const videoContainer = this.camera.parentElement;
    if (videoContainer) {
      videoContainer.style.position = "relative";
      videoContainer.appendChild(this.landmarkCanvas);
    }

    this.landmarkCtx = this.landmarkCanvas.getContext("2d");
    this.resizeLandmarkCanvas();

    // Resize canvas when video loads
    this.camera.addEventListener("loadedmetadata", () => {
      this.resizeLandmarkCanvas();
    });
  }

  resizeLandmarkCanvas() {
    if (!this.landmarkCanvas || !this.camera) return;

    this.landmarkCanvas.width =
      this.camera.videoWidth || this.camera.clientWidth;
    this.landmarkCanvas.height =
      this.camera.videoHeight || this.camera.clientHeight;
  }

  drawLandmarks(landmarks, handIndex) {
    if (!this.landmarkCtx || !this.landmarkCanvas) return;

    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"];
    const color = colors[handIndex % colors.length];

    // Draw connections
    this.drawConnections(landmarks, color);

    // Draw landmarks
    landmarks.forEach((landmark, index) => {
      const x = landmark.x * this.landmarkCanvas.width;
      const y = landmark.y * this.landmarkCanvas.height;

      this.landmarkCtx.beginPath();
      this.landmarkCtx.arc(x, y, 4, 0, 2 * Math.PI);
      this.landmarkCtx.fillStyle = color;
      this.landmarkCtx.fill();

      // Highlight fingertips
      if (this.isFingertip(index)) {
        this.landmarkCtx.beginPath();
        this.landmarkCtx.arc(x, y, 6, 0, 2 * Math.PI);
        this.landmarkCtx.fillStyle = "#FFD700";
        this.landmarkCtx.fill();
      }
    });
  }

  drawConnections(landmarks, color) {
    const connections = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4], // Thumb
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8], // Index finger
      [0, 9],
      [9, 10],
      [10, 11],
      [11, 12], // Middle finger
      [0, 13],
      [13, 14],
      [14, 15],
      [15, 16], // Ring finger
      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20], // Pinky
      [5, 9],
      [9, 13],
      [13, 17], // Palm connections
    ];

    this.landmarkCtx.strokeStyle = color;
    this.landmarkCtx.lineWidth = 2;

    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];

      this.landmarkCtx.beginPath();
      this.landmarkCtx.moveTo(
        startPoint.x * this.landmarkCanvas.width,
        startPoint.y * this.landmarkCanvas.height
      );
      this.landmarkCtx.lineTo(
        endPoint.x * this.landmarkCanvas.width,
        endPoint.y * this.landmarkCanvas.height
      );
      this.landmarkCtx.stroke();
    });
  }

  isFingertip(index) {
    return [4, 8, 12, 16, 20].includes(index);
  }

  toggleLandmarks() {
    // Landmarks are now always visible, so this just shows a message
    const button = document.getElementById("toggleLandmarks");
    button.innerHTML = '<i class="fas fa-eye"></i> Landmarks Always On';
    button.classList.add("active");
    button.disabled = true;
  }

  showError(message) {
    // Simple error display - in production, you'd want a proper modal
    alert(`Error: ${message}`);
  }
}

// Initialize the application when the page loads
document.addEventListener("DOMContentLoaded", () => {
  window.interpreter = new SignLanguageInterpreter();
});

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.hidden && window.interpreter) {
    // Pause recognition when tab is not visible
    if (window.interpreter.isListening) {
      window.interpreter.stopListening();
    }
    if (window.interpreter.isRecognizingGestures) {
      window.interpreter.stopGestureRecognition();
    }
  }
});

// Handle beforeunload to clean up resources
window.addEventListener("beforeunload", () => {
  if (window.interpreter) {
    if (window.interpreter.isListening) {
      window.interpreter.stopListening();
    }
    if (window.interpreter.isRecognizingGestures) {
      window.interpreter.stopGestureRecognition();
    }
    if (window.interpreter.camera && window.interpreter.camera.srcObject) {
      window.interpreter.camera.srcObject
        .getTracks()
        .forEach((track) => track.stop());
    }
  }
});
