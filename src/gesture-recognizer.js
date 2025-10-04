export class GestureRecognizer {
  constructor() {
    this.isActive = false;
    this.hands = null;
    this.camera = null;
    this.sensitivity = 0.7;
    this.gestureHistory = [];
    this.maxHistoryLength = 10;
    this.canvas = null;
    this.ctx = null;
    this.showLandmarks = true; // Always show landmarks by default
    this.lastGestureTime = 0;
    this.gestureCooldown = 1000; // 1 second cooldown between gestures

    this.gesturePatterns = {
      hello: {
        description: "Wave hand",
        pattern: (landmarks) => this.detectWave(landmarks),
        confidence: 0.8,
      },
      yes: {
        description: "Thumb up",
        pattern: (landmarks) => this.detectThumbUp(landmarks),
        confidence: 0.9,
      },
      no: {
        description: "Thumb down or shake head",
        pattern: (landmarks) => this.detectThumbDown(landmarks),
        confidence: 0.8,
      },
      thank_you: {
        description: "Both hands together",
        pattern: (landmarks) => this.detectThankYou(landmarks),
        confidence: 0.7,
      },
      stop: {
        description: "Open palm forward",
        pattern: (landmarks) => this.detectStop(landmarks),
        confidence: 0.85,
      },
      question: {
        description: "Index finger up",
        pattern: (landmarks) => this.detectQuestion(landmarks),
        confidence: 0.9,
      },
      help: {
        description: "Both hands up",
        pattern: (landmarks) => this.detectHelp(landmarks),
        confidence: 0.6,
      },
      wait: {
        description: "One hand up, palm out",
        pattern: (landmarks) => this.detectWait(landmarks),
        confidence: 0.7,
      },
      go: {
        description: "Pointing gesture",
        pattern: (landmarks) => this.detectGo(landmarks),
        confidence: 0.8,
      },
      please: {
        description: "Circular motion with hand",
        pattern: (landmarks) => this.detectPlease(landmarks),
        confidence: 0.5,
      },
    };

    this.init();
  }

  async init() {
    try {
      await this.initializeMediaPipe();
      console.log("Gesture recognizer initialized");
    } catch (error) {
      console.error("Failed to initialize gesture recognizer:", error);
    }
  }

  async initializeMediaPipe() {
    // Check if MediaPipe is available
    if (typeof Hands === "undefined") {
      throw new Error("MediaPipe Hands not available");
    }

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
  }

  async start() {
    if (this.isActive) return;

    try {
      // Get camera access
      await this.initializeCamera();

      // Setup canvas for landmark visualization
      this.setupCanvas();

      // Start MediaPipe processing
      if (this.hands) {
        this.camera = new Camera(this.cameraElement, {
          onFrame: async () => {
            await this.hands.send({ image: this.cameraElement });
          },
          width: 640,
          height: 480,
        });

        this.camera.start();
      }

      this.isActive = true;
      console.log("Gesture recognition started");
    } catch (error) {
      console.error("Failed to start gesture recognition:", error);
      throw error;
    }
  }

  stop() {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }

    if (this.cameraElement && this.cameraElement.srcObject) {
      this.cameraElement.srcObject.getTracks().forEach((track) => track.stop());
    }

    console.log("Gesture recognition stopped");
  }

  async initializeCamera() {
    try {
      this.cameraElement = document.getElementById("userVideo");
      if (!this.cameraElement) {
        throw new Error("Camera element not found");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });

      this.cameraElement.srcObject = stream;
      this.cameraElement.play();
    } catch (error) {
      console.error("Camera initialization failed:", error);
      throw error;
    }
  }

  processHandResults(results) {
    if (!this.isActive) return;

    // Clear canvas
    if (this.ctx && this.showLandmarks) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks, index) => {
        // Draw landmarks if enabled
        if (this.showLandmarks) {
          this.drawLandmarks(landmarks, index);
        }

        // Analyze gesture
        this.analyzeHandGesture(landmarks);
      });
    }
  }

  analyzeHandGesture(landmarks) {
    let bestMatch = null;
    let bestConfidence = 0;

    // Check each gesture pattern
    for (const [gestureName, gestureData] of Object.entries(
      this.gesturePatterns
    )) {
      const confidence = gestureData.pattern(landmarks);

      if (confidence > bestConfidence && confidence >= gestureData.confidence) {
        bestMatch = gestureName;
        bestConfidence = confidence;
      }
    }

    // Apply cooldown to prevent spam
    const currentTime = Date.now();
    if (
      bestMatch &&
      currentTime - this.lastGestureTime > this.gestureCooldown
    ) {
      this.handleGestureDetection(bestMatch, bestConfidence, landmarks);
      this.lastGestureTime = currentTime;
    }
  }

  handleGestureDetection(gesture, confidence, landmarks) {
    // Add to gesture history
    this.gestureHistory.push({
      gesture: gesture,
      confidence: confidence,
      timestamp: Date.now(),
      landmarks: landmarks,
    });

    // Limit history length
    if (this.gestureHistory.length > this.maxHistoryLength) {
      this.gestureHistory.shift();
    }

    // Emit gesture detected event
    this.emit("gesture-detected", {
      gesture: gesture,
      confidence: confidence,
      landmarks: landmarks,
      timestamp: Date.now(),
    });

    console.log(
      `Gesture detected: ${gesture} (confidence: ${confidence.toFixed(2)})`
    );
  }

  // Setup canvas for landmark visualization
  setupCanvas() {
    if (!this.cameraElement) return;

    // Create canvas element
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "10";

    // Position canvas over video
    const videoContainer = this.cameraElement.parentElement;
    if (videoContainer) {
      videoContainer.style.position = "relative";
      videoContainer.appendChild(this.canvas);
    }

    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();

    // Resize canvas when video loads
    this.cameraElement.addEventListener("loadedmetadata", () => {
      this.resizeCanvas();
    });
  }

  resizeCanvas() {
    if (!this.canvas || !this.cameraElement) return;

    this.canvas.width =
      this.cameraElement.videoWidth || this.cameraElement.clientWidth;
    this.canvas.height =
      this.cameraElement.videoHeight || this.cameraElement.clientHeight;
  }

  drawLandmarks(landmarks, handIndex) {
    if (!this.ctx || !this.canvas) return;

    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"];
    const color = colors[handIndex % colors.length];

    // Draw connections
    this.drawConnections(landmarks, color);

    // Draw landmarks
    landmarks.forEach((landmark, index) => {
      const x = landmark.x * this.canvas.width;
      const y = landmark.y * this.canvas.height;

      this.ctx.beginPath();
      this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
      this.ctx.fillStyle = color;
      this.ctx.fill();

      // Highlight fingertips
      if (this.isFingertip(index)) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
        this.ctx.fillStyle = "#FFD700";
        this.ctx.fill();
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

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;

    connections.forEach(([start, end]) => {
      const startPoint = landmarks[start];
      const endPoint = landmarks[end];

      this.ctx.beginPath();
      this.ctx.moveTo(
        startPoint.x * this.canvas.width,
        startPoint.y * this.canvas.height
      );
      this.ctx.lineTo(
        endPoint.x * this.canvas.width,
        endPoint.y * this.canvas.height
      );
      this.ctx.stroke();
    });
  }

  isFingertip(index) {
    return [4, 8, 12, 16, 20].includes(index);
  }

  // Enhanced gesture detection patterns
  detectWave(landmarks) {
    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];

    // Check if index finger is extended and other fingers are closed
    const indexExtended = this.isFingerExtended(landmarks, 8);
    const middleClosed = !this.isFingerExtended(landmarks, 12);
    const ringClosed = !this.isFingerExtended(landmarks, 16);
    const pinkyClosed = !this.isFingerExtended(landmarks, 20);

    if (indexExtended && middleClosed && ringClosed && pinkyClosed) {
      // Additional check: index finger should be significantly above wrist
      const heightDiff = wrist.y - indexTip.y;
      if (heightDiff > 0.1) {
        return 0.85;
      }
    }

    return 0;
  }

  detectThumbUp(landmarks) {
    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // Check if thumb is extended (thumb tip is above thumb IP joint)
    const thumbExtended = thumbTip.y < thumbIP.y;

    // Check if other fingers are closed
    const otherFingersClosed =
      !this.isFingerExtended(landmarks, 8) &&
      !this.isFingerExtended(landmarks, 12) &&
      !this.isFingerExtended(landmarks, 16) &&
      !this.isFingerExtended(landmarks, 20);

    if (thumbExtended && otherFingersClosed) {
      // Additional check: thumb should be significantly above other fingertips
      const thumbHeight = thumbTip.y;
      const avgFingerHeight =
        (indexTip.y + middleTip.y + ringTip.y + pinkyTip.y) / 4;

      if (thumbHeight < avgFingerHeight - 0.05) {
        return 0.95;
      }
    }

    return 0;
  }

  detectThumbDown(landmarks) {
    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];

    // Check if thumb is pointing down (thumb tip is below thumb IP joint)
    const thumbDown = thumbTip.y > thumbIP.y;

    // Check if index finger is extended and others are closed
    const indexExtended = this.isFingerExtended(landmarks, 8);
    const otherFingersClosed =
      !this.isFingerExtended(landmarks, 12) &&
      !this.isFingerExtended(landmarks, 16) &&
      !this.isFingerExtended(landmarks, 20);

    if (thumbDown && indexExtended && otherFingersClosed) {
      return 0.85;
    }

    return 0;
  }

  detectThankYou(landmarks) {
    // This would require both hands, simplified for single hand
    const palm = landmarks[0];
    const fingers = [4, 8, 12, 16, 20];

    // Check if all fingers are extended (prayer position)
    const allExtended = fingers.every((finger) =>
      this.isFingerExtended(landmarks, finger)
    );

    if (allExtended) {
      return 0.7;
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
      // Additional check: fingers should be spread out
      const indexMiddleDist = Math.sqrt(
        Math.pow(indexTip.x - middleTip.x, 2) +
          Math.pow(indexTip.y - middleTip.y, 2)
      );
      const middleRingDist = Math.sqrt(
        Math.pow(middleTip.x - ringTip.x, 2) +
          Math.pow(middleTip.y - ringTip.y, 2)
      );

      if (indexMiddleDist > 0.08 && middleRingDist > 0.06) {
        return 0.9;
      }
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
      // Additional check: index finger should be significantly above other fingertips
      const indexHeight = indexTip.y;
      const avgOtherHeight =
        (middleTip.y + ringTip.y + pinkyTip.y + thumbTip.y) / 4;

      if (indexHeight < avgOtherHeight - 0.08) {
        return 0.95;
      }
    }

    return 0;
  }

  detectHelp(landmarks) {
    // Simplified - check if both hands are raised
    const wrist = landmarks[0];
    const middleFinger = landmarks[12];

    // Check if hand is raised (wrist above middle finger)
    if (wrist.y < middleFinger.y) {
      return 0.6;
    }

    return 0;
  }

  detectWait(landmarks) {
    const palm = landmarks[0];
    const indexFinger = landmarks[8];

    // Check if hand is raised with palm facing forward
    if (this.isFingerExtended(landmarks, 8) && palm.y < indexFinger.y) {
      return 0.7;
    }

    return 0;
  }

  detectGo(landmarks) {
    const indexFinger = landmarks[8];
    const middleFinger = landmarks[12];

    // Check if only index finger is extended (pointing)
    if (
      this.isFingerExtended(landmarks, 8) &&
      !this.isFingerExtended(landmarks, 12)
    ) {
      return 0.8;
    }

    return 0;
  }

  detectPlease(landmarks) {
    // Simplified - check for circular motion
    // This would require tracking hand movement over time
    const palm = landmarks[0];
    const indexFinger = landmarks[8];

    // Basic detection - hand in circular position
    if (this.isFingerExtended(landmarks, 8)) {
      return 0.5; // Lower confidence for complex gesture
    }

    return 0;
  }

  isFingerExtended(landmarks, fingerIndex) {
    // Enhanced finger extension detection using multiple joints
    const fingerTip = landmarks[fingerIndex];
    const palm = landmarks[0];

    // Different logic for thumb vs other fingers
    if (fingerIndex === 4) {
      // Thumb
      const thumbIP = landmarks[3];
      const thumbMCP = landmarks[2];
      // Thumb is extended if tip is above IP joint
      return fingerTip.y < thumbIP.y;
    } else {
      // For other fingers, check if tip is above the MCP joint
      let mcpJoint;
      switch (fingerIndex) {
        case 8:
          mcpJoint = landmarks[5];
          break; // Index finger MCP
        case 12:
          mcpJoint = landmarks[9];
          break; // Middle finger MCP
        case 16:
          mcpJoint = landmarks[13];
          break; // Ring finger MCP
        case 20:
          mcpJoint = landmarks[17];
          break; // Pinky MCP
        default:
          mcpJoint = palm;
      }

      // Finger is extended if tip is significantly above MCP joint
      return fingerTip.y < mcpJoint.y - 0.02;
    }
  }

  // Toggle landmark visualization
  toggleLandmarks() {
    this.showLandmarks = !this.showLandmarks;
    if (!this.showLandmarks && this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // Update gesture cooldown
  setGestureCooldown(ms) {
    this.gestureCooldown = ms;
  }

  updateSensitivity(newSensitivity) {
    this.sensitivity = newSensitivity;

    if (this.hands) {
      this.hands.setOptions({
        minDetectionConfidence: this.sensitivity,
      });
    }
  }

  getGestureHistory() {
    return [...this.gestureHistory];
  }

  clearGestureHistory() {
    this.gestureHistory = [];
  }

  // Event emitter functionality
  emit(event, data) {
    const customEvent = new CustomEvent(`gesture-recognizer:${event}`, {
      detail: data,
    });
    window.dispatchEvent(customEvent);
  }
}
