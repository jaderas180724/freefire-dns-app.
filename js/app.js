/**
 * HoloView AR - Main Application Module
 * Progressive Web App for Holographic AR Visualization
 */

// ============================================
// Firebase Configuration
// ============================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBHoloViewARDemoKey2024",
  authDomain: "holoview-ar.firebaseapp.com",
  projectId: "holoview-ar",
  storageBucket: "holoview-ar.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// ============================================
// Utilities
// ============================================
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// Global State
// ============================================
const state = {
  user: null,
  models: [],
  selectedModel: null,
  arStream: null,
  projStream: null,
  arScene: null,
  arRenderer: null,
  arCamera: null,
  deferredInstallPrompt: null,
  currentView: 'auth',
  qrScanner: null
};

// ============================================
// Initialization
// ============================================
async function initApp() {
  registerServiceWorker();
  setupInstallPrompt();

  // Wait for Firebase modules
  if (!window.FirebaseModules) {
    await new Promise((resolve) => {
      window.addEventListener('firebase-loaded', resolve, { once: true });
    });
  }

  const FB = window.FirebaseModules;

  const isPlaceholderConfig = !FIREBASE_CONFIG.apiKey ||
    FIREBASE_CONFIG.apiKey.includes('DemoKey') ||
    FIREBASE_CONFIG.apiKey.includes('YOUR_') ||
    FIREBASE_CONFIG.projectId === 'holoview-ar';

  if (isPlaceholderConfig) {
    console.info('Placeholder Firebase config detected — running in demo mode');
    window.fbAuth = null;
    window.fbDb = null;
    window.fbStorage = null;
  } else {
    try {
      const app = FB.initializeApp(FIREBASE_CONFIG);
      window.fbAuth = FB.getAuth(app);
      window.fbDb = FB.getFirestore(app);
      window.fbStorage = FB.getStorage(app);
      FB.onAuthStateChanged(window.fbAuth, handleAuthStateChange);
    } catch (err) {
      console.warn('Firebase init failed — running in demo mode:', err.message);
      window.fbAuth = null;
      window.fbDb = null;
      window.fbStorage = null;
    }
  }

  setupEventListeners();
  hideLoading();
}

// ============================================
// Service Worker
// ============================================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('SW registered:', reg.scope))
      .catch((err) => console.warn('SW registration failed:', err));
  }
}

// ============================================
// Install Prompt (PWA)
// ============================================
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    document.getElementById('btn-install')?.classList.remove('hidden');
  });
}

function handleInstall() {
  if (state.deferredInstallPrompt) {
    state.deferredInstallPrompt.prompt();
    state.deferredInstallPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        showToast('App installed successfully!', 'success');
      }
      state.deferredInstallPrompt = null;
      document.getElementById('btn-install')?.classList.add('hidden');
    });
  }
}

// ============================================
// Auth State
// ============================================
function handleAuthStateChange(user) {
  hideLoading();
  if (user) {
    state.user = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'User',
      profileId: user.uid.substring(0, 8).toUpperCase()
    };
    updateProfileUI();
    loadUserModels();
    showView('dashboard');
  } else {
    state.user = null;
    state.models = [];
    showView('auth');
  }
}

// ============================================
// Authentication Functions
// ============================================
async function handleLogin(email, password) {
  const FB = window.FirebaseModules;
  if (!window.fbAuth) {
    demoLogin(email);
    return;
  }
  try {
    await FB.signInWithEmailAndPassword(window.fbAuth, email, password);
    showToast('Welcome back!', 'success');
  } catch (err) {
    if (isFirebaseConfigError(err)) {
      demoLogin(email);
    } else {
      showToast(getAuthErrorMessage(err.code), 'error');
    }
  }
}

async function handleRegister(name, email, password) {
  const FB = window.FirebaseModules;
  if (!window.fbAuth) {
    demoLogin(email, name);
    return;
  }
  try {
    const cred = await FB.createUserWithEmailAndPassword(window.fbAuth, email, password);
    await FB.updateProfile(cred.user, { displayName: name });
    await FB.setDoc(FB.doc(window.fbDb, 'users', cred.user.uid), {
      displayName: name,
      email: email,
      profileId: cred.user.uid.substring(0, 8).toUpperCase(),
      createdAt: FB.serverTimestamp(),
      modelsCount: 0,
      arSessions: 0
    });
    showToast('Account created! Welcome to HoloView AR', 'success');
  } catch (err) {
    if (isFirebaseConfigError(err)) {
      demoLogin(email, name);
    } else {
      showToast(getAuthErrorMessage(err.code), 'error');
    }
  }
}

async function handleGoogleAuth() {
  const FB = window.FirebaseModules;
  if (!window.fbAuth) {
    demoLogin('demo@holoview.ar', 'Demo User');
    return;
  }
  try {
    const provider = new FB.GoogleAuthProvider();
    const result = await FB.signInWithPopup(window.fbAuth, provider);
    const userDoc = await FB.getDoc(FB.doc(window.fbDb, 'users', result.user.uid));
    if (!userDoc.exists()) {
      await FB.setDoc(FB.doc(window.fbDb, 'users', result.user.uid), {
        displayName: result.user.displayName,
        email: result.user.email,
        profileId: result.user.uid.substring(0, 8).toUpperCase(),
        createdAt: FB.serverTimestamp(),
        modelsCount: 0,
        arSessions: 0
      });
    }
    showToast('Welcome!', 'success');
  } catch (err) {
    if (isFirebaseConfigError(err)) {
      demoLogin('demo@holoview.ar', 'Demo User');
    } else if (err.code !== 'auth/popup-closed-by-user') {
      showToast(getAuthErrorMessage(err.code), 'error');
    }
  }
}

async function handleLogout() {
  const FB = window.FirebaseModules;
  stopARStream();
  stopProjectionStream();
  try {
    if (window.fbAuth) {
      await FB.signOut(window.fbAuth);
    }
  } catch (err) {
    console.warn('Sign out error:', err);
  }
  state.user = null;
  state.models = [];
  showView('auth');
  showToast('Signed out', 'success');
}

function demoLogin(email, name) {
  const demoId = 'DEMO' + Math.random().toString(36).substring(2, 6).toUpperCase();
  state.user = {
    uid: 'demo_' + Date.now(),
    email: email || 'demo@holoview.ar',
    displayName: name || email.split('@')[0],
    profileId: demoId
  };
  // Load demo models
  state.models = getDemoModels();
  updateProfileUI();
  updateModelsGrid();
  updateDashboardStats();
  showView('dashboard');
  showToast('Welcome! Running in demo mode', 'success');
}

function isFirebaseConfigError(err) {
  const configErrors = [
    'auth/api-key-not-valid',
    'auth/invalid-api-key',
    'auth/project-not-found',
    'auth/configuration-not-found',
    'auth/network-request-failed'
  ];
  return configErrors.includes(err.code) ||
    (err.message && err.message.includes('invalid')) ||
    !err.code;
}

function getAuthErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'This email is already registered',
    'auth/invalid-email': 'Invalid email address',
    'auth/wrong-password': 'Incorrect password',
    'auth/user-not-found': 'No account found with this email',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/network-request-failed': 'Network error. Check your connection',
    'auth/invalid-credential': 'Invalid credentials. Please try again'
  };
  return messages[code] || 'Authentication error. Please try again';
}

// ============================================
// Models / Library
// ============================================
async function loadUserModels() {
  const FB = window.FirebaseModules;
  if (!window.fbDb || !state.user) {
    state.models = getDemoModels();
    updateModelsGrid();
    updateDashboardStats();
    return;
  }
  try {
    const q = FB.query(
      FB.collection(window.fbDb, 'models'),
      FB.where('userId', '==', state.user.uid),
      FB.orderBy('createdAt', 'desc')
    );
    const snapshot = await FB.getDocs(q);
    state.models = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    updateModelsGrid();
    updateDashboardStats();
  } catch (err) {
    console.warn('Failed to load models:', err);
    state.models = getDemoModels();
    updateModelsGrid();
    updateDashboardStats();
  }
}

function getDemoModels() {
  return [
    {
      id: 'demo_dragon',
      name: 'Cosmic Dragon',
      description: 'A majestic holographic dragon with particle effects',
      format: 'glb',
      modelUrl: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
      createdAt: new Date().toISOString(),
      userId: state.user?.uid
    },
    {
      id: 'demo_robot',
      name: 'Mech Guardian',
      description: 'Futuristic mech robot hologram for gaming overlay',
      format: 'glb',
      modelUrl: 'https://modelviewer.dev/shared-assets/models/RobotExpressive.glb',
      createdAt: new Date().toISOString(),
      userId: state.user?.uid
    },
    {
      id: 'demo_helmet',
      name: 'Battle Helmet',
      description: 'Legendary battle helmet from the Free Fire universe',
      format: 'glb',
      modelUrl: 'https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb',
      createdAt: new Date().toISOString(),
      userId: state.user?.uid
    }
  ];
}

async function uploadModel(name, description, file) {
  const FB = window.FirebaseModules;

  if (!window.fbStorage || !window.fbDb) {
    // Demo mode: create a local model entry
    const demoModel = {
      id: 'model_' + Date.now(),
      name: name,
      description: description,
      format: file.name.split('.').pop().toLowerCase(),
      modelUrl: URL.createObjectURL(file),
      createdAt: new Date().toISOString(),
      userId: state.user?.uid
    };
    state.models.unshift(demoModel);
    updateModelsGrid();
    updateDashboardStats();
    showToast('Model uploaded (demo mode)!', 'success');
    return;
  }

  try {
    const fileExt = file.name.split('.').pop().toLowerCase();
    const filePath = `models/${state.user.uid}/${Date.now()}_${file.name}`;
    const fileRef = FB.storageRef(window.fbStorage, filePath);

    // Upload file
    const snapshot = await FB.uploadBytes(fileRef, file);
    const downloadURL = await FB.getDownloadURL(snapshot.ref);

    // Save metadata
    const modelRef = FB.doc(FB.collection(window.fbDb, 'models'));
    const modelData = {
      name: name,
      description: description,
      format: fileExt,
      modelUrl: downloadURL,
      storagePath: filePath,
      userId: state.user.uid,
      createdAt: FB.serverTimestamp(),
      qrCode: `holoview://model/${modelRef.id}`
    };
    await FB.setDoc(modelRef, modelData);

    // Update local state
    state.models.unshift({ id: modelRef.id, ...modelData });
    updateModelsGrid();
    updateDashboardStats();
    showToast('Model uploaded successfully!', 'success');
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Failed to upload model', 'error');
  }
}

async function deleteModel(modelId) {
  const FB = window.FirebaseModules;
  const model = state.models.find((m) => m.id === modelId);
  if (!model) return;

  if (window.fbDb && !modelId.startsWith('demo_')) {
    try {
      await FB.deleteDoc(FB.doc(window.fbDb, 'models', modelId));
      if (model.storagePath && window.fbStorage) {
        await FB.deleteObject(FB.storageRef(window.fbStorage, model.storagePath));
      }
    } catch (err) {
      console.warn('Delete error:', err);
    }
  }

  state.models = state.models.filter((m) => m.id !== modelId);
  updateModelsGrid();
  updateDashboardStats();
  closeAllModals();
  showToast('Model deleted', 'success');
}

// ============================================
// AR Viewer
// ============================================
async function startARStream() {
  const video = document.getElementById('ar-video');
  const statusEl = document.getElementById('ar-status');
  if (!video) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });
    state.arStream = stream;
    video.srcObject = stream;
    statusEl?.classList.add('active');
    initARRenderer();
    showToast('Camera active', 'success');
  } catch (err) {
    console.error('Camera error:', err);
    showToast('Camera access denied. Please allow camera permission.', 'error');
  }
}

function stopARStream() {
  if (state.arStream) {
    state.arStream.getTracks().forEach((t) => t.stop());
    state.arStream = null;
  }
  const video = document.getElementById('ar-video');
  if (video) video.srcObject = null;
  const statusEl = document.getElementById('ar-status');
  statusEl?.classList.remove('active');

  if (state.arRenderer) {
    state.arRenderer.dispose();
    state.arRenderer = null;
  }
}

function initARRenderer() {
  const canvas = document.getElementById('ar-canvas');
  if (!canvas || !window.THREE) return;

  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  state.arScene = new THREE.Scene();
  state.arCamera = new THREE.PerspectiveCamera(
    70, canvas.width / canvas.height, 0.1, 1000
  );
  state.arCamera.position.z = 5;

  state.arRenderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  state.arRenderer.setSize(canvas.width, canvas.height);
  state.arRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  state.arRenderer.setClearColor(0x000000, 0);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  state.arScene.add(ambientLight);

  // Add directional light
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 5, 5);
  state.arScene.add(dirLight);

  // Add a holographic grid floor
  const gridHelper = new THREE.GridHelper(10, 20, 0x6c5ce7, 0x2a2a5e);
  gridHelper.position.y = -2;
  gridHelper.material.opacity = 0.3;
  gridHelper.material.transparent = true;
  state.arScene.add(gridHelper);

  // Start render loop
  animateAR();
}

function animateAR() {
  if (!state.arRenderer) return;
  requestAnimationFrame(animateAR);

  // Rotate models slowly
  state.arScene.children.forEach((child) => {
    if (child.userData?.isHologram) {
      child.rotation.y += 0.005;
    }
  });

  state.arRenderer.render(state.arScene, state.arCamera);
}

function placeHologramInAR(model) {
  if (!state.arScene || !model) return;

  // Remove existing holograms
  const toRemove = state.arScene.children.filter((c) => c.userData?.isHologram);
  toRemove.forEach((c) => state.arScene.remove(c));

  if (model.modelUrl && window.THREE) {
    const loader = new THREE.GLTFLoader();
    loader.load(
      model.modelUrl,
      (gltf) => {
        const scene = gltf.scene;
        scene.userData.isHologram = true;

        // Auto-scale to fit view
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        scene.scale.set(scale, scale, scale);

        // Center the model
        const center = box.getCenter(new THREE.Vector3());
        scene.position.sub(center.multiplyScalar(scale));

        // Add holographic glow effect
        addHolographicEffect(scene);

        state.arScene.add(scene);
        showToast(`${model.name} placed in AR`, 'success');
      },
      undefined,
      (err) => {
        console.warn('GLTF load error:', err);
        // Fallback: create a holographic placeholder
        placeHolographicPlaceholder(model.name);
      }
    );
  } else {
    placeHolographicPlaceholder(model.name);
  }
}

function placeHolographicPlaceholder(name) {
  if (!state.arScene || !window.THREE) return;

  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const material = new THREE.MeshPhongMaterial({
    color: 0x6c5ce7,
    emissive: 0x6c5ce7,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.8,
    wireframe: true
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.isHologram = true;
  state.arScene.add(mesh);
  showToast(`${name} hologram placed`, 'success');
}

function addHolographicEffect(object) {
  if (!window.THREE) return;
  object.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone();
      child.material.emissive = new THREE.Color(0x6c5ce7);
      child.material.emissiveIntensity = 0.15;
    }
  });
}

// ============================================
// Projection Mode
// ============================================
async function startProjectionStream() {
  const video = document.getElementById('proj-video');
  const statusEl = document.getElementById('proj-status');
  if (!video) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });
    state.projStream = stream;
    video.srcObject = stream;
    statusEl?.classList.add('active');
    initProjectionRenderer();
    showToast('Projection mode active - point at your game screen', 'success');
  } catch (err) {
    console.error('Camera error:', err);
    showToast('Camera access denied', 'error');
  }
}

function stopProjectionStream() {
  if (state.projStream) {
    state.projStream.getTracks().forEach((t) => t.stop());
    state.projStream = null;
  }
  const video = document.getElementById('proj-video');
  if (video) video.srcObject = null;
  const statusEl = document.getElementById('proj-status');
  statusEl?.classList.remove('active');

  if (state.projRenderer) {
    state.projRenderer.dispose();
    state.projRenderer = null;
  }
  state.projScene = null;
  state.projCamera = null;
}

function initProjectionRenderer() {
  const canvas = document.getElementById('proj-canvas');
  if (!canvas || !window.THREE) return;

  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  // Reuse similar setup as AR but with projection-specific settings
  if (!state.projScene) {
    state.projScene = new THREE.Scene();
    state.projCamera = new THREE.PerspectiveCamera(
      70, canvas.width / canvas.height, 0.1, 1000
    );
    state.projCamera.position.z = 5;

    state.projRenderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    state.projRenderer.setSize(canvas.width, canvas.height);
    state.projRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    state.projRenderer.setClearColor(0x000000, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    state.projScene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 5, 5);
    state.projScene.add(dirLight);
  }

  animateProjection();
}

function animateProjection() {
  if (!state.projRenderer) return;
  requestAnimationFrame(animateProjection);

  state.projScene.children.forEach((child) => {
    if (child.userData?.isHologram) {
      child.rotation.y += 0.008;
      // Floating effect
      child.position.y = Math.sin(Date.now() * 0.002) * 0.2;
    }
  });

  state.projRenderer.render(state.projScene, state.projCamera);
}

// ============================================
// QR Code
// ============================================
function generateQRCode(model, container) {
  if (!container || !window.QRCode) return;
  container.innerHTML = '';
  const qrData = JSON.stringify({
    type: 'holoview',
    modelId: model.id,
    name: model.name,
    url: model.modelUrl
  });
  new QRCode(container, {
    text: qrData,
    width: 200,
    height: 200,
    colorDark: '#6c5ce7',
    colorLight: '#0a0a1a',
    correctLevel: QRCode.CorrectLevel.H
  });
}

async function initQRScanner() {
  const reader = document.getElementById('qr-reader');
  if (!reader) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    video.style.width = '100%';
    video.style.borderRadius = '16px';
    reader.innerHTML = '';
    reader.appendChild(video);
    await video.play();

    state.qrScanner = { stream, video };

    // Scan loop using canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scanInterval = setInterval(() => {
      if (!state.qrScanner) {
        clearInterval(scanInterval);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Simple QR detection via BarcodeDetector API
      if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        detector.detect(canvas).then((barcodes) => {
          if (barcodes.length > 0) {
            handleQRResult(barcodes[0].rawValue);
            clearInterval(scanInterval);
          }
        }).catch(() => {});
      }
    }, 500);
  } catch (err) {
    console.error('QR Scanner error:', err);
    reader.innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-secondary)">
        <span class="material-icons-round" style="font-size:48px;opacity:0.4">videocam_off</span>
        <p style="margin-top:12px">Camera access required for QR scanning</p>
      </div>`;
  }
}

function stopQRScanner() {
  if (state.qrScanner) {
    state.qrScanner.stream.getTracks().forEach((t) => t.stop());
    state.qrScanner = null;
  }
}

function handleQRResult(data) {
  try {
    const parsed = JSON.parse(data);
    if (parsed.type === 'holoview') {
      const resultEl = document.getElementById('qr-result');
      const resultText = document.getElementById('qr-result-text');
      if (resultEl && resultText) {
        resultText.textContent = `Hologram found: ${parsed.name}`;
        resultEl.classList.remove('hidden');
        state.selectedModel = {
          id: parsed.modelId,
          name: parsed.name,
          modelUrl: parsed.url
        };
      }
    }
  } catch {
    showToast('Invalid QR code', 'warning');
  }
}

// ============================================
// UI Management
// ============================================
function showView(viewName) {
  const viewMap = {
    'auth': 'view-auth',
    'dashboard': 'view-dashboard',
    'library': 'view-library',
    'ar-viewer': 'view-ar',
    'qr-scanner': 'view-qr',
    'projection': 'view-projection',
    'profile': 'view-profile'
  };

  // Stop streams when leaving views
  if (state.currentView === 'ar-viewer') stopARStream();
  if (state.currentView === 'projection') stopProjectionStream();
  if (state.currentView === 'qr-scanner') stopQRScanner();

  // Hide all views
  document.querySelectorAll('.view').forEach((v) => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });

  // Show target view
  const targetId = viewMap[viewName];
  const targetView = document.getElementById(targetId);
  if (targetView) {
    targetView.classList.remove('hidden');
    targetView.classList.add('active');
  }

  // Show/hide nav elements
  const isAuth = viewName === 'auth';
  const bottomNav = document.getElementById('bottom-nav');
  const navbar = document.getElementById('navbar');

  if (bottomNav) {
    bottomNav.classList.toggle('hidden', isAuth);
  }
  if (navbar) {
    navbar.style.display = isAuth ? 'none' : '';
  }

  // Update bottom nav active state
  document.querySelectorAll('.bottom-nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.navigate === viewName);
  });

  state.currentView = viewName;

  // Auto-start camera for AR/QR/Projection views
  if (viewName === 'ar-viewer') {
    setTimeout(() => startARStream(), 300);
  } else if (viewName === 'qr-scanner') {
    setTimeout(() => initQRScanner(), 300);
  } else if (viewName === 'projection') {
    setTimeout(() => startProjectionStream(), 300);
  }
}

function hideLoading() {
  const loading = document.getElementById('loading-screen');
  if (loading) {
    setTimeout(() => {
      loading.classList.add('fade-out');
      const app = document.getElementById('app');
      if (app) app.classList.remove('hidden');
      setTimeout(() => loading.remove(), 500);
    }, 1500);
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="material-icons-round">${icons[type] || 'info'}</span>
    <span>${escapeHTML(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function updateProfileUI() {
  if (!state.user) return;

  const nameEls = ['profile-name', 'welcome-msg'];
  nameEls.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'welcome-msg') {
        el.textContent = `Welcome, ${state.user.displayName}!`;
      } else {
        el.textContent = state.user.displayName;
      }
    }
  });

  const emailEl = document.getElementById('profile-email');
  if (emailEl) emailEl.textContent = state.user.email;

  const profileIdEl = document.getElementById('profile-id');
  if (profileIdEl) profileIdEl.textContent = state.user.profileId;
}

function updateDashboardStats() {
  const modelsEl = document.getElementById('stat-models');
  const profileModelsEl = document.getElementById('profile-models');
  if (modelsEl) modelsEl.textContent = state.models.length;
  if (profileModelsEl) profileModelsEl.textContent = state.models.length;

  const qrEl = document.getElementById('stat-qr');
  if (qrEl) qrEl.textContent = state.models.length;
}

function updateModelsGrid() {
  const grid = document.getElementById('models-grid');
  const emptyState = document.getElementById('empty-library');
  if (!grid) return;

  // Clear existing model cards
  grid.querySelectorAll('.model-card').forEach((c) => c.remove());

  if (state.models.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  state.models.forEach((model) => {
    const card = createModelCard(model);
    grid.appendChild(card);
  });

  // Also update the AR model drawer
  updateModelDrawer();
}

function createModelCard(model) {
  const card = document.createElement('div');
  card.className = 'model-card';
  card.dataset.modelId = model.id;

  const safeName = escapeHTML(model.name);
  const safeFormat = escapeHTML(model.format || 'glb');
  const safeUrl = model.modelUrl ? escapeHTML(model.modelUrl) : '';
  const safeId = escapeHTML(model.id);

  card.innerHTML = `
    <div class="model-card-thumb">
      ${safeUrl ?
        `<model-viewer
          src="${safeUrl}"
          auto-rotate
          camera-controls
          interaction-prompt="none"
          style="width:100%;height:100%;">
        </model-viewer>` :
        `<span class="material-icons-round">view_in_ar</span>`
      }
    </div>
    <div class="model-card-info">
      <h4>${safeName}</h4>
      <p>.${safeFormat} model</p>
    </div>
    <div class="model-card-actions">
      <button class="btn-ar-small" data-action="ar" data-model-id="${safeId}">
        <span class="material-icons-round">view_in_ar</span> AR
      </button>
      <button class="btn-qr-small" data-action="qr" data-model-id="${safeId}">
        <span class="material-icons-round">qr_code_2</span> QR
      </button>
    </div>
  `;

  // Click on card to open detail
  card.querySelector('.model-card-thumb').addEventListener('click', () => openModelDetail(model));
  card.querySelector('.model-card-info').addEventListener('click', () => openModelDetail(model));

  // AR button
  card.querySelector('[data-action="ar"]').addEventListener('click', (e) => {
    e.stopPropagation();
    state.selectedModel = model;
    showView('ar-viewer');
    setTimeout(() => placeHologramInAR(model), 1000);
  });

  // QR button
  card.querySelector('[data-action="qr"]').addEventListener('click', (e) => {
    e.stopPropagation();
    openModelDetail(model);
    setTimeout(() => {
      const qrContainer = document.getElementById('detail-qr-container');
      if (qrContainer) qrContainer.classList.remove('hidden');
      generateQRCode(model, document.getElementById('detail-qr-code'));
    }, 100);
  });

  return card;
}

function updateModelDrawer() {
  const drawer = document.getElementById('drawer-models-list');
  if (!drawer) return;
  drawer.innerHTML = '';

  state.models.forEach((model) => {
    const item = document.createElement('div');
    item.className = 'drawer-item';
    item.innerHTML = `
      <div class="drawer-item-icon">
        <span class="material-icons-round">view_in_ar</span>
      </div>
      <div class="drawer-item-info">
        <h4>${escapeHTML(model.name)}</h4>
        <p>${escapeHTML(model.description || '.glb model')}</p>
      </div>
    `;
    item.addEventListener('click', () => {
      state.selectedModel = model;
      placeHologramInAR(model);
      closeAllDrawers();
    });
    drawer.appendChild(item);
  });

  if (state.models.length === 0) {
    drawer.innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--text-muted)">
        <p>No models in your library</p>
      </div>`;
  }
}

function openModelDetail(model) {
  const modal = document.getElementById('model-detail-modal');
  if (!modal) return;

  document.getElementById('detail-model-name').textContent = model.name;
  document.getElementById('detail-model-desc').textContent = model.description || 'No description';

  const viewer = document.getElementById('detail-model-viewer');
  if (viewer && model.modelUrl) {
    viewer.setAttribute('src', model.modelUrl);
  }

  // Hide QR section initially
  const qrContainer = document.getElementById('detail-qr-container');
  if (qrContainer) qrContainer.classList.add('hidden');

  // Set up action buttons
  document.getElementById('btn-detail-ar').onclick = () => {
    state.selectedModel = model;
    closeAllModals();
    showView('ar-viewer');
    setTimeout(() => placeHologramInAR(model), 1000);
  };

  document.getElementById('btn-detail-qr').onclick = () => {
    if (qrContainer) {
      qrContainer.classList.toggle('hidden');
      if (!qrContainer.classList.contains('hidden')) {
        generateQRCode(model, document.getElementById('detail-qr-code'));
      }
    }
  };

  document.getElementById('btn-detail-delete').onclick = () => {
    if (confirm(`Delete "${model.name}"?`)) {
      deleteModel(model.id);
    }
  };

  modal.classList.remove('hidden');
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
}

function closeAllDrawers() {
  document.querySelectorAll('.drawer').forEach((d) => d.classList.add('hidden'));
}

// ============================================
// Capture Screenshot
// ============================================
function captureARScreenshot() {
  const isProjection = state.currentView === 'projection';
  const video = document.getElementById(isProjection ? 'proj-video' : 'ar-video');
  const canvas3d = document.getElementById(isProjection ? 'proj-canvas' : 'ar-canvas');
  if (!video) return;

  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = video.videoWidth || 1920;
  captureCanvas.height = video.videoHeight || 1080;
  const ctx = captureCanvas.getContext('2d');

  // Draw video frame
  ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

  // Overlay 3D canvas
  if (canvas3d) {
    ctx.drawImage(canvas3d, 0, 0, captureCanvas.width, captureCanvas.height);
  }

  // Add watermark
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText('HoloView AR', 16, captureCanvas.height - 16);

  // Download
  const link = document.createElement('a');
  link.download = `holoview_capture_${Date.now()}.png`;
  link.href = captureCanvas.toDataURL('image/png');
  link.click();

  showToast('Screenshot saved!', 'success');
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
  // Auth forms
  document.getElementById('form-login')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    handleLogin(email, password);
  });

  document.getElementById('form-register')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    handleRegister(name, email, password);
  });

  // Auth toggle
  document.getElementById('show-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('form-login')?.classList.add('hidden');
    document.getElementById('form-register')?.classList.remove('hidden');
  });

  document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('form-register')?.classList.add('hidden');
    document.getElementById('form-login')?.classList.remove('hidden');
  });

  // Google auth
  document.getElementById('btn-google-login')?.addEventListener('click', handleGoogleAuth);
  document.getElementById('btn-google-register')?.addEventListener('click', handleGoogleAuth);

  // Navigation
  document.querySelectorAll('[data-navigate]').forEach((el) => {
    el.addEventListener('click', () => {
      const target = el.dataset.navigate;
      showView(target);
    });
  });

  // Profile & Logout
  document.getElementById('btn-profile')?.addEventListener('click', () => showView('profile'));
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
  document.getElementById('btn-install')?.addEventListener('click', handleInstall);

  // Upload
  const uploadModal = document.getElementById('upload-modal');
  document.getElementById('btn-upload')?.addEventListener('click', () => {
    uploadModal?.classList.remove('hidden');
  });
  document.getElementById('btn-upload-first')?.addEventListener('click', () => {
    uploadModal?.classList.remove('hidden');
  });

  // Upload zone
  const uploadZone = document.getElementById('upload-zone');
  const modelFileInput = document.getElementById('model-file');

  uploadZone?.addEventListener('click', () => modelFileInput?.click());
  uploadZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });
  uploadZone?.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });
  uploadZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  modelFileInput?.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  document.getElementById('upload-remove')?.addEventListener('click', () => {
    const preview = document.getElementById('upload-preview');
    preview?.classList.add('hidden');
    if (modelFileInput) modelFileInput.value = '';
    uploadZone?.classList.remove('hidden');
    state.selectedFile = null;
  });

  // Upload form submit
  document.getElementById('form-upload')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('model-name').value;
    const desc = document.getElementById('model-description').value;
    const file = state.selectedFile;

    if (!file) {
      showToast('Please select a file', 'warning');
      return;
    }

    const progressBar = document.getElementById('upload-progress');
    const progressFill = document.getElementById('upload-progress-fill');
    if (progressBar) progressBar.classList.remove('hidden');
    if (progressFill) progressFill.style.width = '50%';

    await uploadModel(name, desc, file);

    if (progressFill) progressFill.style.width = '100%';
    setTimeout(() => {
      uploadModal?.classList.add('hidden');
      if (progressBar) progressBar.classList.add('hidden');
      if (progressFill) progressFill.style.width = '0%';
      // Reset form
      document.getElementById('form-upload')?.reset();
      document.getElementById('upload-preview')?.classList.add('hidden');
      uploadZone?.classList.remove('hidden');
      state.selectedFile = null;
    }, 500);
  });

  // Modal close buttons
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.closeModal;
      document.getElementById(modalId)?.classList.add('hidden');
    });
  });

  // Drawer close buttons
  document.querySelectorAll('[data-close-drawer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const drawerId = btn.dataset.closeDrawer;
      document.getElementById(drawerId)?.classList.add('hidden');
    });
  });

  // AR controls
  document.getElementById('ar-status')?.addEventListener('click', startARStream);
  document.getElementById('proj-status')?.addEventListener('click', startProjectionStream);

  document.getElementById('btn-select-model')?.addEventListener('click', () => {
    document.getElementById('model-drawer')?.classList.remove('hidden');
  });
  document.getElementById('btn-proj-select-model')?.addEventListener('click', () => {
    document.getElementById('model-drawer')?.classList.remove('hidden');
  });

  document.getElementById('btn-ar-anchor')?.addEventListener('click', () => {
    if (state.selectedModel) {
      placeHologramInAR(state.selectedModel);
    } else {
      showToast('Select a hologram first', 'warning');
    }
  });

  document.getElementById('btn-proj-place')?.addEventListener('click', () => {
    if (state.selectedModel && state.projScene) {
      // Place in projection scene
      const toRemove = state.projScene.children.filter((c) => c.userData?.isHologram);
      toRemove.forEach((c) => state.projScene.remove(c));
      placeHologramInProjection(state.selectedModel);
    } else {
      showToast('Select a hologram first', 'warning');
    }
  });

  document.getElementById('btn-ar-capture')?.addEventListener('click', captureARScreenshot);
  document.getElementById('btn-proj-capture')?.addEventListener('click', captureARScreenshot);

  // QR scanner result action
  document.getElementById('btn-qr-activate')?.addEventListener('click', () => {
    if (state.selectedModel) {
      showView('ar-viewer');
      setTimeout(() => placeHologramInAR(state.selectedModel), 1000);
    }
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });

  // Handle resize for AR canvases
  window.addEventListener('resize', handleResize);

  // Prevent double-tap zoom on iOS
  document.addEventListener('touchstart', () => {}, { passive: true });
}

function handleFileSelect(file) {
  const validExts = ['glb', 'usdz', 'gltf'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!validExts.includes(ext)) {
    showToast('Invalid file type. Use .glb, .usdz, or .gltf', 'error');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    showToast('File too large. Maximum 50MB', 'error');
    return;
  }

  state.selectedFile = file;
  const preview = document.getElementById('upload-preview');
  const filename = document.getElementById('upload-filename');
  const zone = document.getElementById('upload-zone');

  if (preview) preview.classList.remove('hidden');
  if (filename) filename.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  if (zone) zone.classList.add('hidden');
}

function placeHologramInProjection(model) {
  if (!state.projScene || !window.THREE) return;

  if (model.modelUrl) {
    const loader = new THREE.GLTFLoader();
    loader.load(
      model.modelUrl,
      (gltf) => {
        const scene = gltf.scene;
        scene.userData.isHologram = true;
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        scene.scale.set(scale, scale, scale);
        const center = box.getCenter(new THREE.Vector3());
        scene.position.sub(center.multiplyScalar(scale));
        addHolographicEffect(scene);
        state.projScene.add(scene);
        showToast(`${model.name} projected`, 'success');
      },
      undefined,
      () => {
        // Fallback placeholder
        const geometry = new THREE.IcosahedronGeometry(1, 1);
        const material = new THREE.MeshPhongMaterial({
          color: 0xff6b6b,
          emissive: 0xff6b6b,
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.8,
          wireframe: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.isHologram = true;
        state.projScene.add(mesh);
        showToast(`${model.name} projected`, 'success');
      }
    );
  }
}

function handleResize() {
  const arCanvas = document.getElementById('ar-canvas');
  if (arCanvas && state.arRenderer) {
    const container = arCanvas.parentElement;
    arCanvas.width = container.clientWidth;
    arCanvas.height = container.clientHeight;
    state.arRenderer.setSize(container.clientWidth, container.clientHeight);
    if (state.arCamera) {
      state.arCamera.aspect = container.clientWidth / container.clientHeight;
      state.arCamera.updateProjectionMatrix();
    }
  }

  const projCanvas = document.getElementById('proj-canvas');
  if (projCanvas && state.projRenderer) {
    const container = projCanvas.parentElement;
    projCanvas.width = container.clientWidth;
    projCanvas.height = container.clientHeight;
    state.projRenderer.setSize(container.clientWidth, container.clientHeight);
    if (state.projCamera) {
      state.projCamera.aspect = container.clientWidth / container.clientHeight;
      state.projCamera.updateProjectionMatrix();
    }
  }
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', initApp);
