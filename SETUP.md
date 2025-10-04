# 🚀 SignSpeak Setup Guide

This guide will help you set up SignSpeak on your system for development or production use.

## 📋 System Requirements

### Minimum Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Node.js**: Version 16.0 or higher
- **npm**: Version 8.0 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space
- **Internet**: Stable connection for real-time processing

### Browser Requirements

- **Chrome**: Version 88+ (recommended)
- **Edge**: Version 88+
- **Firefox**: Version 85+ (limited extension support)
- **Safari**: Version 14+ (web app only)

### Hardware Requirements

- **Camera**: Built-in or USB webcam (720p minimum)
- **Microphone**: Built-in or USB microphone
- **Audio Output**: Speakers or headphones
- **Internet**: Broadband connection (5 Mbps minimum)

## 🔧 Installation Steps

### Step 1: Install Node.js and npm

#### Windows

1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Run the installer and follow the setup wizard
3. Verify installation:
   ```cmd
   node --version
   npm --version
   ```

#### macOS

1. Install using Homebrew:
   ```bash
   brew install node
   ```
2. Or download from [nodejs.org](https://nodejs.org/)
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

#### Linux (Ubuntu/Debian)

1. Update package index:
   ```bash
   sudo apt update
   ```
2. Install Node.js:
   ```bash
   sudo apt install nodejs npm
   ```
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

### Step 2: Clone and Setup Project

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-username/signspeak.git
   cd signspeak
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Verify installation**:
   ```bash
   npm list --depth=0
   ```

### Step 3: Configure Environment

1. **Create environment file**:

   ```bash
   cp .env.example .env
   ```

2. **Edit configuration** (optional):
   ```bash
   # .env file
   PORT=3000
   NODE_ENV=development
   SOCKET_IO_CORS_ORIGIN=http://localhost:3000
   ENABLE_GESTURE_RECOGNITION=true
   ENABLE_SPEECH_SYNTHESIS=true
   ```

### Step 4: Start the Application

1. **Development mode**:

   ```bash
   npm run dev
   ```

2. **Production mode**:

   ```bash
   npm start
   ```

3. **Access the application**:
   Open your browser and go to `http://localhost:3000`

## 🌐 Browser Extension Setup

### Chrome/Edge Extension

1. **Load the extension**:

   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extension` folder from the project directory

2. **Grant permissions**:

   - Click "Details" on the SignSpeak extension
   - Ensure all required permissions are enabled:
     - Camera access
     - Microphone access
     - Access to meeting platforms

3. **Verify installation**:
   - You should see the SignSpeak icon in your browser toolbar
   - The icon should show a meeting indicator when on supported platforms

### Firefox Extension (Limited Support)

1. **Load the extension**:

   - Open Firefox and go to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select `extension/manifest.json`

2. **Note**: Firefox has limited support for some Chrome extension APIs

## 🔐 Permissions Setup

### Camera and Microphone Access

1. **Browser permissions**:

   - Allow camera and microphone access when prompted
   - Ensure permissions are granted for localhost and meeting platforms

2. **System permissions** (macOS):

   - Go to System Preferences > Security & Privacy > Privacy
   - Grant camera and microphone access to your browser

3. **System permissions** (Windows):
   - Go to Settings > Privacy > Camera/Microphone
   - Allow apps to access camera and microphone

### Meeting Platform Access

Ensure your browser has access to:

- `https://zoom.us/*`
- `https://*.zoom.us/*`
- `https://meet.google.com/*`
- `https://teams.microsoft.com/*`
- `https://webex.com/*`

## 🧪 Testing the Installation

### Basic Functionality Test

1. **Open the web application**:

   ```
   http://localhost:3000
   ```

2. **Test speech recognition**:

   - Click "Start Listening" in the Speech to Sign tab
   - Speak a few words
   - Verify the animated avatar responds with gestures

3. **Test gesture recognition**:

   - Click "Start Gesture Recognition" in the Sign to Speech tab
   - Make basic gestures (wave, thumbs up, etc.)
   - Verify speech synthesis responds

4. **Test meeting integration**:
   - Join a test meeting on Zoom/Meet
   - Click the SignSpeak extension icon
   - Verify the overlay appears and functions correctly

### Troubleshooting Common Issues

#### Issue: "Speech recognition not supported"

**Solution**:

- Ensure you're using a supported browser (Chrome/Edge recommended)
- Check that you're accessing via HTTPS (required for speech recognition)
- Verify microphone permissions are granted

#### Issue: "Camera access denied"

**Solution**:

- Check browser permissions for camera access
- Verify system-level camera permissions
- Ensure no other applications are using the camera

#### Issue: "Extension not working in meetings"

**Solution**:

- Verify the extension is enabled and has all required permissions
- Check that you're on a supported meeting platform
- Try refreshing the meeting page after installing the extension

#### Issue: "Socket connection failed"

**Solution**:

- Ensure the server is running on port 3000
- Check firewall settings
- Verify no other applications are using port 3000

## 🔧 Development Setup

### For Developers

1. **Install development dependencies**:

   ```bash
   npm install --save-dev
   ```

2. **Start development server with hot reload**:

   ```bash
   npm run dev
   ```

3. **Run tests**:

   ```bash
   npm test
   ```

4. **Lint code**:
   ```bash
   npm run lint
   ```

### IDE Configuration

#### VS Code

1. Install recommended extensions:

   - ES6 code snippets
   - JavaScript (ES6) code snippets
   - Live Server
   - Prettier

2. Configure settings:
   ```json
   {
     "editor.formatOnSave": true,
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     }
   }
   ```

#### WebStorm

1. Enable ESLint integration
2. Configure Node.js interpreter
3. Set up run configurations for development server

## 🚀 Production Deployment

### Server Deployment

1. **Build the application**:

   ```bash
   npm run build
   ```

2. **Set environment variables**:

   ```bash
   export NODE_ENV=production
   export PORT=3000
   ```

3. **Start production server**:
   ```bash
   npm start
   ```

### Docker Deployment

1. **Build Docker image**:

   ```bash
   docker build -t signspeak .
   ```

2. **Run container**:
   ```bash
   docker run -p 3000:3000 signspeak
   ```

### Cloud Deployment

#### Heroku

1. **Install Heroku CLI**
2. **Create Heroku app**:
   ```bash
   heroku create your-signspeak-app
   ```
3. **Deploy**:
   ```bash
   git push heroku main
   ```

#### AWS/Azure/GCP

1. Set up Node.js hosting
2. Configure environment variables
3. Deploy using your preferred method

## 📱 Mobile Setup (Future)

_Note: Mobile support is planned for future versions_

### Android

- Progressive Web App (PWA) support
- Native app development planned

### iOS

- Safari PWA support
- Native app development planned

## 🔄 Updates and Maintenance

### Updating SignSpeak

1. **Pull latest changes**:

   ```bash
   git pull origin main
   ```

2. **Update dependencies**:

   ```bash
   npm update
   ```

3. **Restart the application**:
   ```bash
   npm restart
   ```

### Extension Updates

1. **Chrome Web Store**: Automatic updates
2. **Manual updates**: Reload unpacked extension

### Backup and Recovery

1. **Backup settings**:

   ```bash
   cp ~/.signspeak/settings.json ./backup/
   ```

2. **Restore settings**:
   ```bash
   cp ./backup/settings.json ~/.signspeak/
   ```

## 📞 Getting Help

### Support Channels

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check the full documentation
- **Community**: Join our Discord server
- **Email**: support@signspeak.app

### Common Questions

**Q: Can I use SignSpeak offline?**
A: Basic functionality works offline, but real-time features require internet connection.

**Q: Which sign languages are supported?**
A: Currently supports ASL, BSL, and LSF with more languages planned.

**Q: Is my data secure?**
A: Yes, all processing happens locally in your browser. No speech or video data is sent to external servers.

**Q: Can I customize gestures?**
A: Yes, you can add custom gestures through the settings panel.

---

## ✅ Installation Checklist

- [ ] Node.js 16+ installed
- [ ] npm 8+ installed
- [ ] Project cloned and dependencies installed
- [ ] Server running on localhost:3000
- [ ] Browser extension loaded and configured
- [ ] Camera and microphone permissions granted
- [ ] Basic functionality tested
- [ ] Meeting platform integration tested

**🎉 Congratulations! You're ready to use SignSpeak!**

For more detailed information, check out the [Full Documentation](README.md) and [API Reference](docs/api.md).
