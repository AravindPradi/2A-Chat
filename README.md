# Us & Love | Private Real-Time Chat App 💖

A private, secure, and premium real-time chat application designed exclusively for two users (e.g., you and your partner). Built with React, Vite, Node.js, Express, Socket.IO, and MongoDB, featuring a highly-polished dark romantic UI, image sharing via Cloudinary, and full Progressive Web App (PWA) support for mobile installations.

---

## Features
- 🔒 **Private 2-User Chat:** Restricts access to exactly two configured users.
- ⚡ **Real-Time Messaging:** Instant text communication using WebSockets via Socket.IO.
- 📸 **Image Sharing:** Send photos directly in chat using Cloudinary storage.
- 👁️ **Image Preview:** View chosen image before sending.
- 💬 **Typing Indicator:** See when your partner is actively typing.
- 🟢 **Online/Offline Status:** Live indicators showing connection status.
- 📜 **Chat History:** Automatic retrieval of historical messages from MongoDB.
- 📲 **PWA & Android Support:** Installable as an app on your phone, working full-screen with offline support.
- 🎨 **Romantic Dark UI:** Glassmorphism, smooth animations, and tailored color palette.

---

## Folder Structure
```
/2A chat
  ├── /client         # React + Vite frontend (PWA)
  ├── /server         # Node.js + Express backend (Socket.IO + APIs)
  └── README.md       # Project documentation (this file)
```

---

## Local Setup & Installation

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18 or higher recommended).

### 1. Backend Setup
1. Open a terminal and navigate to the `server` directory:
   ```bash
   cd server
   ```
2. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```
3. Open `.env` and fill in the configuration values (MongoDB, Cloudinary, user login details, etc.). See below for instructions on how to get these services.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the backend server in development mode:
   ```bash
   npm run dev
   ```
   The backend will run on `http://localhost:5000`.

### 2. Frontend Setup
1. Open a new terminal and navigate to the `client` directory:
   ```bash
   cd client
   ```
2. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```
3. Customize `VITE_API_URL` to point to your backend url (default: `http://localhost:5000`).
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the local frontend development server:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`. Open this URL in your web browser.

---

## Setting up External Services (Free Tier)

### 1. MongoDB Atlas (Database)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and register for a free account.
2. Create a new project and build a **Database** using the **M0 (Free)** cluster.
3. Under **Database Access**, create a user with read/write access (write down their username and password).
4. Under **Network Access**, click **Add IP Address** and choose **Allow Access from Anywhere** (`0.0.0.0/0`) so Vercel/Render can connect.
5. Click **Connect** on your Database -> **Drivers** -> Copy the connection string.
6. Replace the connection string credentials `<db_username>` and `<db_password>` and place it in the `MONGODB_URI` environment variable inside `server/.env`.

### 2. Cloudinary (Image Hosting)
1. Go to [Cloudinary](https://cloudinary.com/) and sign up for a free account.
2. From the Console Dashboard, copy your **Cloud Name**, **API Key**, and **API Secret**.
3. Place these keys into the respective `CLOUDINARY_*` environment variables in `server/.env`.

---

## Production Deployment Steps

### Step 1: Deploy Backend on Render
1. Go to [Render](https://render.com/) and log in.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Set the following settings:
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Scroll down to **Environment Variables** and add all the keys from `server/.env` (including your database URIs, usernames/passwords, and JWT secret).
6. Deploy the service and copy the deployed URL (e.g., `https://your-app-backend.onrender.com`).

### Step 2: Deploy Frontend on Vercel
1. Go to [Vercel](https://vercel.com/) and log in.
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. In the configuration page, set:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
5. Expand **Environment Variables** and add:
   - `VITE_API_URL`: Your backend Render URL (e.g., `https://your-app-backend.onrender.com`).
6. Click **Deploy**. Vercel will build and launch your frontend. Copy the deployed frontend URL (e.g., `https://your-app.vercel.app`).
7. **Important CORS Step:** Update the `FRONTEND_URL` environment variable on your Render backend to match this Vercel URL, then restart the Render service. This ensures Socket.IO and image uploads connect correctly without CORS blocks.

---

## Generating the Android APK using PWABuilder

Once your frontend is deployed and active on Vercel, you can generate a high-performance native Android package (`.apk` / `.aab`) in minutes using PWABuilder.

1. **Visit PWABuilder:** Go to [PWABuilder.com](https://www.pwabuilder.com/).
2. **Enter Deployed URL:** Input your Vercel deployment URL (e.g., `https://your-app.vercel.app`) in the input box and click **Start**.
3. **Verify PWA Requirements:** PWABuilder will scan your URL. Since we've pre-configured `manifest.json`, the service worker, icons, and splash screens, your site will receive a high score and be marked installable.
4. **Generate Android Package:**
   - Click the **Build My App** button.
   - Select **Android** from the list of options.
   - Click **Options** if you want to customize your APK (package name, launcher background color, app name, signing keys). We already set `display_override: ["fullscreen"]` in the manifest to make sure it displays full-screen.
5. **Download Package:**
   - Click **Generate**.
   - After a brief processing period, click **Download ZIP**.
6. **Install APK:**
   - Extract the downloaded zip file.
   - Inside, you will find the `.apk` file (for manual installation/testing on Android devices) and `.aab` file (if you wish to submit it to the Google Play Store).
   - Transfer the `.apk` to your phone and install it (you may need to allow "Unknown Sources" in your browser/file explorer settings).

Enjoy your private, full-screen romantic space! 💖
