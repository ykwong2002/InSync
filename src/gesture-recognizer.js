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
    this.showLandmarks = true;
    this.lastGestureTime = 0;
    this.gestureCooldown = 1000; // ms

    // NEW: history of recent landmark frames per hand (index by hand id)
    this.handHistories = {}; // { handIndex: [landmarksFrames...] }
    this.maxPoseHistory = 12; // ~0.4s @ 30fps — adjust as needed

    // gesture patterns same as before but pattern receives (landmarks, handLabel, otherHands)
    this.gesturePatterns = {
      hello: {
        description: "Wave hand",
        pattern: (lm, label, ctx) => this.detectWave(lm, label, ctx),
        confidence: 0.8,
      },
      yes: {
        description: "Thumb up",
        pattern: (lm, label) => this.detectThumbUp(lm, label),
        confidence: 0.9,
      },
      no: {
        description: "Thumb down or shake head",
        pattern: (lm, label) => this.detectThumbDown(lm, label),
        confidence: 0.9,
      },
      thank_you: {
        description: "Both hands together",
        pattern: (lm, label, ctx) => this.detectThankYou(lm, label, ctx),
        confidence: 0.7,
      },
      stop: {
        description: "Open palm forward",
        pattern: (lm, label) => this.detectStop(lm, label),
        confidence: 0.85,
      },
      question: {
        description: "Index finger up",
        pattern: (lm, label) => this.detectQuestion(lm, label),
        confidence: 0.9,
      },
      help: {
        description: "Both hands up",
        pattern: (lm, label, ctx) => this.detectHelp(lm, label, ctx),
        confidence: 0.6,
      },
      wait: {
        description: "One hand up, palm out",
        pattern: (lm, label) => this.detectWait(lm, label),
        confidence: 0.7,
      },
      go: {
        description: "Pointing gesture",
        pattern: (lm, label) => this.detectGo(lm, label),
        confidence: 0.8,
      },
      please: {
        description: "Circular motion with hand",
        pattern: (lm, label, ctx) => this.detectPlease(lm, label, ctx),
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
    if (typeof window.HandLandmarker === "undefined") {
      throw new Error("MediaPipe HandLandmarker not available");
    }

    const options = {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "LIVE_STREAM",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.7,
      resultCallback: (results, image, timestamp) => {
        this.processHandResults(results);
      },
    };

    try {
      this.hands = await createHandLandmarker({
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "LIVE_STREAM",
        numHands: 2,
        onResults: (results) => {
          // Update landmarks display
          const landmarksDisplay = document.getElementById("landmarksDisplay");
          if (
            landmarksDisplay &&
            results.landmarks &&
            results.landmarks.length > 0
          ) {
            let displayText = "Hand Landmarks:\n";
            results.landmarks.forEach((handLandmarks, handIndex) => {
              displayText += `\nHand ${handIndex + 1}:\n`;
              handLandmarks.forEach((landmark, index) => {
                displayText += `Point ${index}: x=${landmark.x.toFixed(
                  3
                )}, y=${landmark.y.toFixed(3)}, z=${landmark.z.toFixed(3)}\n`;
              });
            });
            landmarksDisplay.textContent = displayText;
          } else if (landmarksDisplay) {
            landmarksDisplay.textContent = "No hands detected";
          }
        },
      });
      console.log("HandLandmarker initialized successfully");
    } catch (error) {
      console.error("Failed to initialize HandLandmarker:", error);
      throw error;
    }
  }

  async start() {
    if (this.isActive) return;
    try {
      await this.initializeCamera();
      this.setupCanvas();
      this.setupLandmarksDisplay();

      if (this.hands) {
        // Setup video frame processing
        const processFrame = async () => {
          if (this.isActive && this.cameraElement.videoWidth > 0) {
            const timestamp = performance.now();
            await this.hands.detectAsync(this.cameraElement, timestamp);
            // Request next frame
            requestAnimationFrame(processFrame);
          }
        };

        // Start processing frames
        requestAnimationFrame(processFrame);
      }

      this.isActive = true;
      console.log("Hand landmark detection started");
    } catch (error) {
      console.error("Failed to start hand landmark detection:", error);
      throw error;
    }
  }

  setupLandmarksDisplay() {
    // Create landmarks display if it doesn't exist
    let landmarksDisplay = document.getElementById("landmarksDisplay");
    if (!landmarksDisplay) {
      landmarksDisplay = document.createElement("div");
      landmarksDisplay.id = "landmarksDisplay";
      landmarksDisplay.style.position = "absolute";
      landmarksDisplay.style.top = "10px";
      landmarksDisplay.style.right = "10px";
      landmarksDisplay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
      landmarksDisplay.style.color = "white";
      landmarksDisplay.style.padding = "10px";
      landmarksDisplay.style.borderRadius = "5px";
      landmarksDisplay.style.fontFamily = "monospace";
      landmarksDisplay.style.fontSize = "12px";
      landmarksDisplay.style.zIndex = "100";
      landmarksDisplay.style.whiteSpace = "pre";
      landmarksDisplay.textContent = "Waiting for hand detection...";

      const videoContainer = this.cameraElement.parentElement;
      if (videoContainer) {
        videoContainer.appendChild(landmarksDisplay);
      }
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
      this.cameraElement.srcObject.getTracks().forEach((t) => t.stop());
    }
    console.log("Gesture recognition stopped");
  }

  async initializeCamera() {
    try {
      this.cameraElement = document.getElementById("userVideo");
      if (!this.cameraElement) throw new Error("Camera element not found");

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

    // draw landmarks only if requested
    if (this.ctx && this.showLandmarks)
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const multiLandmarks = results.multiHandLandmarks || [];
    const multiHandedness = results.multiHandedness || [];

    // Build a map of other hands for multi-hand gestures
    const allHands = multiLandmarks.map((lm, i) => ({
      landmarks: lm,
      label: (multiHandedness[i] && multiHandedness[i].label) || null,
    }));

    // Ensure histories exist for each detected hand index
    allHands.forEach((hand, i) => {
      // Save landmark history for motion-based gestures
      if (!this.handHistories[i]) this.handHistories[i] = [];
      // store a *shallow* copy of normalized points (x,y,z)
      this.handHistories[i].push(
        hand.landmarks.map((pt) => ({ x: pt.x, y: pt.y, z: pt.z }))
      );
      if (this.handHistories[i].length > this.maxPoseHistory)
        this.handHistories[i].shift();
    });

    // Draw & analyze each hand
    allHands.forEach((hand, i) => {
      if (this.showLandmarks) this.drawLandmarks(hand.landmarks, i);
      this.analyzeHandGesture(hand.landmarks, hand.label, allHands, i);
    });

    // If no hands detected, optionally clear histories
    if (allHands.length === 0) this.handHistories = {};
  }

  analyzeHandGesture(landmarks, handLabel, allHands, handIndex) {
    let bestMatch = null;
    let bestConfidence = 0;

    for (const [gestureName, gestureData] of Object.entries(
      this.gesturePatterns
    )) {
      // call pattern with landmarks, handedness label, and other hands context
      const confidence = gestureData.pattern(landmarks, handLabel, {
        allHands,
        handIndex,
        histories: this.handHistories,
      });

      if (confidence > bestConfidence && confidence >= gestureData.confidence) {
        bestMatch = gestureName;
        bestConfidence = confidence;
      }
    }

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
    this.gestureHistory.push({
      gesture,
      confidence,
      timestamp: Date.now(),
      landmarks,
    });
    if (this.gestureHistory.length > this.maxHistoryLength)
      this.gestureHistory.shift();
    this.emit("gesture-detected", {
      gesture,
      confidence,
      landmarks,
      timestamp: Date.now(),
    });
    console.log(
      `Gesture detected: ${gesture} (confidence: ${confidence.toFixed(2)})`
    );
  }

  // Canvas helpers (unchanged)
  setupCanvas() {
    if (!this.cameraElement) return;
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "10";
    const videoContainer = this.cameraElement.parentElement;
    if (videoContainer) {
      videoContainer.style.position = "relative";
      videoContainer.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext("2d");
    this.resizeCanvas();
    this.cameraElement.addEventListener("loadedmetadata", () =>
      this.resizeCanvas()
    );
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
    this.drawConnections(landmarks, color);
    landmarks.forEach((landmark, index) => {
      const x = landmark.x * this.canvas.width;
      const y = landmark.y * this.canvas.height;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
      this.ctx.fillStyle = color;
      this.ctx.fill();
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
      [3, 4],
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [0, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [0, 13],
      [13, 14],
      [14, 15],
      [15, 16],
      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20],
      [5, 9],
      [9, 13],
      [13, 17],
    ];
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    connections.forEach(([s, e]) => {
      const a = landmarks[s],
        b = landmarks[e];
      this.ctx.beginPath();
      this.ctx.moveTo(a.x * this.canvas.width, a.y * this.canvas.height);
      this.ctx.lineTo(b.x * this.canvas.width, b.y * this.canvas.height);
      this.ctx.stroke();
    });
  }

  isFingertip(index) {
    return [4, 8, 12, 16, 20].includes(index);
  }

  // ------- Improved gesture detectors -------

  // Helper: robust finger extended detection
  isFingerExtended(landmarks, fingerIndex, handLabel = null) {
    // landmarks: array of 21 points with .x,.y,.z normalized
    // For non-thumb fingers: compare tip (TIP) y < pip (or mcp) y -> extended (camera coords: up is smaller y)
    if (fingerIndex === 4) {
      // Thumb: orientation depends on handedness and camera orientation.
      // Use x comparisons between tip and MCP or IP.
      const thumbTip = landmarks[4];
      const thumbMCP = landmarks[2];
      const thumbIP = landmarks[3];

      if (handLabel && handLabel.toLowerCase().startsWith("right")) {
        // for right hand, thumb points left on camera when extended (tip.x < mcp.x)
        return thumbTip.x < thumbMCP.x - 0.02;
      } else if (handLabel && handLabel.toLowerCase().startsWith("left")) {
        // for left hand, thumb points right when extended (tip.x > mcp.x)
        return thumbTip.x > thumbMCP.x + 0.02;
      } else {
        // fallback: compare tip vs IP y to detect large displacement
        return (
          Math.abs(thumbTip.x - thumbIP.x) > 0.03 ||
          Math.abs(thumbTip.y - thumbIP.y) > 0.03
        );
      }
    } else {
      // finger indices map: 8=index,12=middle,16=ring,20=pinky
      let pipIdx = null;
      switch (fingerIndex) {
        case 8:
          pipIdx = 6;
          break; // index PIP roughly at 6
        case 12:
          pipIdx = 10;
          break; // middle PIP 10
        case 16:
          pipIdx = 14;
          break; // ring PIP 14
        case 20:
          pipIdx = 18;
          break; // pinky PIP 18
        default:
          pipIdx = 0;
      }
      const tip = landmarks[fingerIndex];
      const pip = landmarks[pipIdx];
      // extended if tip is significantly above (smaller y) than pip
      return tip.y < pip.y - 0.02;
    }
  }

  detectWave(landmarks, handLabel, ctx) {
    // wave = lateral (x) oscillation of wrist or index-tip across recent frames
    // use history to compute variance/oscillation
    const idx = ctx && ctx.handIndex !== undefined ? ctx.handIndex : 0;
    const history = this.handHistories[idx] || [];
    if (history.length < 6) return 0; // need a few frames
    // pick index fingertip positions over time
    const xs = history.map((fr) => fr[8].x);
    const range = Math.max(...xs) - Math.min(...xs);
    // amplitude threshold (normalized coords)
    if (range > 0.06) return 0.85;
    return 0;
  }

  detectThumbUp(landmarks, handLabel) {
    // thumb up: thumb extended, other fingers closed and thumb above (smaller y) than fingers
    const thumbExtended = this.isFingerExtended(landmarks, 4, handLabel);
    const othersClosed =
      !this.isFingerExtended(landmarks, 8, handLabel) &&
      !this.isFingerExtended(landmarks, 12, handLabel) &&
      !this.isFingerExtended(landmarks, 16, handLabel) &&
      !this.isFingerExtended(landmarks, 20, handLabel);

    if (!thumbExtended || !othersClosed) return 0;

    // check vertical relation: thumb tip should be above average fingertip y (smaller y)
    const thumbTipY = landmarks[4].y;
    const avgFingersY =
      (landmarks[8].y + landmarks[12].y + landmarks[16].y + landmarks[20].y) /
      4;
    if (thumbTipY < avgFingersY - 0.03) return 0.95;
    return 0;
  }

  detectThumbDown(landmarks, handLabel) {
    const thumbExtended = this.isFingerExtended(landmarks, 4, handLabel);
    const othersClosed =
      !this.isFingerExtended(landmarks, 8, handLabel) &&
      !this.isFingerExtended(landmarks, 12, handLabel) &&
      !this.isFingerExtended(landmarks, 16, handLabel) &&
      !this.isFingerExtended(landmarks, 20, handLabel);

    if (!thumbExtended || !othersClosed) return 0;
    // thumb tip lower (bigger y) than average fingertips -> thumbs down
    const thumbTipY = landmarks[4].y;
    const avgFingersY =
      (landmarks[8].y + landmarks[12].y + landmarks[16].y + landmarks[20].y) /
      4;
    if (thumbTipY > avgFingersY + 0.03) return 0.95;
    return 0;
  }

  detectThankYou(landmarks, handLabel, ctx) {
    // prefer two-hand detection: check if two hands exist and palms are near each other
    const allHands = ctx && ctx.allHands ? ctx.allHands : null;
    if (allHands && allHands.length >= 2) {
      // Get wrist positions of both hands
      const a = allHands[0].landmarks[0];
      const b = allHands[1].landmarks[0];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.12) return 0.9; // palms close (normalized)
    }
    // fallback single-hand: both hands together not detected -> return 0
    return 0;
  }

  detectStop(landmarks, handLabel) {
    // open palm forward approximation:
    // many or all non-thumb fingers extended and fairly spread
    const fingers = [8, 12, 16, 20];
    const extendedCount = fingers.reduce(
      (acc, idx) =>
        acc + (this.isFingerExtended(landmarks, idx, handLabel) ? 1 : 0),
      0
    );
    const thumbClosed = !this.isFingerExtended(landmarks, 4, handLabel);
    // check spread between index & middle & ring
    const indexTip = landmarks[8],
      middleTip = landmarks[12],
      ringTip = landmarks[16];
    const indexMiddleDist = Math.hypot(
      indexTip.x - middleTip.x,
      indexTip.y - middleTip.y
    );
    const middleRingDist = Math.hypot(
      middleTip.x - ringTip.x,
      middleTip.y - ringTip.y
    );
    if (
      extendedCount >= 3 &&
      thumbClosed &&
      indexMiddleDist > 0.06 &&
      middleRingDist > 0.05
    )
      return 0.9;
    return 0;
  }

  detectQuestion(landmarks, handLabel) {
    // index extended, other fingers closed
    const indexExtended = this.isFingerExtended(landmarks, 8, handLabel);
    const othersClosed =
      !this.isFingerExtended(landmarks, 12, handLabel) &&
      !this.isFingerExtended(landmarks, 16, handLabel) &&
      !this.isFingerExtended(landmarks, 20, handLabel) &&
      !this.isFingerExtended(landmarks, 4, handLabel);
    if (indexExtended && othersClosed) {
      // ensure index is significantly higher
      const indexY = landmarks[8].y;
      const avgOthersY =
        (landmarks[12].y + landmarks[16].y + landmarks[20].y + landmarks[4].y) /
        4;
      if (indexY < avgOthersY - 0.06) return 0.95;
    }
    return 0;
  }

  detectHelp(landmarks, handLabel, ctx) {
    // prefer two-hands up; fallback: this single hand raised above some vertical threshold
    const allHands = ctx && ctx.allHands ? ctx.allHands : null;
    if (allHands && allHands.length >= 2) {
      // both wrists above mid-screen (y small)
      const w0 = allHands[0].landmarks[0],
        w1 = allHands[1].landmarks[0];
      if (w0.y < 0.45 && w1.y < 0.45) return 0.9;
    } else {
      // single hand: check wrist higher than index base -> raised
      const wrist = landmarks[0],
        mid = landmarks[9]; // center of palm
      if (wrist.y < mid.y - 0.03) return 0.6;
    }
    return 0;
  }

  detectWait(landmarks, handLabel) {
    // one hand up and palm out = index extended + palm forward
    const indexExtended = this.isFingerExtended(landmarks, 8, handLabel);
    const palmCenter = landmarks[9];
    const wrist = landmarks[0];
    if (indexExtended && wrist.y < palmCenter.y - 0.02) return 0.7;
    return 0;
  }

  detectGo(landmarks, handLabel) {
    // pointing = index extended and other fingers closed, and index is pointing out (x distance from palm)
    if (
      this.isFingerExtended(landmarks, 8, handLabel) &&
      !this.isFingerExtended(landmarks, 12, handLabel)
    ) {
      const palm = landmarks[0];
      const indexTip = landmarks[8];
      const dx = Math.abs(indexTip.x - palm.x);
      if (dx > 0.08) return 0.8;
    }
    return 0;
  }

  detectPlease(landmarks, handLabel, ctx) {
    // circular rubbing motion: check centroid movement forms circular-ish path
    const idx = ctx && ctx.handIndex !== undefined ? ctx.handIndex : 0;
    const history = this.handHistories[idx] || [];
    if (history.length < 8) return 0;
    // compute centroid of palm (use landmarks 0 and 9 averaged) for each frame
    const centroids = history.map((fr) => {
      const a = fr[0],
        b = fr[9];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    });
    // compute bounding box & movement magnitude
    const xs = centroids.map((c) => c.x),
      ys = centroids.map((c) => c.y);
    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);
    // require small but nonzero movement in both axes (circular)
    if (xRange > 0.02 && xRange < 0.12 && yRange > 0.02 && yRange < 0.12)
      return 0.6;
    return 0;
  }

  // Utility methods
  toggleLandmarks() {
    this.showLandmarks = !this.showLandmarks;
    if (!this.showLandmarks && this.ctx && this.canvas)
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  setGestureCooldown(ms) {
    this.gestureCooldown = ms;
  }
  updateSensitivity(newSensitivity) {
    this.sensitivity = newSensitivity;
    if (this.hands)
      this.hands.setOptions({ minDetectionConfidence: this.sensitivity });
  }
  getGestureHistory() {
    return [...this.gestureHistory];
  }
  clearGestureHistory() {
    this.gestureHistory = [];
  }

  emit(event, data) {
    const customEvent = new CustomEvent(`gesture-recognizer:${event}`, {
      detail: data,
    });
    window.dispatchEvent(customEvent);
  }
}
