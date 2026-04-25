# HoloView AR - Holographic Visualization PWA

Progressive Web App for holographic augmented reality visualization. View, manage, and interact with 3D holograms in real-time AR experiences.

## Features

### 1. Progressive Web App (PWA)
- Installable on any device (iOS, Android, Desktop)
- Offline-capable with service worker caching
- Responsive design optimized for iPhone 8 Plus (A11 Bionic) and all modern devices
- Targets 60fps rendering performance

### 2. User Profile System
- Email/password and Google authentication via Firebase
- Unique `profile_id` for each user
- Cloud-synced user data and preferences
- Demo mode available without Firebase configuration

### 3. 3D Model Library
- Upload and manage `.glb` and `.usdz` 3D models
- Cloud storage via Firebase Storage
- Interactive 3D model previews using `<model-viewer>`
- Drag-and-drop upload with progress tracking

### 4. AR Viewer Engine
- Real-time camera feed with 3D hologram overlay
- Three.js-based rendering with holographic effects
- Model auto-scaling and centering
- Ambient and directional lighting for realistic rendering
- Screenshot capture functionality

### 5. Projection Mode
- Point device camera at a game screen (Free Fire, etc.)
- Overlay 3D holograms on the captured view
- Floating animation effects for immersive experience
- Opacity controls for blending

### 6. QR Code System
- Auto-generated QR codes for each hologram
- Camera-based QR scanning using BarcodeDetector API
- Scan a QR code to instantly activate a hologram in AR

### 7. Intuitive UI
- Dark holographic theme design
- Bottom navigation for mobile devices
- Model selector drawer in AR mode
- Toast notifications for user feedback
- Modal-based detail views with 3D preview

## Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 / CSS3 / ES6+ | Core web standards |
| Firebase Auth | User authentication |
| Cloud Firestore | User profiles & model metadata |
| Firebase Storage | 3D model file storage |
| Three.js | 3D rendering engine |
| GLTFLoader | `.glb` / `.gltf` model loading |
| `<model-viewer>` | 3D model previews & AR Quick Look |
| QRCode.js | QR code generation |
| BarcodeDetector API | QR code scanning |
| Service Worker | Offline caching & PWA support |

## Getting Started

### Quick Start (Demo Mode)
1. Serve the files with any static HTTP server:
   ```bash
   npx serve .
   # or
   python3 -m http.server 8080
   ```
2. Open `http://localhost:8080` in your browser
3. Click "Sign In" or "Sign Up" to enter demo mode
4. Explore the AR Viewer, Library, QR Scanner, and Projection Mode

### With Firebase (Production)
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password + Google)
3. Create a Firestore database
4. Enable Firebase Storage
5. Update `FIREBASE_CONFIG` in `js/app.js` with your project credentials
6. Deploy to Firebase Hosting or any static hosting

### Deploy to Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## Project Structure

```
/
├── index.html          # Single-page application entry point
├── manifest.json       # PWA manifest
├── sw.js              # Service worker for offline caching
├── css/
│   └── main.css       # Complete styling (dark holographic theme)
├── js/
│   └── app.js         # Application logic (auth, library, AR, QR)
├── icons/
│   ├── icon-72.png    # PWA icons (72-512px)
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   └── icon-512.png
└── README.md
```

## Device Compatibility

| Device | Browser | Status |
|---|---|---|
| iPhone 8 Plus | Safari | Optimized (A11 Bionic) |
| iPhone 12+ | Safari | Full support |
| Android | Chrome | Full support |
| iPad | Safari | Full support |
| Desktop | Chrome/Firefox/Edge | Full support |

## Browser APIs Used

- **MediaDevices** (`getUserMedia`): Camera access for AR and QR scanning
- **DeviceOrientation**: Motion sensor data for AR tracking
- **BarcodeDetector**: Native QR code detection
- **Service Worker**: Offline caching and PWA install
- **WebGL**: Hardware-accelerated 3D rendering via Three.js

## License

MIT
