# 🤟 InSync - Real-time Sign Language Interpreter

> **Bridging Communication Gaps in Video Meetings**

InSync is an innovative real-time sign language to speech interpreter designed specifically for video meetings. It seamlessly translates between sign language and speech, making video conferences accessible for mute participants while enabling them to be included in communication.

## 🌟 Features

### Core Functionality

- **Sign-to-Speech Conversion**: Translates sign language gestures into spoken words
- **Augmented voice of user's choice**: Allows users to customize their desired voices
- **Multi-platform Support**: Works with Zoom, Google Meet, Microsoft Teams, and Cisco Webex
- **Browser Extension**: Seamless integration with video meeting platforms
- **Web Application**: Standalone interpreter for general use

### Advanced Features

- **Gesture Recognition**: Uses MediaPipe for accurate hand gesture detection
- **Speech Synthesis**: Natural-sounding voice output for sign language
- **Real-time Overlay**: Non-intrusive overlay during video meetings
- **Multiple Sign Languages**: Support for ASL, BSL, and LSF
- **Customizable Settings**: Adjustable sensitivity, speech rate, and preferences
- **Accessibility Focus**: Designed with accessibility in mind

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- Modern web browser with camera and microphone access
- WebRTC support for video meeting integration

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/signspeak.git
   cd signspeak
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the server**

   ```bash
   npm start
   ```

4. **Open the application**
   ```
   http://localhost:3000
   ```

### Browser Extension Installation

1. **Load the extension**

   - Open Chrome/Edge and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `extension` folder

2. **Grant permissions**

   - Allow camera and microphone access
   - Enable access to meeting platforms

3. **Start using**
   - Join any supported video meeting
   - Click the SignSpeak extension icon
   - Choose your participant type (hearing/deaf)
   - Start the interpreter

## 🎯 Usage Guide

### For Hearing Participants

1. **Start Speech-to-Sign Mode**

   - Click "Start Listening" in the Speech to Sign tab
   - Speak normally - your speech will be converted to sign language
   - The animated avatar will show sign language gestures

2. **Meeting Integration**
   - Install the browser extension
   - Join your video meeting
   - Click the SignSpeak icon and select "Hearing participant"
   - The interpreter will overlay sign language translations

## 🛠️ Technical Architecture

### Frontend Components

- **React-like Component System**: Modular, reusable components
- **Web Speech API**: Real-time speech recognition and synthesis
- **MediaPipe Integration**: Advanced gesture recognition
- **Socket.io Client**: Real-time communication with backend
- **Progressive Web App**: Offline-capable, installable

### Backend Services

- **Node.js Server**: Express.js with Socket.io
- **Real-time Processing**: WebSocket connections for live translation
- **Gesture Analysis**: ML-based sign language recognition
- **Speech Processing**: Natural language processing for translation

### Browser Extension

- **Content Scripts**: Injection into meeting platforms
- **Background Service**: Persistent connection management
- **Popup Interface**: Quick access controls
- **Overlay System**: Non-intrusive meeting integration

## 📱 Supported Platforms

### Video Meeting Platforms

- ✅ **Zoom** - Full integration with participant detection
- ✅ **Google Meet** - Real-time overlay and gesture recognition
- ✅ **Microsoft Teams** - Complete sign language support
- ✅ **Cisco Webex** - Full accessibility features

### Sign Languages

- ✅ **American Sign Language (ASL)** - Primary support
- ✅ **British Sign Language (BSL)** - Full gesture set
- ✅ **French Sign Language (LSF)** - Basic support
- 🔄 **Additional languages** - Coming soon

### Browsers

- ✅ **Chrome** - Full feature support
- ✅ **Edge** - Complete functionality
- ✅ **Firefox** - Core features (limited extension support)
- ✅ **Safari** - Web app support

## ⚙️ Configuration

### Settings Panel

Access settings through the floating settings button or extension popup:

- **Sign Language**: Choose ASL, BSL, or LSF
- **Speech Rate**: Adjust voice output speed (0.5x - 2.0x)
- **Gesture Sensitivity**: Fine-tune gesture recognition (0.1 - 1.0)
- **Show Subtitles**: Enable/disable subtitle display
- **Auto-start**: Automatically start interpreter when joining meetings

### Advanced Configuration

```javascript
// Custom gesture mapping
const customGestures = {
  custom_gesture: "Custom meaning",
  special_sign: "Special translation",
};

// Speech recognition options
const speechOptions = {
  language: "en-US",
  continuous: true,
  interimResults: true,
};
```

## 🔧 Development

### Project Structure

```
signspeak/
├── public/                 # Static web assets
│   ├── index.html         # Main web application
│   ├── styles.css         # Application styles
│   └── app.js            # Main application logic
├── src/                   # Source code
│   ├── interpreter.js    # Core interpreter logic
│   ├── gesture-recognizer.js  # Gesture recognition
│   ├── speech-processor.js    # Speech processing
│   ├── meeting-integration.js # Meeting platform integration
│   └── styles/
├── extension/             # Browser extension
│   ├── manifest.json     # Extension manifest
│   ├── popup.html        # Extension popup
│   ├── popup.js          # Popup logic
│   ├── content.js        # Content script
│   ├── background.js     # Background service
│   └── content.css       # Extension styles
├── server.js             # Express server
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Start with hot reload
npm run start:dev
```

### Adding New Gestures

1. **Define the gesture pattern** in `gesture-recognizer.js`:

   ```javascript
   detectNewGesture(landmarks) {
       // Add your gesture detection logic
       return confidence; // 0.0 to 1.0
   }
   ```

2. **Add to gesture patterns**:

   ```javascript
   'new_gesture': {
       description: 'Description of the gesture',
       pattern: (landmarks) => this.detectNewGesture(landmarks)
   }
   ```

3. **Update translations**:
   ```javascript
   signToText["new_gesture"] = "Translation";
   textToSign["translation_word"] = "new_gesture";
   ```

## 🧪 Testing

### Manual Testing

1. **Speech Recognition**

   - Test with various accents and speech patterns
   - Verify accuracy in noisy environments
   - Check continuous vs. single-shot recognition

2. **Gesture Recognition**

   - Test all supported gestures
   - Verify accuracy with different hand positions
   - Check sensitivity settings

3. **Meeting Integration**
   - Test on all supported platforms
   - Verify overlay positioning and visibility
   - Check participant detection

### Automated Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

## 🚀 Deployment

### Production Build

```bash
# Build the application
npm run build

# Start production server
NODE_ENV=production npm start
```

### Environment Variables

```bash
# Server configuration
PORT=3000
NODE_ENV=production

# Socket.io configuration
SOCKET_IO_CORS_ORIGIN=https://yourdomain.com

# Feature flags
ENABLE_GESTURE_RECOGNITION=true
ENABLE_SPEECH_SYNTHESIS=true
```

### Extension Deployment

1. **Package the extension**

   ```bash
   cd extension
   zip -r signspeak-extension.zip .
   ```

2. **Submit to Chrome Web Store**
   - Upload the zip file
   - Fill in store listing details
   - Submit for review

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Style

- Use ESLint configuration provided
- Follow JavaScript best practices
- Write meaningful commit messages
- Add tests for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **MediaPipe Team** - For the excellent hand gesture recognition library
- **Web Speech API** - For browser-based speech recognition
- **Socket.io** - For real-time communication
- **Deaf Community** - For feedback and testing
- **Accessibility Advocates** - For guidance on inclusive design

## 📞 Support

- **Documentation**: [Full documentation](docs/)
- **Issues**: [GitHub Issues](https://github.com/your-username/signspeak/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/signspeak/discussions)
- **Email**: support@signspeak.app

## 🎯 Roadmap

### Version 2.0

- [ ] Advanced ML gesture recognition
- [ ] Multi-language speech support
- [ ] Mobile app development
- [ ] Cloud-based processing
- [ ] Enterprise features

### Version 2.1

- [ ] AI-powered gesture learning
- [ ] Real-time translation accuracy improvements
- [ ] Integration with more meeting platforms
- [ ] Offline mode support

### Version 3.0

- [ ] AR/VR integration
- [ ] Neural interface support
- [ ] Advanced accessibility features
- [ ] Multi-user collaboration

---

**Made with ❤️ for the deaf and hard-of-hearing community**

_SignSpeak - Where technology meets accessibility_
