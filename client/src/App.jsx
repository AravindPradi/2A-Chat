import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import { 
  Heart, 
  Send, 
  Image as ImageIcon, 
  Smile, 
  LogOut, 
  Lock, 
  User, 
  Loader2, 
  X, 
  Smartphone 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerName, setPartnerName] = useState('');

  // Image Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // UI state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // PWA Install Prompt state
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // 1. Monitor network status for offline warning
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Listen for PWA installation event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 3. Fetch User profile if token exists
  useEffect(() => {
    if (token) {
      setIsLoggingIn(true);
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) throw new Error('Token verification failed');
        return res.json();
      })
      .then(data => {
        setUser(data.user);
        // Automatically determine partner name (the other user)
        // We will retrieve the usernames from server or infer from environment
        // The server is designed for 2 users, so we can display the generic alternate user.
      })
      .catch(() => {
        handleLogout();
      })
      .finally(() => {
        setIsLoggingIn(false);
      });
    }
  }, [token]);

  // 4. Initialize Socket.IO connection once authenticated
  useEffect(() => {
    if (user && token) {
      // Connect to Socket server with token authentication
      const newSocket = io(API_URL, {
        auth: { token }
      });

      setSocket(newSocket);

      // Request and load old messages from database
      fetch(`${API_URL}/api/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data);
        }
      })
      .catch(err => console.error('Failed to load messages', err));

      // Listen for socket events
      newSocket.on('message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      newSocket.on('online_users', (usersList) => {
        setOnlineUsers(usersList);
      });

      newSocket.on('typing_status', (data) => {
        if (data.username !== user.username) {
          setPartnerTyping(data.isTyping);
        }
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
      });

      return () => {
        newSocket.close();
      };
    }
  }, [user, token]);

  // 5. Scroll to bottom when message list changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, partnerTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 6. Infer Partner name
  useEffect(() => {
    if (user) {
      // Typically, USER1 is user, and partner is USER2. Since it is private,
      // we'll assume the partner is anyone online/offline that isn't me.
      // We will check the online list to fetch the name, or fall back dynamically.
      // Let's set a simple default: if I am husband, partner is wife. Else husband.
      const myUsername = user.username;
      const probablePartner = myUsername.toLowerCase() === 'husband' ? 'Wife' : 'Husband';
      setPartnerName(probablePartner);
    }
  }, [user]);

  // --- ACTIONS ---

  const handleLogin = (e) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) return;

    setLoginError('');
    setIsLoggingIn(true);

    fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginUsername, password: loginPassword })
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      return data;
    })
    .then(data => {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    })
    .catch(err => {
      setLoginError(err.message);
    })
    .finally(() => {
      setIsLoggingIn(false);
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    if (socket) socket.close();
    setSocket(null);
    setMessages([]);
  };

  // Handle typing indicator debouncing
  const handleInputChange = (e) => {
    setMessageInput(e.target.value);

    if (socket) {
      socket.emit('typing');
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing');
      }, 2000);
    }
  };

  // Image Selection Handler
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB limit.');
      return;
    }

    // Validate image format
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPEG, PNG, WEBP, and GIF images are allowed.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Cancel Image Preview
  const handleCancelPreview = () => {
    setSelectedFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Send Message (Text & Image)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() && !selectedFile) return;

    let imageUrl = '';
    
    // Upload image if selected
    if (selectedFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', selectedFile);

      try {
        const response = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Image upload failed');
        imageUrl = data.imageUrl;
      } catch (err) {
        alert(err.message);
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
        handleCancelPreview();
      }
    }

    // Emit send_message event
    if (socket) {
      socket.emit('send_message', {
        text: messageInput,
        imageUrl
      });
      setMessageInput('');
      socket.emit('stop_typing');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleEmojiClick = (emojiData) => {
    setMessageInput(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // Trigger PWA installation
  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
        } else {
          console.log('User dismissed the PWA install prompt');
        }
        setDeferredPrompt(null);
        setShowInstallBanner(false);
      });
    }
  };

  // Format timestamp (HH:MM)
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // Check if partner is currently online
  const isPartnerOnline = onlineUsers.some(
    username => username.toLowerCase() === partnerName.toLowerCase()
  );

  // --- RENDERING ---

  // Loading Screen
  if (isLoggingIn && !user) {
    return (
      <div className="login-container glass-panel">
        <Heart className="login-icon animate-pulse" size={48} color="#ff4a7d" style={{ margin: '0 auto 1.5rem' }} />
        <h2 className="login-logo">Connecting</h2>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <Loader2 className="animate-spin" color="#ff4a7d" size={24} />
        </div>
      </div>
    );
  }

  // Auth Screen (if not logged in)
  if (!user) {
    return (
      <div className="login-container glass-panel">
        <div className="login-header">
          <h1 className="login-logo">Us & Love</h1>
          <p className="login-subtitle">Our Private Space</p>
        </div>

        {loginError && <div className="login-error">{loginError}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-wrapper">
              <User className="input-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Enter username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" />
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={isLoggingIn}>
            {isLoggingIn ? <Loader2 className="animate-spin" size={20} /> : 'Login'}
          </button>
        </form>
      </div>
    );
  }

  // Chat Screen (logged in)
  return (
    <div className="chat-app-container">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="offline-banner">
          You are currently offline. Using cached chat history.
        </div>
      )}

      {/* PWA custom Install Banner */}
      {showInstallBanner && deferredPrompt && (
        <div className="pwa-install-banner">
          <div className="pwa-install-info">
            <div className="pwa-app-icon">💖</div>
            <div>
              <div className="pwa-install-title">Install Our Chat App</div>
              <div className="pwa-install-desc">Add to home screen for full-screen view</div>
            </div>
          </div>
          <div className="pwa-install-actions">
            <button className="pwa-action-btn dismiss" onClick={() => setShowInstallBanner(false)}>Later</button>
            <button className="pwa-action-btn install" onClick={handleInstallClick}>Install</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="chat-header">
        <div className="header-user-info">
          <div className="avatar-wrapper">
            <div className="avatar">
              {partnerName.charAt(0).toUpperCase()}
            </div>
            <span className={`status-dot ${isPartnerOnline ? 'online' : ''}`} />
          </div>
          <div className="user-name-details">
            <span className="chat-partner-name">{partnerName}</span>
            <span className={`chat-partner-status ${isPartnerOnline ? 'online-text' : ''}`}>
              {isPartnerOnline ? 'online' : 'offline'}
            </span>
          </div>
        </div>

        <div className="header-actions">
          <button className="header-btn" onClick={handleLogout} title="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <main className="chat-messages-area">
        {messages.map((msg) => {
          const isSentByMe = msg.sender.toLowerCase() === user.username.toLowerCase();
          return (
            <div 
              key={msg._id || msg.createdAt} 
              className={`message-bubble-wrapper ${isSentByMe ? 'sent' : 'received'}`}
            >
              <div className="message-bubble">
                {msg.imageUrl && (
                  <img 
                    src={msg.imageUrl} 
                    alt="shared content" 
                    className="message-img" 
                    onClick={() => window.open(msg.imageUrl, '_blank')}
                  />
                )}
                {msg.text && <p>{msg.text}</p>}
                <span className="message-info">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
        
        {/* Partner Typing Indicator */}
        {partnerTyping && (
          <div className="message-bubble-wrapper received">
            <div className="message-bubble" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <div className="typing-indicator-bar">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input controls / Preview Panel */}
      <footer className="chat-input-container">
        {/* Image Preview Block */}
        {imagePreview && (
          <div className="image-preview-panel">
            <img src={imagePreview} alt="upload preview" className="preview-img" />
            <span className="preview-info">{selectedFile?.name}</span>
            <button className="cancel-preview-btn" onClick={handleCancelPreview} disabled={isUploading}>
              <X size={18} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="input-controls">
          {/* Emoji Button */}
          <button 
            type="button" 
            className="input-action-btn" 
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Add Emoji"
          >
            <Smile size={22} />
          </button>

          {/* Emoji Picker Overlay */}
          {showEmojiPicker && (
            <div className="emoji-picker-container">
              <EmojiPicker 
                onEmojiClick={handleEmojiClick}
                theme="dark"
                skinTonesDisabled
                searchDisabled
                width={280}
                height={350}
              />
            </div>
          )}

          {/* Image Upload Button */}
          <button 
            type="button" 
            className="input-action-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Image"
            disabled={isUploading}
          >
            <ImageIcon size={22} />
          </button>

          <input 
            type="file"
            ref={fileInputRef}
            className="hidden-file-input"
            accept="image/*"
            onChange={handleFileSelect}
          />

          {/* Text Input Field */}
          <input
            type="text"
            className="text-input-field"
            placeholder={isUploading ? "Uploading image..." : "Write a message..."}
            value={messageInput}
            onChange={handleInputChange}
            disabled={isUploading}
          />

          {/* Send Button */}
          <button 
            type="submit" 
            className="send-btn"
            disabled={(!messageInput.trim() && !selectedFile) || isUploading}
          >
            {isUploading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;
