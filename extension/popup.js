class ExtensionPopup {
  constructor() {
    this.isInterpreterActive = false;
    this.currentTab = null;
    this.settings = {
      participantType: "hearing",
      signLanguage: "asl",
      gestureSensitivity: 0.7,
    };

    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.detectMeetingPlatform();
    this.initializeUI();
    this.updateStatus();
  }

  async loadSettings() {
    const result = await chrome.storage.local.get(["interpreterSettings"]);
    if (result.interpreterSettings) {
      this.settings = { ...this.settings, ...result.interpreterSettings };
    }
  }

  async saveSettings() {
    await chrome.storage.local.set({ interpreterSettings: this.settings });
  }

  async detectMeetingPlatform() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      this.currentTab = tab;

      const url = tab.url;
      let platform = "Unknown";

      if (url.includes("zoom.us")) {
        platform = "Zoom";
      } else if (url.includes("meet.google.com")) {
        platform = "Google Meet";
      } else if (url.includes("teams.microsoft.com")) {
        platform = "Microsoft Teams";
      } else if (url.includes("webex.com")) {
        platform = "Cisco Webex";
      }

      document.getElementById("meetingPlatform").textContent = platform;
      document.getElementById("meetingInfo").style.display =
        platform !== "Unknown" ? "block" : "none";
    } catch (error) {
      console.error("Error detecting meeting platform:", error);
    }
  }

  initializeUI() {
    // Load current settings into UI
    document.querySelector(
      `input[name="participantType"][value="${this.settings.participantType}"]`
    ).checked = true;
    document.getElementById("signLanguage").value = this.settings.signLanguage;
    document.getElementById("gestureSensitivity").value =
      this.settings.gestureSensitivity;
    document.getElementById("sensitivityValue").textContent =
      this.settings.gestureSensitivity;

    // Event listeners
    document
      .querySelectorAll('input[name="participantType"]')
      .forEach((radio) => {
        radio.addEventListener("change", (e) => {
          this.settings.participantType = e.target.value;
          this.saveSettings();
        });
      });

    document.getElementById("signLanguage").addEventListener("change", (e) => {
      this.settings.signLanguage = e.target.value;
      this.saveSettings();
    });

    document
      .getElementById("gestureSensitivity")
      .addEventListener("input", (e) => {
        this.settings.gestureSensitivity = parseFloat(e.target.value);
        document.getElementById("sensitivityValue").textContent =
          e.target.value;
        this.saveSettings();
      });

    document
      .getElementById("toggleInterpreter")
      .addEventListener("click", () => {
        this.toggleInterpreter();
      });

    document.getElementById("openSettings").addEventListener("click", () => {
      this.openFullSettings();
    });

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });
  }

  async toggleInterpreter() {
    try {
      if (this.isInterpreterActive) {
        await this.stopInterpreter();
      } else {
        await this.startInterpreter();
      }
    } catch (error) {
      console.error("Error toggling interpreter:", error);
      this.showError("Failed to toggle interpreter");
    }
  }

  async startInterpreter() {
    if (!this.currentTab) {
      this.showError("No active tab found");
      return;
    }

    try {
      // Inject the interpreter overlay
      await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        files: ["overlay.js"],
      });

      // Inject CSS
      await chrome.scripting.insertCSS({
        target: { tabId: this.currentTab.id },
        files: ["overlay.css"],
      });

      // Send start message to content script
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: "startInterpreter",
        settings: this.settings,
      });

      this.isInterpreterActive = true;
      this.updateStatus();
      this.updateToggleButton();
    } catch (error) {
      console.error("Error starting interpreter:", error);
      this.showError(
        "Failed to start interpreter. Make sure you're on a supported meeting platform."
      );
    }
  }

  async stopInterpreter() {
    if (!this.currentTab) return;

    try {
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: "stopInterpreter",
      });

      this.isInterpreterActive = false;
      this.updateStatus();
      this.updateToggleButton();
    } catch (error) {
      console.error("Error stopping interpreter:", error);
    }
  }

  async openFullSettings() {
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL("settings.html"),
      });
    } catch (error) {
      console.error("Error opening settings:", error);
    }
  }

  updateStatus() {
    const statusIndicator = document.getElementById("statusIndicator");
    const statusText = document.getElementById("statusText");
    const interpreterStatus = document.getElementById("interpreterStatus");

    if (this.isInterpreterActive) {
      statusIndicator.classList.add("active");
      statusText.textContent = "Interpreter Active";
      interpreterStatus.textContent = "Active";
    } else {
      statusIndicator.classList.remove("active");
      statusText.textContent = "Interpreter Inactive";
      interpreterStatus.textContent = "Inactive";
    }
  }

  updateToggleButton() {
    const button = document.getElementById("toggleInterpreter");
    const text = document.getElementById("toggleText");

    if (this.isInterpreterActive) {
      text.textContent = "Stop Interpreter";
      button.style.background = "rgba(255, 107, 107, 0.8)";
    } else {
      text.textContent = "Start Interpreter";
      button.style.background = "rgba(255, 255, 255, 0.2)";
    }
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case "updateParticipantCount":
        document.getElementById("participantCount").textContent = message.count;
        break;
      case "interpreterStatusUpdate":
        document.getElementById("interpreterStatus").textContent =
          message.status;
        break;
      case "gestureDetected":
        this.showGestureNotification(message.gesture);
        break;
      case "speechDetected":
        this.showSpeechNotification(message.text);
        break;
    }
  }

  showGestureNotification(gesture) {
    // Create a temporary notification
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(102, 126, 234, 0.9);
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 12px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
    notification.textContent = `Gesture detected: ${gesture}`;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  showSpeechNotification(text) {
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(118, 75, 162, 0.9);
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 12px;
            z-index: 10000;
            max-width: 200px;
            word-wrap: break-word;
        `;
    notification.textContent = `Speech: ${text.substring(0, 50)}${
      text.length > 50 ? "..." : ""
    }`;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  showError(message) {
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(255, 107, 107, 0.9);
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 12px;
            z-index: 10000;
        `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 5000);
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ExtensionPopup();
});
