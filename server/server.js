require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

// Configuration & Default Fallbacks for Local Testing
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'local_fallback_secret_key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Fixed Users Configuration (fall back to default logins for local testing)
const USER1_USERNAME = process.env.USER1_USERNAME || 'husband';
const USER1_PASSWORD = process.env.USER1_PASSWORD || 'love123';
const USER2_USERNAME = process.env.USER2_USERNAME || 'wife';
const USER2_PASSWORD = process.env.USER2_PASSWORD || 'love123';

// Mock Storage Config (only used if MongoDB/Cloudinary are missing)
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Check if we are running in Mock Mode
const MONGODB_URI = process.env.MONGODB_URI;
const useMongo = !!MONGODB_URI;

const hasCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

console.log('--- SERVER STARTING ---');
console.log(`[Config] User 1 username: "${USER1_USERNAME}"`);
console.log(`[Config] User 2 username: "${USER2_USERNAME}"`);

if (useMongo) {
  console.log('[Database] Connecting to MongoDB Atlas...');
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('[Database] MongoDB Atlas connected.'))
    .catch(err => {
      console.error('[Database] MongoDB Atlas connection failed:', err);
      process.exit(1);
    });
} else {
  console.log(`[Database] MONGODB_URI is not set. Using local JSON mock database at: ${MESSAGES_FILE}`);
}

if (hasCloudinary) {
  console.log('[Storage] Cloudinary credentials loaded. Uploads will go to Cloudinary.');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
} else {
  console.log(`[Storage] Cloudinary variables missing. Using local uploads at: ${UPLOADS_DIR}`);
}

// Local mock database helpers
const getLocalMessages = () => {
  if (!fs.existsSync(MESSAGES_FILE)) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
};

const saveLocalMessage = (msg) => {
  const msgs = getLocalMessages();
  msgs.push(msg);
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msgs, null, 2));
};

// Middleware
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());

// Serve local upload files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access Token Required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or Expired Token' });
    req.user = user;
    next();
  });
};

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  let matchedUser = null;

  // Validate against user 1
  if (username === USER1_USERNAME) {
    const isMatch = password === USER1_PASSWORD || await bcrypt.compare(password, USER1_PASSWORD).catch(() => false);
    if (isMatch) matchedUser = USER1_USERNAME;
  }
  // Validate against user 2
  else if (username === USER2_USERNAME) {
    const isMatch = password === USER2_PASSWORD || await bcrypt.compare(password, USER2_PASSWORD).catch(() => false);
    if (isMatch) matchedUser = USER2_USERNAME;
  }

  if (!matchedUser) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const token = jwt.sign({ username: matchedUser }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: { username: matchedUser }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: { username: req.user.username } });
});

// --- MESSAGES ROUTES ---

app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    if (useMongo) {
      const messages = await Message.find().sort({ createdAt: 1 }).limit(500);
      return res.json(messages);
    } else {
      return res.json(getLocalMessages());
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error retrieving chat history' });
  }
});

// --- IMAGE UPLOAD ---

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.'));
    }
  }
});

app.post('/api/upload', authenticateToken, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    if (hasCloudinary) {
      // Upload local file to Cloudinary and clean up local file afterwards
      const localFilePath = req.file.path;
      const result = await cloudinary.uploader.upload(localFilePath, {
        folder: 'private-chat-app',
        resource_type: 'image'
      });
      // Delete temporary local file
      fs.unlinkSync(localFilePath);
      return res.json({ imageUrl: result.secure_url });
    } else {
      // Return local URL to download/serve
      const relativeUrl = `/uploads/${req.file.filename}`;
      const fullUrl = `${req.protocol}://${req.get('host')}${relativeUrl}`;
      return res.json({ imageUrl: fullUrl });
    }
  } catch (err) {
    console.error('Upload handler error:', err);
    res.status(500).json({ message: 'Failed to upload image' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File is too large. Max size is 5MB.' });
    }
    return res.status(400).json({ message: err.message });
  } else if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
});

// --- SOCKET.IO REAL-TIME CHAT ---

const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:8080'],
    methods: ['GET', 'POST']
  }
});

const onlineUsers = new Map(); // username -> socket.id

io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;

  if (!token) {
    return next(new Error('Authentication token required'));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication failed'));
    }
    socket.username = decoded.username;
    next();
  });
});

io.on('connection', (socket) => {
  const username = socket.username;
  console.log(`User connected: ${username} (${socket.id})`);

  onlineUsers.set(username, socket.id);
  io.emit('online_users', Array.from(onlineUsers.keys()));

  socket.on('send_message', async (data) => {
    try {
      const { text, imageUrl } = data;
      const recipient = username === USER1_USERNAME ? USER2_USERNAME : USER1_USERNAME;

      const messageData = {
        sender: username,
        recipient,
        text: text || '',
        imageUrl: imageUrl || '',
        createdAt: new Date()
      };

      if (useMongo) {
        const newMessage = new Message(messageData);
        await newMessage.save();
        io.emit('message', newMessage);
      } else {
        // Mock DB custom fields
        const mockMessage = {
          _id: Math.random().toString(36).substr(2, 9),
          ...messageData
        };
        saveLocalMessage(mockMessage);
        io.emit('message', mockMessage);
      }

    } catch (error) {
      console.error('Error handling send_message:', error);
      socket.emit('error_message', { message: 'Failed to send message.' });
    }
  });

  socket.on('typing', () => {
    const recipient = username === USER1_USERNAME ? USER2_USERNAME : USER1_USERNAME;
    const recipientSocketId = onlineUsers.get(recipient);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('typing_status', { username, isTyping: true });
    }
  });

  socket.on('stop_typing', () => {
    const recipient = username === USER1_USERNAME ? USER2_USERNAME : USER1_USERNAME;
    const recipientSocketId = onlineUsers.get(recipient);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('typing_status', { username, isTyping: false });
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${username}`);
    onlineUsers.delete(username);
    io.emit('online_users', Array.from(onlineUsers.keys()));
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
