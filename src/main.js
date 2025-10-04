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
}

// Initialize the application when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  window.signSpeakApp = new SignSpeakApp();
});

// Export for potential use in other modules
export { SignSpeakApp };
