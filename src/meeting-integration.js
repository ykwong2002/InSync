export class MeetingIntegration {
    constructor(interpreter) {
        this.interpreter = interpreter;
        this.isActive = false;
        this.currentMeeting = null;
        this.participants = new Map();
        this.overlay = null;
        this.platform = null;
        
        this.init();
    }

    init() {
        this.detectPlatform();
        this.setupEventListeners();
    }

    detectPlatform() {
        const url = window.location.href;
        
        if (url.includes('zoom.us')) {
            this.platform = 'zoom';
        } else if (url.includes('meet.google.com')) {
            this.platform = 'google-meet';
        } else if (url.includes('teams.microsoft.com')) {
            this.platform = 'teams';
        } else if (url.includes('webex.com')) {
            this.platform = 'webex';
        } else {
            this.platform = 'unknown';
        }
        
        console.log('Detected meeting platform:', this.platform);
    }

    setupEventListeners() {
        // Listen for interpreter events
        if (this.interpreter) {
            window.addEventListener('signspeak:sign-animation', (event) => {
                this.handleSignAnimation(event.detail);
            });
            
            window.addEventListener('signspeak:speech-output', (event) => {
                this.handleSpeechOutput(event.detail);
            });
            
            window.addEventListener('signspeak:transcript-update', (event) => {
                this.handleTranscriptUpdate(event.detail);
            });
        }
    }

    async start(settings = {}) {
        if (this.isActive) return;
        
        this.isActive = true;
        this.currentMeeting = {
            id: this.generateMeetingId(),
            platform: this.platform,
            settings: settings,
            startTime: Date.now()
        };
        
        try {
            // Create overlay
            await this.createOverlay();
            
            // Join meeting room through interpreter
            if (this.interpreter) {
                this.interpreter.joinMeeting({
                    meetingId: this.currentMeeting.id,
                    participantId: this.generateParticipantId(),
                    isDeaf: settings.participantType === 'deaf'
                });
            }
            
            // Set up platform-specific integrations
            this.setupPlatformIntegration();
            
            console.log('Meeting integration started');
            this.emit('integration-started', this.currentMeeting);
            
        } catch (error) {
            console.error('Failed to start meeting integration:', error);
            this.stop();
            throw error;
        }
    }

    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Remove overlay
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        
        // Leave meeting room
        if (this.interpreter) {
            this.interpreter.leaveMeeting();
        }
        
        // Clean up platform-specific integrations
        this.cleanupPlatformIntegration();
        
        console.log('Meeting integration stopped');
        this.emit('integration-stopped');
    }

    async createOverlay() {
        // Create overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'signspeak-meeting-overlay';
        this.overlay.innerHTML = `
            <div class="meeting-overlay-container">
                <div class="overlay-header">
                    <div class="overlay-logo">
                        <span>🤟</span>
                        <span>SignSpeak</span>
                    </div>
                    <div class="overlay-controls">
                        <button id="overlay-minimize" title="Minimize">−</button>
                        <button id="overlay-close" title="Close">×</button>
                    </div>
                </div>
                
                <div class="overlay-content">
                    <div class="sign-display">
                        <div class="sign-avatar" id="meeting-sign-avatar">
                            <div class="avatar-head">
                                <div class="avatar-eyes">
                                    <div class="eye left-eye"></div>
                                    <div class="eye right-eye"></div>
                                </div>
                            </div>
                            <div class="avatar-arms">
                                <div class="arm left-arm" id="meeting-left-arm"></div>
                                <div class="arm right-arm" id="meeting-right-arm"></div>
                            </div>
                        </div>
                        
                        <div class="sign-text">
                            <div class="current-sign" id="meeting-current-sign">Ready</div>
                            <div class="sign-gloss" id="meeting-sign-gloss">Waiting for input...</div>
                        </div>
                    </div>
                    
                    <div class="transcript-display" id="meeting-transcript">
                        <div class="transcript-text" id="meeting-transcript-text"></div>
                    </div>
                    
                    <div class="meeting-status">
                        <div class="status-item">
                            <span class="status-label">Platform:</span>
                            <span class="status-value" id="platform-name">${this.platform}</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Status:</span>
                            <span class="status-value" id="interpreter-status">Active</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        this.addOverlayStyles();
        
        // Add to page
        document.body.appendChild(this.overlay);
        
        // Make draggable
        this.makeOverlayDraggable();
        
        // Add event listeners
        this.setupOverlayEventListeners();
    }

    addOverlayStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #signspeak-meeting-overlay {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 300px;
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                z-index: 999999;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 12px;
                color: #333;
                user-select: none;
            }
            
            .meeting-overlay-container {
                position: relative;
            }
            
            .overlay-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                border-radius: 12px 12px 0 0;
                cursor: move;
                color: white;
            }
            
            .overlay-logo {
                display: flex;
                align-items: center;
                gap: 6px;
                font-weight: 600;
                font-size: 12px;
            }
            
            .overlay-controls {
                display: flex;
                gap: 4px;
            }
            
            .overlay-controls button {
                width: 18px;
                height: 18px;
                border: none;
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border-radius: 50%;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
                transition: background 0.2s ease;
            }
            
            .overlay-controls button:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .overlay-content {
                padding: 12px;
            }
            
            .sign-display {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }
            
            .sign-avatar {
                position: relative;
                width: 40px;
                height: 40px;
                flex-shrink: 0;
            }
            
            .avatar-head {
                width: 20px;
                height: 20px;
                background: #ffd93d;
                border-radius: 50%;
                position: absolute;
                top: 4px;
                left: 50%;
                transform: translateX(-50%);
                border: 1px solid #fff;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
            }
            
            .avatar-eyes {
                position: absolute;
                top: 6px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 4px;
            }
            
            .eye {
                width: 2px;
                height: 2px;
                background: #333;
                border-radius: 50%;
                animation: blink 3s infinite;
            }
            
            .avatar-arms {
                position: absolute;
                top: 24px;
                left: 50%;
                transform: translateX(-50%);
                width: 30px;
                height: 16px;
            }
            
            .arm {
                position: absolute;
                width: 4px;
                height: 12px;
                background: #ffd93d;
                border-radius: 2px;
                border: 1px solid #fff;
                top: 0;
                transition: transform 0.3s ease;
            }
            
            .left-arm {
                left: 4px;
            }
            
            .right-arm {
                right: 4px;
            }
            
            .arm.signing {
                animation: signAnimation 1s ease-in-out;
            }
            
            @keyframes blink {
                0%, 90%, 100% { transform: scaleY(1); }
                95% { transform: scaleY(0.1); }
            }
            
            @keyframes signAnimation {
                0%, 100% { transform: rotate(0deg); }
                50% { transform: rotate(10deg); }
            }
            
            .sign-text {
                flex: 1;
            }
            
            .current-sign {
                font-size: 16px;
                font-weight: 700;
                color: #667eea;
                margin-bottom: 2px;
                min-height: 20px;
                display: flex;
                align-items: center;
            }
            
            .sign-gloss {
                font-size: 10px;
                color: #666;
                font-weight: 500;
            }
            
            .transcript-display {
                background: rgba(102, 126, 234, 0.05);
                border: 1px solid rgba(102, 126, 234, 0.1);
                border-radius: 6px;
                padding: 8px;
                margin-bottom: 8px;
                min-height: 30px;
            }
            
            .transcript-text {
                font-size: 10px;
                line-height: 1.3;
                color: #555;
            }
            
            .meeting-status {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .status-item {
                display: flex;
                justify-content: space-between;
                font-size: 10px;
            }
            
            .status-label {
                color: #666;
                font-weight: 500;
            }
            
            .status-value {
                color: #333;
                font-weight: 600;
            }
            
            .status-value.active {
                color: #51cf66;
            }
            
            .status-value.error {
                color: #ff6b6b;
            }
        `;
        
        document.head.appendChild(style);
    }

    makeOverlayDraggable() {
        const header = this.overlay.querySelector('.overlay-header');
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

    setupOverlayEventListeners() {
        // Minimize button
        const minimizeBtn = document.getElementById('overlay-minimize');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                this.toggleMinimize();
            });
        }
        
        // Close button
        const closeBtn = document.getElementById('overlay-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.stop();
            });
        }
    }

    toggleMinimize() {
        const content = this.overlay.querySelector('.overlay-content');
        const minimizeBtn = document.getElementById('overlay-minimize');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            minimizeBtn.textContent = '−';
        } else {
            content.style.display = 'none';
            minimizeBtn.textContent = '+';
        }
    }

    setupPlatformIntegration() {
        switch (this.platform) {
            case 'zoom':
                this.setupZoomIntegration();
                break;
            case 'google-meet':
                this.setupGoogleMeetIntegration();
                break;
            case 'teams':
                this.setupTeamsIntegration();
                break;
            case 'webex':
                this.setupWebexIntegration();
                break;
            default:
                console.log('No specific platform integration available');
        }
    }

    setupZoomIntegration() {
        // Zoom-specific integration logic
        console.log('Setting up Zoom integration');
        
        // Monitor for participant changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    this.updateParticipantCount();
                }
            });
        });
        
        // Observe participant list changes
        const participantContainer = document.querySelector('[data-testid="participants-list"]') || 
                                   document.querySelector('.participants-list');
        
        if (participantContainer) {
            observer.observe(participantContainer, {
                childList: true,
                subtree: true
            });
        }
    }

    setupGoogleMeetIntegration() {
        // Google Meet-specific integration logic
        console.log('Setting up Google Meet integration');
        
        // Monitor for participant changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    this.updateParticipantCount();
                }
            });
        });
        
        // Observe participant list changes
        const participantContainer = document.querySelector('[data-participant-id]')?.parentElement;
        
        if (participantContainer) {
            observer.observe(participantContainer, {
                childList: true,
                subtree: true
            });
        }
    }

    setupTeamsIntegration() {
        // Teams-specific integration logic
        console.log('Setting up Teams integration');
    }

    setupWebexIntegration() {
        // Webex-specific integration logic
        console.log('Setting up Webex integration');
    }

    cleanupPlatformIntegration() {
        // Clean up any platform-specific observers or listeners
        console.log('Cleaning up platform integration');
    }

    updateParticipantCount() {
        let count = 0;
        
        switch (this.platform) {
            case 'zoom':
                count = document.querySelectorAll('[data-testid="participant"]').length;
                break;
            case 'google-meet':
                count = document.querySelectorAll('[data-participant-id]').length;
                break;
            case 'teams':
                count = document.querySelectorAll('.participant-item').length;
                break;
            case 'webex':
                count = document.querySelectorAll('.participant').length;
                break;
        }
        
        this.participants.set('count', count);
        this.emit('participant-count-updated', count);
    }

    handleSignAnimation(data) {
        const { signs, originalText } = data;
        
        // Update sign display
        const currentSignEl = document.getElementById('meeting-current-sign');
        const signGlossEl = document.getElementById('meeting-sign-gloss');
        
        if (currentSignEl && signGlossEl) {
            if (signs && signs.length > 0) {
                const primarySign = signs[0];
                currentSignEl.textContent = this.getSignSymbol(primarySign.sign);
                signGlossEl.textContent = `${primarySign.sign} (${primarySign.word})`;
                
                // Animate avatar
                this.animateMeetingAvatar(primarySign.sign);
            } else {
                currentSignEl.textContent = 'No sign found';
                signGlossEl.textContent = originalText;
            }
        }
    }

    handleSpeechOutput(data) {
        const { text, gesture } = data;
        
        // Update transcript display
        const transcriptEl = document.getElementById('meeting-transcript-text');
        if (transcriptEl) {
            transcriptEl.textContent = `Gesture: ${gesture} → Speech: ${text}`;
        }
        
        // Update status
        const statusEl = document.getElementById('interpreter-status');
        if (statusEl) {
            statusEl.textContent = 'Speaking';
            statusEl.className = 'status-value active';
            
            setTimeout(() => {
                statusEl.textContent = 'Active';
            }, text.length * 100);
        }
    }

    handleTranscriptUpdate(data) {
        const { transcript, isFinal } = data;
        
        // Update transcript display
        const transcriptEl = document.getElementById('meeting-transcript-text');
        if (transcriptEl) {
            transcriptEl.textContent = transcript;
        }
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

    animateMeetingAvatar(sign) {
        const leftArm = document.getElementById('meeting-left-arm');
        const rightArm = document.getElementById('meeting-right-arm');
        
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

    generateMeetingId() {
        // Generate a meeting ID based on current URL
        return btoa(window.location.href).substring(0, 10);
    }

    generateParticipantId() {
        return `participant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Event emitter functionality
    emit(event, data) {
        const customEvent = new CustomEvent(`meeting-integration:${event}`, {
            detail: data
        });
        window.dispatchEvent(customEvent);
    }
}
