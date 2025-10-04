const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Store active sessions
const activeSessions = new Map();

// Sign language gesture recognition states
const gestureStates = {
  IDLE: "idle",
  LISTENING: "listening",
  PROCESSING: "processing",
  SPEAKING: "speaking",
};

// Basic sign language gestures mapping
const signToText = {
  hello: "Hello",
  thank_you: "Thank you",
  yes: "Yes",
  no: "No",
  please: "Please",
  help: "Help",
  stop: "Stop",
  go: "Go",
  wait: "Wait",
  question: "I have a question",
};

// Text to sign language mapping
const textToSign = {
  hello: "hello",
  thank: "thank_you",
  thanks: "thank_you",
  yes: "yes",
  no: "no",
  please: "please",
  help: "help",
  stop: "stop",
  go: "go",
  wait: "wait",
  question: "question",
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Initialize session
  activeSessions.set(socket.id, {
    gestureState: gestureStates.IDLE,
    isListening: false,
    lastGesture: null,
    transcript: "",
  });

  // Handle speech-to-sign requests
  socket.on("speech-to-sign", (data) => {
    const session = activeSessions.get(socket.id);
    if (!session) return;

    const { transcript, confidence } = data;

    // Process transcript and find matching signs
    const words = transcript.toLowerCase().split(" ");
    const matchedSigns = [];

    words.forEach((word) => {
      if (textToSign[word]) {
        matchedSigns.push({
          sign: textToSign[word],
          word: word,
          confidence: confidence,
        });
      }
    });

    // Emit sign language animation data
    socket.emit("sign-animation", {
      signs: matchedSigns,
      originalText: transcript,
      timestamp: Date.now(),
    });

    console.log(
      `Speech to sign: "${transcript}" -> ${matchedSigns
        .map((s) => s.sign)
        .join(", ")}`
    );
  });

  // Handle sign-to-speech requests
  socket.on("sign-to-speech", (data) => {
    const session = activeSessions.get(socket.id);
    if (!session) return;

    const { gesture, confidence } = data;

    // Update session state
    session.lastGesture = gesture;
    session.gestureState = gestureStates.PROCESSING;

    // Convert gesture to text
    const text = signToText[gesture] || "Unknown gesture";

    // Emit speech synthesis request
    socket.emit("speech-synthesis", {
      text: text,
      gesture: gesture,
      confidence: confidence,
      timestamp: Date.now(),
    });

    console.log(`Sign to speech: "${gesture}" -> "${text}"`);

    // Update session state
    session.gestureState = gestureStates.SPEAKING;
    setTimeout(() => {
      session.gestureState = gestureStates.IDLE;
    }, 2000);
  });

  // Handle gesture recognition updates
  socket.on("gesture-update", (data) => {
    const session = activeSessions.get(socket.id);
    if (!session) return;

    const { gesture, confidence, handPositions } = data;

    // Only process high-confidence gestures
    if (confidence > 0.7) {
      socket.emit("sign-to-speech", {
        gesture: gesture,
        confidence: confidence,
        handPositions: handPositions,
      });
    }
  });

  // Handle video meeting integration
  socket.on("meeting-join", (data) => {
    const session = activeSessions.get(socket.id);
    if (!session) return;

    const { meetingId, participantId, isDeaf } = data;

    // Join room for this meeting
    socket.join(`meeting-${meetingId}`);

    // Notify other participants about interpreter
    socket.to(`meeting-${meetingId}`).emit("interpreter-joined", {
      participantId: participantId,
      isDeaf: isDeaf,
      interpreterId: socket.id,
    });

    console.log(
      `User ${participantId} joined meeting ${meetingId} as ${
        isDeaf ? "deaf" : "hearing"
      } participant`
    );
  });

  // Handle real-time audio transcription
  socket.on("audio-chunk", (data) => {
    const session = activeSessions.get(socket.id);
    if (!session) return;

    // Process audio chunk for speech recognition
    // This would integrate with speech recognition services
    socket.emit("transcription-partial", {
      text: data.transcript || "",
      confidence: data.confidence || 0,
      timestamp: Date.now(),
    });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    activeSessions.delete(socket.id);
  });
});

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    activeSessions: activeSessions.size,
    timestamp: Date.now(),
  });
});

app.get("/api/gestures", (req, res) => {
  res.json({
    availableGestures: Object.keys(signToText),
    gestureMapping: signToText,
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sign Language Interpreter Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
});
