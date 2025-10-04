class MeetingIntegration {
    constructor() {
        this.isActive = false;
        this.overlay = null;
        this.settings = {};
        this.socket = null;
        this.recognition = null;
        this.synthesis = null;
        this.hands = null;
        this.camera = null;
        
        this.init();
    }

    init() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });

        // Detect meeting platform
        this.detectPlatform();
        
        // Initialize socket connection
        this.initializeSocket();
    }

    detectPlatform() {
        const url = window.location.href;
        let platform = 'unknown';
        
        if (url.includes('zoom.us')) {
            platform = 'zoom';
        } else if (url.includes('meet.google.com')) {
            platform = 'google-meet';
        } else if (url.includes('teams.microsoft.com')) {
            platform = 'teams';
        } else if (url.includes('webex.com')) {
            platform = 'webex';
        }
        
        this.platform = platform;
        console.log('Detected meeting platform:', platform);
    }

    async initializeSocket() {
        // Connect to the interpreter server
        try {
            this.socket = io('http://localhost:3000');
            
            this.socket.on('connect', () => {
                console.log('Connected to interpreter server');
            });
            
            this.socket.on('sign-animation', (data) => {
                this.displaySignOverlay(data);
            });
            
            this.socket.on('speech-synthesis', (data) => {
                this.synthesizeSpeech(data);
            });
            
        } catch (error) {
            console.error('Failed to connect to interpreter server:', error);
        }
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'startInterpreter':
                this.startInterpreter(message.settings);
                sendResponse({ success: true });
                break;
            case 'stopInterpreter':
                this.stopInterpreter();
                sendResponse({ success: true });
                break;
            case 'updateSettings':
                this.updateSettings(message.settings);
                sendResponse({ success: true });
                break;
        }
    }

    async startInterpreter(settings) {
        if (this.isActive) return;
        
        this.settings = settings;
        this.isActive = true;
        
        try {
            // Create overlay
            await this.createOverlay();
            
            // Initialize speech recognition for hearing participants
            if (settings.participantType === 'hearing') {
                await this.initializeSpeechRecognition();
            }
            
            // Initialize gesture recognition for deaf participants
            if (settings.participantType === 'deaf') {
                await this.initializeGestureRecognition();
            }
            
            // Initialize speech synthesis
            await this.initializeSpeechSynthesis();
            
            // Join meeting room
            this.joinMeetingRoom();
            
            console.log('Interpreter started successfully');
            
        } catch (error) {
            console.error('Failed to start interpreter:', error);
            this.stopInterpreter();
        }
    }

    stopInterpreter() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Stop speech recognition
        if (this.recognition) {
            this.recognition.stop();
            this.recognition = null;
        }
        
        // Stop gesture recognition
        if (this.hands) {
            this.hands.close();
            this.hands = null;
        }
        
        // Remove overlay
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        
        // Leave meeting room
        if (this.socket) {
            this.socket.emit('meeting-leave');
        }
        
        console.log('Interpreter stopped');
    }

    async createOverlay() {
        // Create overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'signspeak-overlay';
        this.overlay.innerHTML = `
            <div class="signspeak-container">
                <div class="signspeak-header">
                    <div class="signspeak-logo">
                        <span>🤟</span>
                        <span>SignSpeak</span>
                    </div>
                    <div class="signspeak-controls">
                        <button id="signspeak-minimize">−</button>
                        <button id="signspeak-close">×</button>
                    </div>
                </div>
                
                <div class="signspeak-content">
                    <div class="signspeak-main">
                        <div class="signspeak-avatar" id="signspeak-avatar">
                            <div class="avatar-head">
                                <div class="avatar-eyes">
                                    <div class="eye left-eye"></div>
                                    <div class="eye right-eye"></div>
                                </div>
                            </div>
                            <div class="avatar-arms">
                                <div class="arm left-arm" id="left-arm"></div>
                                <div class="arm right-arm" id="right-arm"></div>
                            </div>
                        </div>
                        
                        <div class="signspeak-text">
                            <div class="current-sign" id="current-sign">Ready</div>
                            <div class="sign-gloss" id="sign-gloss">Waiting for input...</div>
                        </div>
                    </div>
                    
                    <div class="signspeak-transcript" id="transcript-area">
                        <div class="transcript-text" id="transcript-text"></div>
                    </div>
                    
                    <div class="signspeak-status">
                        <div class="status-indicator" id="status-indicator">
                            <div class="status-dot"></div>
                            <span id="status-text">Connecting...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(this.overlay);
        
        // Add event listeners
        document.getElementById('signspeak-minimize').addEventListener('click', () => {
            this.toggleMinimize();
        });
        
        document.getElementById('signspeak-close').addEventListener('click', () => {
            this.stopInterpreter();
        });
        
        // Make draggable
        this.makeDraggable();
    }

    makeDraggable() {
        const header = this.overlay.querySelector('.signspeak-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                this.overlay.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        }.bind(this);

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }
    }

    toggleMinimize() {
        const content = this.overlay.querySelector('.signspeak-content');
        const minimizeBtn = document.getElementById('signspeak-minimize');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            minimizeBtn.textContent = '−';
        } else {
            content.style.display = 'none';
            minimizeBtn.textContent = '+';
        }
    }

    async initializeSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            throw new Error('Speech recognition not supported');
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            
            if (finalTranscript) {
                this.processSpeech(finalTranscript);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.updateStatus('Speech recognition error', 'error');
        };
        
        this.recognition.start();
        this.updateStatus('Listening for speech...', 'listening');
    }

    async initializeGestureRecognition() {
        // This would integrate with MediaPipe for gesture recognition
        // For now, we'll simulate gesture detection
        this.updateStatus('Recognizing gestures...', 'listening');
        
        // Simulate gesture detection
        setInterval(() => {
            if (this.isActive && this.settings.participantType === 'deaf') {
                // This would be replaced with actual gesture detection
                const gestures = ['hello', 'yes', 'no', 'thank_you'];
                const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
                
                // Simulate occasional gesture detection
                if (Math.random() > 0.95) {
                    this.processGesture(randomGesture);
                }
            }
        }, 1000);
    }

    async initializeSpeechSynthesis() {
        if (!('speechSynthesis' in window)) {
            throw new Error('Speech synthesis not supported');
        }

        this.synthesis = window.speechSynthesis;
        console.log('Speech synthesis initialized');
    }

    processSpeech(transcript) {
        console.log('Processing speech:', transcript);
        
        // Update transcript display
        this.updateTranscript(transcript);
        
        // Send to server for sign language conversion
        if (this.socket) {
            this.socket.emit('speech-to-sign', {
                transcript: transcript,
                confidence: 0.9,
                timestamp: Date.now()
            });
        }
        
        // Notify popup
        chrome.runtime.sendMessage({
            action: 'speechDetected',
            text: transcript
        });
    }

    processGesture(gesture) {
        console.log('Processing gesture:', gesture);
        
        // Send to server for speech conversion
        if (this.socket) {
            this.socket.emit('sign-to-speech', {
                gesture: gesture,
                confidence: 0.8,
                timestamp: Date.now()
            });
        }
        
        // Notify popup
        chrome.runtime.sendMessage({
            action: 'gestureDetected',
            gesture: gesture
        });
    }

    displaySignOverlay(data) {
        const { signs, originalText } = data;
        
        // Update sign display
        const currentSignEl = document.getElementById('current-sign');
        const signGlossEl = document.getElementById('sign-gloss');
        
        if (signs && signs.length > 0) {
            const primarySign = signs[0];
            currentSignEl.textContent = this.getSignSymbol(primarySign.sign);
            signGlossEl.textContent = `${primarySign.sign} (${primarySign.word})`;
            
            // Animate avatar
            this.animateAvatar(primarySign.sign);
        } else {
            currentSignEl.textContent = 'No sign found';
            signGlossEl.textContent = originalText;
        }
    }

    synthesizeSpeech(data) {
        const { text, gesture } = data;
        
        // Create speech synthesis utterance
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.volume = 1;
        
        // Select appropriate voice
        const voices = this.synthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.lang.startsWith('en') && voice.name.includes('Female')
        );
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        
        this.synthesis.speak(utterance);
        
        // Update status
        this.updateStatus(`Speaking: ${text}`, 'speaking');
        
        // Clear status after speech
        setTimeout(() => {
            this.updateStatus('Ready', 'ready');
        }, text.length * 100);
    }

    getSignSymbol(sign) {
        const signSymbols = {
            'hello': '👋',
            'thank_you': '🙏',
            'yes': '👍',
            'no': '👎',
            'please': '🤲',
            'help': '🆘',
            'stop': '✋',
            'go': '👉',
            'wait': '⏳',
            'question': '❓'
        };
        
        return signSymbols[sign] || '🤷';
    }

    animateAvatar(sign) {
        const leftArm = document.getElementById('left-arm');
        const rightArm = document.getElementById('right-arm');
        
        // Remove existing animations
        if (leftArm) leftArm.classList.remove('signing');
        if (rightArm) rightArm.classList.remove('signing');
        
        // Add animation based on sign
        setTimeout(() => {
            if (['hello', 'thank_you', 'stop'].includes(sign)) {
                if (leftArm) leftArm.classList.add('signing');
                if (rightArm) rightArm.classList.add('signing');
            } else if (['yes', 'go'].includes(sign)) {
                if (rightArm) rightArm.classList.add('signing');
            } else if (['no', 'wait'].includes(sign)) {
                if (leftArm) leftArm.classList.add('signing');
            }
        }, 100);
    }

    updateTranscript(text) {
        const transcriptEl = document.getElementById('transcript-text');
        if (transcriptEl) {
            transcriptEl.textContent = text;
        }
    }

    updateStatus(text, type = 'info') {
        const statusText = document.getElementById('status-text');
        const statusDot = this.overlay.querySelector('.status-dot');
        
        if (statusText) {
            statusText.textContent = text;
        }
        
        if (statusDot) {
            statusDot.className = `status-dot ${type}`;
        }
    }

    joinMeetingRoom() {
        if (this.socket) {
            this.socket.emit('meeting-join', {
                meetingId: this.generateMeetingId(),
                participantId: 'extension-user',
                isDeaf: this.settings.participantType === 'deaf'
            });
        }
    }

    generateMeetingId() {
        // Generate a meeting ID based on current URL
        return btoa(window.location.href).substring(0, 10);
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        // Restart interpreter if needed
        if (this.isActive) {
            this.stopInterpreter();
            setTimeout(() => {
                this.startInterpreter(this.settings);
            }, 100);
        }
    }
}

// Initialize when script loads
const meetingIntegration = new MeetingIntegration();
