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

    // Calibration + adaptive classifier state
    this.calibrationMode = false;
    this.currentCalibrationLabel = null;
    this.calibrationCounters = { collected: 0, target: 0 };
    this.calibrationOptions = {
      captureInterval: 120, // ms between captured frames
      targetSamples: 60,
      autoTrain: true,
    };
    this.lastCalibrationCaptureTime = 0;
    this.calibrationSamples = {
      handshape: {},
      orientation: {},
      location: {},
    };
    this.maxCalibrationSamplesPerLabel = 180;
    this.classifiers = {
      handshape: null,
      orientation: null,
      location: null,
    };
    this.modelConfidenceThreshold = 0.6;

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
    this.restoreModels();
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

      if (this.calibrationMode && this.currentCalibrationLabel) {
        this.captureCalibrationSample({
          label: this.currentCalibrationLabel,
          landmarks: hand.landmarks,
          handLabel: hand.label,
          handIndex: i,
          allHands,
        });
      }

      this.analyzeHandGesture(hand.landmarks, hand.label, allHands, i);
    });

    // If no hands detected, optionally clear histories
    if (allHands.length === 0) this.handHistories = {};
  }

  analyzeHandGesture(landmarks, handLabel, allHands, handIndex) {
    let bestMatch = null;
    let bestConfidence = 0;

    const featurePacket = this.buildFeaturePacket(
      landmarks,
      handLabel,
      allHands,
      handIndex
    );

    const mlPrediction = featurePacket
      ? this.predictWithTrainedModels(featurePacket)
      : null;

    if (
      mlPrediction &&
      mlPrediction.confidence >= this.modelConfidenceThreshold
    ) {
      bestMatch = mlPrediction.label;
      bestConfidence = mlPrediction.confidence;
    }

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
      } else if (
        mlPrediction &&
        gestureName === mlPrediction.label &&
        confidence >= gestureData.confidence
      ) {
        const blended = (confidence + mlPrediction.confidence) / 2;
        if (blended > bestConfidence) {
          bestMatch = gestureName;
          bestConfidence = blended;
        }
      }
    }

    if (!bestMatch && mlPrediction) {
      bestMatch = mlPrediction.label;
      bestConfidence = mlPrediction.confidence;
    } else if (
      mlPrediction &&
      mlPrediction.label !== bestMatch &&
      mlPrediction.confidence >= this.modelConfidenceThreshold &&
      bestConfidence < this.modelConfidenceThreshold
    ) {
      bestMatch = mlPrediction.label;
      bestConfidence = Math.max(mlPrediction.confidence, bestConfidence);
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

  // Calibration controls --------------------------------------------------

  startCalibration(label, options = {}) {
    if (!label) return;

    this.calibrationMode = true;
    this.currentCalibrationLabel = label;
    const target =
      options.targetSamples ?? options.target ?? this.calibrationOptions.targetSamples;
    this.calibrationOptions = {
      ...this.calibrationOptions,
      ...options,
      targetSamples: target,
    };
    this.calibrationCounters = {
      collected: 0,
      target,
    };
    this.lastCalibrationCaptureTime = 0;

    this.emit("calibration-started", {
      label,
      options: this.calibrationOptions,
    });
  }

  stopCalibration({ train } = {}) {
    if (!this.calibrationMode) return;

    const label = this.currentCalibrationLabel;
    const shouldTrain =
      typeof train === "boolean" ? train : this.calibrationOptions.autoTrain;

    this.calibrationMode = false;
    this.currentCalibrationLabel = null;

    this.emit("calibration-stopped", {
      label,
      samples: this.calibrationCounters.collected,
      trained: shouldTrain,
    });

    let summary = null;
    if (shouldTrain) {
      summary = this.trainModels();
    }

    this.persistModels();

    if (summary) {
      this.emit("calibration-trained", summary);
    }
  }

  cancelCalibration() {
    if (!this.calibrationMode) return;
    this.stopCalibration({ train: false });
  }

  isCalibrating() {
    return this.calibrationMode;
  }

  captureCalibrationSample({
    label,
    landmarks,
    handLabel,
    handIndex = 0,
    allHands = [],
  }) {
    if (!this.calibrationMode || !label || !landmarks) return;

    const now = Date.now();
    const interval = this.calibrationOptions.captureInterval ?? 120;
    if (now - this.lastCalibrationCaptureTime < interval) return;

    const packet = this.buildFeaturePacket(landmarks, handLabel, allHands, handIndex);
    if (!packet) return;

    this.appendCalibrationSample(
      this.calibrationSamples.handshape,
      label,
      packet.handshape
    );
    this.appendCalibrationSample(
      this.calibrationSamples.orientation,
      label,
      packet.orientation
    );
    this.appendCalibrationSample(
      this.calibrationSamples.location,
      label,
      packet.location
    );

    this.calibrationCounters.collected += 1;
    this.lastCalibrationCaptureTime = now;

    this.emit("calibration-progress", {
      label,
      collected: this.calibrationCounters.collected,
      target: this.calibrationCounters.target,
    });

    // Persist calibration samples periodically
    if (this.calibrationCounters.collected % 10 === 0) {
      this.persistModels();
    }

    if (
      this.calibrationCounters.target &&
      this.calibrationCounters.collected >= this.calibrationCounters.target
    ) {
      this.stopCalibration({});
    }
  }

  appendCalibrationSample(store, label, features) {
    if (!store || !label || !Array.isArray(features)) return;
    if (features.some((value) => !Number.isFinite(value))) return;

    if (!store[label]) store[label] = [];
    store[label].push(features);

    if (store[label].length > this.maxCalibrationSamplesPerLabel) {
      store[label].shift();
    }
  }

  buildFeaturePacket(landmarks, handLabel, allHands, handIndex) {
    if (!landmarks || landmarks.length < 21) return null;

    return {
      handshape: this.computeHandshapeFeatures(landmarks, handLabel),
      orientation: this.computeOrientationFeatures(landmarks, handLabel),
      location: this.computeLocationFeatures(
        landmarks,
        handLabel,
        allHands,
        handIndex
      ),
    };
  }

  computeHandshapeFeatures(landmarks, handLabel) {
    const fingerConfigs = [
      { indices: [1, 2, 3, 4], tip: 4, mcp: 2 },
      { indices: [5, 6, 7, 8], tip: 8, mcp: 5 },
      { indices: [9, 10, 11, 12], tip: 12, mcp: 9 },
      { indices: [13, 14, 15, 16], tip: 16, mcp: 13 },
      { indices: [17, 18, 19, 20], tip: 20, mcp: 17 },
    ];

    const palmCenter = this.computePalmCenter(landmarks);
    const scale = this.computeHandScale(landmarks);
    const features = [];

    fingerConfigs.forEach(({ indices, tip, mcp }) => {
      const extended = this.isFingerExtended(landmarks, tip, handLabel) ? 1 : 0;
      const curl = this.computeFingerCurl(landmarks, indices);
      const tipPoint = landmarks[tip];
      const basePoint = landmarks[mcp];
      const distPalm = this.distanceBetweenPoints(tipPoint, palmCenter) / scale;
      const distBase = this.distanceBetweenPoints(basePoint, palmCenter) / scale;

      features.push(this.clampNumber(extended, 0, 1));
      features.push(this.clampNumber(curl, 0, 1));
      features.push(this.clampNumber(distPalm));
      features.push(this.clampNumber(distBase));
    });

    const wrist = landmarks[0];
    const indexMCP = landmarks[5];
    const pinkyMCP = landmarks[17];
    const middleTip = landmarks[12];

    const palmWidth = this.distanceBetweenPoints(indexMCP, pinkyMCP) / scale;
    const palmLength = this.distanceBetweenPoints(wrist, middleTip) / scale;
    const fingerSpread =
      this.distanceBetweenPoints(landmarks[8], landmarks[20]) / scale;
    const thumbIndex = this.distanceBetweenPoints(landmarks[4], landmarks[8]) / scale;

    features.push(this.clampNumber(palmWidth));
    features.push(this.clampNumber(palmLength));
    features.push(this.clampNumber(fingerSpread));
    features.push(this.clampNumber(thumbIndex));
    features.push(handLabel === "Left" ? -1 : handLabel === "Right" ? 1 : 0);

    return features;
  }

  computeOrientationFeatures(landmarks, handLabel) {
    const wrist = landmarks[0];
    const indexMCP = landmarks[5];
    const pinkyMCP = landmarks[17];
    const middleTip = landmarks[12];

    const palmNormal = this.normalizeVector(
      this.vectorCross(
        this.vectorSub(indexMCP, wrist),
        this.vectorSub(pinkyMCP, wrist)
      )
    );

    const middleDirection = this.normalizeVector(
      this.vectorSub(middleTip, wrist)
    );

    const yaw = Math.atan2(palmNormal.x, palmNormal.z) / Math.PI;
    const pitch = Math.asin(this.clampNumber(-palmNormal.y, -1, 1)) / (Math.PI / 2);
    const roll = Math.atan2(middleDirection.y, middleDirection.x) / Math.PI;

    return [
      this.clampNumber(palmNormal.x),
      this.clampNumber(palmNormal.y),
      this.clampNumber(palmNormal.z),
      this.clampNumber(yaw),
      this.clampNumber(pitch),
      this.clampNumber(roll),
      this.clampNumber(middleDirection.z),
      handLabel === "Left" ? -1 : handLabel === "Right" ? 1 : 0,
    ];
  }

  computeLocationFeatures(landmarks, handLabel, allHands = [], handIndex = 0) {
    const palmCenter = this.computePalmCenter(landmarks);
    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const scale = this.computeHandScale(landmarks);

    const features = [
      this.clampNumber(palmCenter.x),
      this.clampNumber(palmCenter.y),
      this.clampNumber(palmCenter.z),
      this.clampNumber(wrist.x),
      this.clampNumber(wrist.y),
      this.clampNumber(wrist.z),
      this.clampNumber((indexTip.y - wrist.y) / (scale || 1)),
      this.clampNumber((indexTip.x - wrist.x) / (scale || 1)),
      this.clampNumber((middleTip.z - wrist.z) / (scale || 1)),
      this.clampNumber(scale),
      handLabel === "Left" ? -1 : handLabel === "Right" ? 1 : 0,
    ];

    if (Array.isArray(allHands) && allHands.length > 1) {
      const partnerIndex = handIndex === 0 ? 1 : 0;
      const partner = allHands[partnerIndex]
        ? allHands[partnerIndex].landmarks
        : null;
      if (partner) {
        const partnerCenter = this.computePalmCenter(partner);
        features.push(this.clampNumber(palmCenter.x - partnerCenter.x));
        features.push(this.clampNumber(palmCenter.y - partnerCenter.y));
        features.push(this.clampNumber(palmCenter.z - partnerCenter.z));
      } else {
        features.push(0, 0, 0);
      }
    } else {
      features.push(0, 0, 0);
    }

    return features;
  }

  computePalmCenter(landmarks) {
    const wrist = landmarks[0];
    const indexMCP = landmarks[5];
    const middleMCP = landmarks[9];
    const ringMCP = landmarks[13];

    return {
      x: (wrist.x + indexMCP.x + middleMCP.x + ringMCP.x) / 4,
      y: (wrist.y + indexMCP.y + middleMCP.y + ringMCP.y) / 4,
      z: (wrist.z + indexMCP.z + middleMCP.z + ringMCP.z) / 4,
    };
  }

  computeHandScale(landmarks) {
    const wrist = landmarks[0];
    const middleMCP = landmarks[9];
    const indexMCP = landmarks[5];
    const pinkyMCP = landmarks[17];

    const base = this.distanceBetweenPoints(wrist, middleMCP);
    const span = this.distanceBetweenPoints(indexMCP, pinkyMCP);

    return Math.max(base + span, 1e-3);
  }

  computeFingerCurl(landmarks, indices) {
    if (!indices || indices.length < 4) return 0;
    const [mcpIdx, pipIdx, dipIdx, tipIdx] = indices;

    const mcp = landmarks[mcpIdx];
    const pip = landmarks[pipIdx];
    const dip = landmarks[dipIdx];
    const tip = landmarks[tipIdx];

    const v1 = this.normalizeVector(this.vectorSub(pip, mcp));
    const v2 = this.normalizeVector(this.vectorSub(dip, pip));
    const v3 = this.normalizeVector(this.vectorSub(tip, dip));

    const angle1 = Math.acos(this.clampNumber(this.vectorDot(v1, v2), -1, 1));
    const angle2 = Math.acos(this.clampNumber(this.vectorDot(v2, v3), -1, 1));

    const curl = (angle1 + angle2) / Math.PI;
    return Number.isFinite(curl) ? Math.min(Math.max(curl, 0), 1) : 0;
  }

  // Model training & inference --------------------------------------------

  trainModels() {
    const handshape = this.trainHandshapeModel();
    const orientation = this.trainOrientationModel();
    const location = this.trainLocationModel();

    this.persistModels();

    return {
      handshape,
      orientation,
      location,
    };
  }

  trainHandshapeModel() {
    const dataset = this.flattenSamples(this.calibrationSamples.handshape);
    const summary = {
      type: "handshape",
      samples: dataset.length,
      trained: false,
    };

    const labelCount = new Set(dataset.map((d) => d.label)).size;
    if (dataset.length < 8 || labelCount < 2) {
      summary.reason = "not-enough-samples";
      this.classifiers.handshape = null;
      return summary;
    }

    const model = this.trainSoftmaxClassifier(dataset, {
      maxEpochs: 180,
      learningRate: 0.35,
      l2: 1e-4,
    });

    this.classifiers.handshape = model;
    summary.trained = true;
    summary.labels = model.labels;
    summary.loss = model.finalLoss;
    return summary;
  }

  trainOrientationModel() {
    const dataset = this.flattenSamples(this.calibrationSamples.orientation);
    const summary = {
      type: "orientation",
      samples: dataset.length,
      trained: false,
    };

    const labelCount = new Set(dataset.map((d) => d.label)).size;
    if (dataset.length < 6 || labelCount < 2) {
      summary.reason = "not-enough-samples";
      this.classifiers.orientation = null;
      return summary;
    }

    const model = this.trainSoftmaxClassifier(dataset, {
      maxEpochs: 150,
      learningRate: 0.3,
      l2: 1e-4,
    });

    this.classifiers.orientation = model;
    summary.trained = true;
    summary.labels = model.labels;
    summary.loss = model.finalLoss;
    return summary;
  }

  trainLocationModel() {
    const dataset = this.flattenSamples(this.calibrationSamples.location);
    const summary = {
      type: "location",
      samples: dataset.length,
      trained: false,
    };

    if (dataset.length < 3) {
      summary.reason = "not-enough-samples";
      this.classifiers.location = null;
      return summary;
    }

    const matrix = dataset.map((d) => d.features);
    const { normalized, mean, std } = this.normalizeFeatureMatrix(matrix);

    this.classifiers.location = {
      data: normalized.map((features, idx) => ({
        features,
        label: dataset[idx].label,
      })),
      mean,
      std,
      k: Math.min(5, dataset.length),
    };

    summary.trained = true;
    summary.labels = Array.from(new Set(dataset.map((d) => d.label)));
    return summary;
  }

  flattenSamples(store) {
    if (!store) return [];
    const entries = [];
    Object.entries(store).forEach(([label, samples]) => {
      (samples || []).forEach((features) => {
        entries.push({ label, features });
      });
    });
    return entries;
  }

  predictWithTrainedModels(packet) {
    if (!packet) return null;

    const contributions = [];

    if (this.classifiers.handshape && packet.handshape) {
      const prediction = this.predictSoftmax(
        this.classifiers.handshape,
        packet.handshape
      );
      if (prediction) contributions.push({ source: "handshape", ...prediction });
    }

    if (this.classifiers.orientation && packet.orientation) {
      const prediction = this.predictSoftmax(
        this.classifiers.orientation,
        packet.orientation
      );
      if (prediction)
        contributions.push({ source: "orientation", ...prediction });
    }

    if (this.classifiers.location && packet.location) {
      const prediction = this.predictLocationModel(
        this.classifiers.location,
        packet.location
      );
      if (prediction) contributions.push({ source: "location", ...prediction });
    }

    if (!contributions.length) return null;

    const labelScores = new Map();

    contributions.forEach(({ label, confidence, source }) => {
      const weight = source === "location" ? 0.9 : 1;
      const existing = labelScores.get(label) || { score: 0, weight: 0 };
      existing.score += confidence * weight;
      existing.weight += weight;
      labelScores.set(label, existing);
    });

    let bestLabel = null;
    let bestScore = -Infinity;
    labelScores.forEach((value, label) => {
      const avg = value.score / Math.max(value.weight, 1e-6);
      if (avg > bestScore) {
        bestScore = avg;
        bestLabel = label;
      }
    });

    return {
      label: bestLabel,
      confidence: this.clampNumber(bestScore, 0, 1),
      breakdown: contributions,
    };
  }

  predictSoftmax(model, features) {
    if (!model || !Array.isArray(features)) return null;
    const normalized = this.applyNormalization(
      features,
      model.featureMean,
      model.featureStd
    );

    const logits = model.weights.map((weights, idx) =>
      this.dotProduct(weights, normalized) + model.biases[idx]
    );

    const probabilities = this.softmax(logits);
    let bestIndex = 0;
    for (let i = 1; i < probabilities.length; i++) {
      if (probabilities[i] > probabilities[bestIndex]) bestIndex = i;
    }

    const probsByLabel = {};
    model.labels.forEach((label, idx) => {
      probsByLabel[label] = probabilities[idx];
    });

    return {
      label: model.labels[bestIndex],
      confidence: probabilities[bestIndex],
      probabilities: probsByLabel,
    };
  }

  predictLocationModel(model, features) {
    if (!model || !Array.isArray(features) || !model.data.length) return null;

    const normalized = this.applyNormalization(features, model.mean, model.std);
    const distances = model.data
      .map((sample) => ({
        label: sample.label,
        distance: this.euclideanDistance(sample.features, normalized),
      }))
      .sort((a, b) => a.distance - b.distance);

    const k = Math.min(model.k || 3, distances.length);
    const tally = new Map();
    let totalWeight = 0;

    for (let i = 0; i < k; i++) {
      const neighbour = distances[i];
      const weight = 1 / (neighbour.distance + 1e-3);
      totalWeight += weight;
      tally.set(neighbour.label, (tally.get(neighbour.label) || 0) + weight);
    }

    let bestLabel = null;
    let bestWeight = -Infinity;
    tally.forEach((weight, label) => {
      if (weight > bestWeight) {
        bestWeight = weight;
        bestLabel = label;
      }
    });

    return {
      label: bestLabel,
      confidence:
        totalWeight > 0
          ? this.clampNumber(bestWeight / totalWeight, 0, 1)
          : 0.5,
      neighbours: distances.slice(0, k),
    };
  }

  trainSoftmaxClassifier(dataset, options = {}) {
    const featureMatrix = dataset.map((d) => d.features);
    if (!featureMatrix.length || !featureMatrix[0]?.length) {
      return {
        type: "softmax",
        labels: [],
        weights: [],
        biases: [],
        featureMean: [],
        featureStd: [],
        finalLoss: 0,
        iterations: 0,
      };
    }
    const { normalized, mean, std } = this.normalizeFeatureMatrix(featureMatrix);

    const labels = Array.from(new Set(dataset.map((d) => d.label)));
    const labelToIndex = new Map(labels.map((label, idx) => [label, idx]));
    const classCount = labels.length;
    const featureCount = normalized[0].length;

    const learningRate = options.learningRate || 0.3;
    const maxEpochs = options.maxEpochs || 150;
    const l2 = options.l2 || 0;

    let weights = Array.from({ length: classCount }, () =>
      Array(featureCount).fill(0)
    );
    let biases = Array(classCount).fill(0);

    let finalLoss = 0;
    const sampleCount = normalized.length;

    for (let epoch = 0; epoch < maxEpochs; epoch++) {
      const gradW = Array.from({ length: classCount }, () =>
        Array(featureCount).fill(0)
      );
      const gradB = Array(classCount).fill(0);
      let epochLoss = 0;

      normalized.forEach((features, idx) => {
        const label = dataset[idx].label;
        const targetIndex = labelToIndex.get(label);

        const logits = weights.map((row, rowIdx) =>
          this.dotProduct(row, features) + biases[rowIdx]
        );
        const probs = this.softmax(logits);

        epochLoss += -Math.log(probs[targetIndex] + 1e-9);

        for (let classIdx = 0; classIdx < classCount; classIdx++) {
          const indicator = classIdx === targetIndex ? 1 : 0;
          const error = probs[classIdx] - indicator;

          for (let f = 0; f < featureCount; f++) {
            gradW[classIdx][f] += error * features[f];
          }
          gradB[classIdx] += error;
        }
      });

      const scale = 1 / sampleCount;
      for (let classIdx = 0; classIdx < classCount; classIdx++) {
        for (let f = 0; f < featureCount; f++) {
          const regularized =
            gradW[classIdx][f] * scale + l2 * weights[classIdx][f];
          weights[classIdx][f] -= learningRate * regularized;
        }
        biases[classIdx] -= learningRate * (gradB[classIdx] * scale);
      }

      finalLoss = epochLoss * scale;
      if (finalLoss < 1e-4) break;
    }

    return {
      type: "softmax",
      labels,
      weights,
      biases,
      featureMean: mean,
      featureStd: std,
      finalLoss,
      iterations: maxEpochs,
    };
  }

  normalizeFeatureMatrix(matrix) {
    if (!matrix.length) return { normalized: [], mean: [], std: [] };
    const featureCount = matrix[0].length;
    const mean = Array(featureCount).fill(0);
    const std = Array(featureCount).fill(0);

    matrix.forEach((vector) => {
      vector.forEach((value, idx) => {
        mean[idx] += value;
      });
    });

    for (let i = 0; i < featureCount; i++) {
      mean[i] /= matrix.length;
    }

    matrix.forEach((vector) => {
      vector.forEach((value, idx) => {
        const diff = value - mean[idx];
        std[idx] += diff * diff;
      });
    });

    for (let i = 0; i < featureCount; i++) {
      std[i] = Math.sqrt(std[i] / matrix.length) || 1;
    }

    const normalized = matrix.map((vector) =>
      vector.map((value, idx) => (value - mean[idx]) / std[idx])
    );

    return { normalized, mean, std };
  }

  applyNormalization(vector, mean, std) {
    if (!mean || !std || !vector) return vector || [];
    return vector.map((value, idx) => {
      const mu = mean[idx] ?? 0;
      const sigma = std[idx] ?? 1;
      return (value - mu) / (sigma || 1);
    });
  }

  dotProduct(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length && i < b.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length && i < b.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  softmax(values) {
    const max = Math.max(...values);
    const exps = values.map((value) => Math.exp(value - max));
    const sum = exps.reduce((acc, value) => acc + value, 0) || 1;
    return exps.map((value) => value / sum);
  }

  persistModels() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        "signspeak_gesture_models_v1",
        JSON.stringify(this.classifiers)
      );
      window.localStorage.setItem(
        "signspeak_gesture_calibration_v1",
        JSON.stringify(this.calibrationSamples)
      );
    } catch (error) {
      console.warn("Failed to persist gesture models", error);
    }
  }

  restoreModels() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const savedModels = window.localStorage.getItem(
        "signspeak_gesture_models_v1"
      );
      if (savedModels) {
        const parsed = JSON.parse(savedModels);
        this.classifiers = {
          ...this.classifiers,
          ...parsed,
        };
      }

      const savedSamples = window.localStorage.getItem(
        "signspeak_gesture_calibration_v1"
      );
      if (savedSamples) {
        const parsedSamples = JSON.parse(savedSamples);
        this.calibrationSamples = {
          handshape: parsedSamples.handshape || {},
          orientation: parsedSamples.orientation || {},
          location: parsedSamples.location || {},
        };
      }

      this.emit("calibration-loaded", {
        handshape: Object.keys(this.calibrationSamples.handshape || {}),
        orientation: Object.keys(this.calibrationSamples.orientation || {}),
        location: Object.keys(this.calibrationSamples.location || {}),
      });
    } catch (error) {
      console.warn("Failed to restore gesture models", error);
    }
  }

  clearCalibrationData() {
    this.calibrationSamples = {
      handshape: {},
      orientation: {},
      location: {},
    };
    this.classifiers = {
      handshape: null,
      orientation: null,
      location: null,
    };
    this.persistModels();
  }

  // Vector helpers --------------------------------------------------------

  vectorSub(a, b) {
    return {
      x: (a.x || 0) - (b.x || 0),
      y: (a.y || 0) - (b.y || 0),
      z: (a.z || 0) - (b.z || 0),
    };
  }

  vectorDot(a, b) {
    return (a.x || 0) * (b.x || 0) + (a.y || 0) * (b.y || 0) + (a.z || 0) * (b.z || 0);
  }

  vectorCross(a, b) {
    return {
      x: (a.y || 0) * (b.z || 0) - (a.z || 0) * (b.y || 0),
      y: (a.z || 0) * (b.x || 0) - (a.x || 0) * (b.z || 0),
      z: (a.x || 0) * (b.y || 0) - (a.y || 0) * (b.x || 0),
    };
  }

  vectorLength(v) {
    return Math.sqrt(
      (v.x || 0) * (v.x || 0) +
        (v.y || 0) * (v.y || 0) +
        (v.z || 0) * (v.z || 0)
    );
  }

  normalizeVector(v) {
    const len = this.vectorLength(v);
    if (!len) return { x: 0, y: 0, z: 0 };
    return {
      x: v.x / len,
      y: v.y / len,
      z: v.z / len,
    };
  }

  distanceBetweenPoints(a, b) {
    return Math.sqrt(
      Math.pow((a.x || 0) - (b.x || 0), 2) +
        Math.pow((a.y || 0) - (b.y || 0), 2) +
        Math.pow((a.z || 0) - (b.z || 0), 2)
    );
  }

  clampNumber(value, min = -5, max = 5) {
    if (!Number.isFinite(value)) return 0;
    if (value < min) return min;
    if (value > max) return max;
    return value;
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
