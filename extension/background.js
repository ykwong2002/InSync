// Background script for SignSpeak extension

class ExtensionBackground {
  constructor() {
    this.init();
  }

  init() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Handle tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Handle tab activation
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivation(activeInfo);
    });

    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
    });

    // Handle extension icon click
    chrome.action.onClicked.addListener((tab) => {
      this.handleIconClick(tab);
    });
  }

  handleInstallation(details) {
    if (details.reason === "install") {
      console.log("SignSpeak extension installed");

      // Set default settings
      chrome.storage.local.set({
        interpreterSettings: {
          participantType: "hearing",
          signLanguage: "asl",
          gestureSensitivity: 0.7,
          speechRate: 1.0,
          showSubtitles: true,
          autoStart: false,
        },
      });

      // Open welcome page
      chrome.tabs.create({
        url: chrome.runtime.getURL("welcome.html"),
      });
    } else if (details.reason === "update") {
      console.log("SignSpeak extension updated");
    }
  }

  handleTabUpdate(tabId, changeInfo, tab) {
    if (changeInfo.status === "complete" && tab.url) {
      this.updateBadgeForTab(tab);
    }
  }

  handleTabActivation(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      this.updateBadgeForTab(tab);
    });
  }

  updateBadgeForTab(tab) {
    if (!tab.url) return;

    const isMeetingPlatform = this.isMeetingPlatform(tab.url);

    if (isMeetingPlatform) {
      chrome.action.setBadgeText({
        text: "📹",
        tabId: tab.id,
      });
      chrome.action.setBadgeBackgroundColor({
        color: "#667eea",
        tabId: tab.id,
      });
      chrome.action.setTitle({
        title: "SignSpeak - Click to start interpreter",
        tabId: tab.id,
      });
    } else {
      chrome.action.setBadgeText({
        text: "",
        tabId: tab.id,
      });
      chrome.action.setTitle({
        title: "SignSpeak - Real-time Sign Language Interpreter",
        tabId: tab.id,
      });
    }
  }

  isMeetingPlatform(url) {
    const meetingDomains = [
      "zoom.us",
      "meet.google.com",
      "teams.microsoft.com",
      "webex.com",
    ];

    return meetingDomains.some((domain) => url.includes(domain));
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case "getTabInfo":
        chrome.tabs.get(sender.tab.id, (tab) => {
          sendResponse({
            url: tab.url,
            title: tab.title,
            isMeetingPlatform: this.isMeetingPlatform(tab.url),
          });
        });
        return true; // Keep message channel open for async response

      case "showNotification":
        this.showNotification(message.title, message.message);
        sendResponse({ success: true });
        break;

      case "updateBadge":
        chrome.action.setBadgeText({
          text: message.text,
          tabId: sender.tab.id,
        });
        sendResponse({ success: true });
        break;

      case "openInterpreterPage":
        chrome.tabs.create({
          url: chrome.runtime.getURL("interpreter.html"),
        });
        sendResponse({ success: true });
        break;

      case "logEvent":
        console.log("Extension event:", message.event, message.data);
        sendResponse({ success: true });
        break;
    }
  }

  handleIconClick(tab) {
    // Check if it's a meeting platform
    if (this.isMeetingPlatform(tab.url)) {
      // Inject content script if not already present
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        })
        .then(() => {
          // Send message to start interpreter
          chrome.tabs.sendMessage(tab.id, {
            action: "startInterpreter",
            settings: {
              participantType: "hearing",
              signLanguage: "asl",
              gestureSensitivity: 0.7,
            },
          });
        })
        .catch((error) => {
          console.error("Failed to inject content script:", error);
          // Fallback: open popup
          chrome.action.openPopup();
        });
    } else {
      // Open popup for non-meeting pages
      chrome.action.openPopup();
    }
  }

  showNotification(title, message) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: title,
      message: message,
    });
  }

  // Context menu setup
  setupContextMenus() {
    chrome.contextMenus.create({
      id: "signspeak-translate",
      title: "Translate to Sign Language",
      contexts: ["selection"],
      documentUrlPatterns: [
        "https://zoom.us/*",
        "https://*.zoom.us/*",
        "https://meet.google.com/*",
        "https://teams.microsoft.com/*",
        "https://webex.com/*",
        "https://*.webex.com/*",
      ],
    });

    chrome.contextMenus.create({
      id: "signspeak-open",
      title: "Open SignSpeak Interpreter",
      contexts: ["page"],
      documentUrlPatterns: [
        "https://zoom.us/*",
        "https://*.zoom.us/*",
        "https://meet.google.com/*",
        "https://teams.microsoft.com/*",
        "https://webex.com/*",
        "https://*.webex.com/*",
      ],
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  }

  handleContextMenuClick(info, tab) {
    switch (info.menuItemId) {
      case "signspeak-translate":
        chrome.tabs.sendMessage(tab.id, {
          action: "translateSelection",
          text: info.selectionText,
        });
        break;

      case "signspeak-open":
        chrome.tabs.sendMessage(tab.id, {
          action: "startInterpreter",
        });
        break;
    }
  }
}

// Initialize background script
const extensionBackground = new ExtensionBackground();

// Setup context menus when extension starts
chrome.runtime.onStartup.addListener(() => {
  extensionBackground.setupContextMenus();
});

// Clean up on extension shutdown
chrome.runtime.onSuspend.addListener(() => {
  console.log("SignSpeak extension suspended");
});
