// Main entry point for the SignSpeak application
import "./styles/main.css";
import { SignLanguageInterpreter } from "./interpreter";
import { MeetingIntegration } from "./meeting-integration";
import { GestureRecognizer } from "./gesture-recognizer";
import { SpeechProcessor } from "./speech-processor";

class SignSpeakApp {
  constructor() {
    this.interpreter = null;
    this.meetingIntegration = null;
    this.gestureRecognizer = null;
    this.speechProcessor = null;
    this.calibrationElements = null;
    this.calibrationEventsBound = false;

    this.init();
  }

  async init() {
    try {
      console.log("Initializing SignSpeak Application...");

      // Initialize core components
      this.speechProcessor = new SpeechProcessor();
      this.gestureRecognizer = new GestureRecognizer();

      // Initialize main interpreter
      this.interpreter = new SignLanguageInterpreter({
        speechProcessor: this.speechProcessor,
        gestureRecognizer: this.gestureRecognizer,
      });

      // Initialize meeting integration
      this.meetingIntegration = new MeetingIntegration(this.interpreter);

      // Set up global error handling
      this.setupErrorHandling();

      // Set up calibration workflow
      this.setupCalibrationUI();

      console.log("SignSpeak Application initialized successfully!");
    } catch (error) {
      console.error("Failed to initialize SignSpeak:", error);
      this.showError(
        "Failed to initialize the application. Please refresh the page."
      );
    }
  }

  setupErrorHandling() {
    window.addEventListener("error", (event) => {
      console.error("Global error:", event.error);
      this.handleError(event.error);
    });

    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason);
      this.handleError(event.reason);
    });
  }

  handleError(error) {
    // Log error to server if available
    if (this.interpreter && this.interpreter.socket) {
      this.interpreter.socket.emit("error-report", {
        error: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      });
    }
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-overlay";
    errorDiv.innerHTML = `
            <div class="error-content">
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="location.reload()">Reload Page</button>
            </div>
        `;
    document.body.appendChild(errorDiv);
  }

  setupCalibrationUI() {
    const elements = {
      labelInput: document.getElementById("calibrationLabel"),
      startBtn: document.getElementById("startCalibrationBtn"),
      stopBtn: document.getElementById("stopCalibrationBtn"),
      cancelBtn: document.getElementById("cancelCalibrationBtn"),
      clearBtn: document.getElementById("clearCalibrationBtn"),
      statusText: document.getElementById("calibrationStatus"),
      progressFill: document.getElementById("calibrationProgress"),
      countText: document.getElementById("calibrationCount"),
    };

    if (!this.gestureRecognizer) {
      return;
    }

    const missingElement = Object.values(elements).some((el) => !el);
    if (missingElement) {
      return;
    }

    this.calibrationElements = elements;

    const defaultTarget =
      this.gestureRecognizer?.calibrationOptions?.targetSamples || 60;

    const updateButtons = (state = "idle") => {
      const { startBtn, stopBtn, cancelBtn, labelInput, clearBtn } =
        this.calibrationElements;
      if (state === "recording") {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        cancelBtn.disabled = false;
        labelInput.disabled = true;
        clearBtn.disabled = true;
      } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        cancelBtn.disabled = true;
        labelInput.disabled = false;
        clearBtn.disabled = false;
      }
    };

    const updateStatus = (text) => {
      if (this.calibrationElements.statusText) {
        this.calibrationElements.statusText.textContent = text;
      }
    };

    const updateProgress = (collected, target) => {
      if (!this.calibrationElements) return;
      const total = target || Math.max(collected, 1);
      const pct = Math.min(100, Math.round((collected / total) * 100));
      this.calibrationElements.countText.textContent = `${collected} / ${
        target || "∞"
      } samples`;
      this.calibrationElements.progressFill.style.width = `${pct}%`;
    };

    elements.startBtn.addEventListener("click", () => {
      const label = (elements.labelInput.value || "").trim();
      if (!label) {
        updateStatus("Enter a gesture label before calibrating");
        elements.labelInput.focus();
        return;
      }

      this.gestureRecognizer.startCalibration(label, {
        targetSamples: defaultTarget,
      });
      updateButtons("recording");
      updateStatus(`Recording samples for "${label}"`);
      updateProgress(0, defaultTarget);
    });

    elements.stopBtn.addEventListener("click", () => {
      this.gestureRecognizer.stopCalibration();
    });

    elements.cancelBtn.addEventListener("click", () => {
      this.gestureRecognizer.cancelCalibration();
      updateButtons();
      updateStatus("Calibration cancelled");
    });

    elements.clearBtn.addEventListener("click", () => {
      this.gestureRecognizer.clearCalibrationData();
      updateButtons();
      updateStatus("Cleared saved models");
      updateProgress(0, defaultTarget);
    });

    if (!this.calibrationEventsBound) {
      window.addEventListener(
        "gesture-recognizer:calibration-started",
        (event) => {
          const { label, options } = event.detail || {};
          updateButtons("recording");
          updateStatus(`Recording samples for "${label || "gesture"}"`);
          updateProgress(0, options?.targetSamples || defaultTarget);
        }
      );

      window.addEventListener(
        "gesture-recognizer:calibration-progress",
        (event) => {
          const { collected = 0, target = defaultTarget } = event.detail || {};
          updateProgress(collected, target);
        }
      );

      window.addEventListener(
        "gesture-recognizer:calibration-stopped",
        (event) => {
          const { label, samples = 0, trained } = event.detail || {};
          updateButtons();
          updateStatus(
            `Captured ${samples} samples for "${label || "gesture"}"${
              trained ? " and retrained" : ""
            }`
          );
        }
      );

      window.addEventListener(
        "gesture-recognizer:calibration-trained",
        (event) => {
          const { handshape, orientation, location } = event.detail || {};
          const trainedTypes = [handshape, orientation, location]
            .filter((model) => model?.trained)
            .map((model) => model.type)
            .join(", ");
          if (trainedTypes) {
            updateStatus(`Models updated for: ${trainedTypes}`);
          }
          updateButtons();
        }
      );

      window.addEventListener(
        "gesture-recognizer:calibration-loaded",
        (event) => {
          const detail = event.detail || {};
          const loadedLabels = new Set([
            ...(detail.handshape || []),
            ...(detail.orientation || []),
            ...(detail.location || []),
          ]);
          if (loadedLabels.size) {
            updateStatus(
              `Loaded ${loadedLabels.size} calibrated gesture${
                loadedLabels.size === 1 ? "" : "s"
              }`
            );
          }
        }
      );

      this.calibrationEventsBound = true;
    }

    updateButtons();
    updateProgress(0, defaultTarget);
    updateStatus("Idle");
  }
}

// Initialize the application when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.signSpeakApp = new SignSpeakApp();
});

// Export for potential use in other modules
export { SignSpeakApp };
