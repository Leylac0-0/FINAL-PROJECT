// Dynamic Application State
let currentUser = null;
let requestsList = [];
let isRegisterMode = false;
let html5QrCodeScanner = null;
let isCameraActive = false;

/* =====================================================================
   LOCAL "BACKEND" (localStorage)
   Replaces the missing /api server so login, requests, and metrics work
   with just static files. To use a real backend later, replace apiCall()
   with the fetch-based version.
   ===================================================================== */
const IS_SECRETARY_PAGE = !!document.getElementById('admin-view');
const SESSION_KEY = IS_SECRETARY_PAGE ? 'ltms_session_secretary' : 'ltms_session_resident';
const USERS_KEY = 'ltms_users';
const REQUESTS_KEY = 'ltms_requests';

const memoryStore = {};
const store = {
  get(k) {
    try { return window.localStorage.getItem(k); } catch { return memoryStore[k] ?? null; }
  },
  set(k, v) {
    try { window.localStorage.setItem(k, v); } catch { memoryStore[k] = v; }
  }
};

function dbGet(key) {
  try { return JSON.parse(store.get(key)) || []; } catch { return []; }
}
function dbSet(key, value) {
  store.set(key, JSON.stringify(value));
}
function publicUser(u) {
  return { username: u.username, name: u.name, category: u.category };
}
function getSessionUser() {
  const username = store.get(SESSION_KEY);
  if (!username) return null;
  return dbGet(USERS_KEY).find(u => u.username === username) || null;
}
function generateTrackingId() {
  const requests = dbGet(REQUESTS_KEY);
  let id;
  do {
    id = 'BC-' + Math.floor(1000 + Math.random() * 9000);
  } while (requests.some(r => r.trackingId === id));
  return id;
}

// Demo accounts so you can log in right away (only added when there are no users yet)
(function seedDemoAccounts() {
  if (dbGet(USERS_KEY).length === 0) {
    dbSet(USERS_KEY, [
      { username: 'resident', password: 'resident123', name: 'Juan Dela Cruz', category: 'General Resident' },
      { username: 'secretary', password: 'secretary123', name: 'Maria Santos', category: 'Secretary' }
    ]);
  }
})();

async function apiCall(endpoint, method = 'GET', body = null) {
  const users = dbGet(USERS_KEY);
  const requests = dbGet(REQUESTS_KEY);
  const session = getSessionUser();

  // ---- AUTH ----
  if (endpoint === '/auth/me') {
    if (!session) throw new Error('Not logged in');
    return publicUser(session);
  }

  if (endpoint === '/auth/register' && method === 'POST') {
    const { username, password, name, category } = body;
    if (!username || !password) throw new Error('Username and password are required.');
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('Username already taken!');
    }
    const isSecretary = category === 'Secretary';
    if (isSecretary !== IS_SECRETARY_PAGE) {
      throw new Error('Wrong portal for this account type.');
    }
    const newUser = { username, password, name, category };
    users.push(newUser);
    dbSet(USERS_KEY, users);
    // No auto-login: the user must log in after registering
    return publicUser(newUser);
  }

  if (endpoint === '/auth/login' && method === 'POST') {
    const { username, password } = body;
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      throw new Error('No account found with that username. Click "Register Profile" to create one.');
    }
    if (user.password !== password) {
      throw new Error('Incorrect password!');
    }
    const isSecretary = user.category === 'Secretary';
    if (isSecretary !== IS_SECRETARY_PAGE) {
      throw new Error(isSecretary
        ? 'This is a Secretary account. Please use the Secretary Portal.'
        : 'This is a Resident account. Please use the Resident Portal.');
    }
    store.set(SESSION_KEY, user.username);
    return publicUser(user);
  }

  // ---- METRICS (residents only, exclude Secretary) ----
  if (endpoint === '/metrics') {
    const residents = users.filter(u => u.category !== 'Secretary');
    return {
      total: residents.length,
      senior: residents.filter(u => u.category === 'Senior Citizen').length,
      pwd: residents.filter(u => u.category === 'PWD / Solo Parent').length
    };
  }

  // ---- REQUESTS ----
  if (endpoint === '/requests' && method === 'POST') {
    if (!session) throw new Error('Unauthorized');
    const newReq = {
      trackingId: generateTrackingId(),
      username: session.username,
      residentName: session.name,
      category: session.category,
      documentType: body.documentType,
      purpose: body.purpose,
      status: 'PENDING',
      createdAt: Date.now()
    };
    requests.push(newReq);
    dbSet(REQUESTS_KEY, requests);
    return newReq;
  }

  if (endpoint === '/requests/my-requests') {
    if (!session) throw new Error('Unauthorized');
    return requests
      .filter(r => r.username === session.username)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  if (endpoint === '/requests' && method === 'GET') {
    return [...requests].sort((a, b) => b.createdAt - a.createdAt);
  }

  let m = endpoint.match(/^\/requests\/verify\/(.+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]).trim();
    const found = requests.find(r => r.trackingId === id);
    if (!found) throw new Error('Request not found');
    return found;
  }

  m = endpoint.match(/^\/requests\/([^/]+)\/status$/);
  if (m && method === 'PATCH') {
    const req = requests.find(r => r.trackingId === m[1]);
    if (!req) throw new Error('Request not found');
    req.status = body.status;
    dbSet(REQUESTS_KEY, requests);
    return req;
  }

  throw new Error(`Unknown endpoint: ${method} ${endpoint}`);
}

// Escape user-provided text before injecting into HTML
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* =====================================================================
   PAGE LOGIC
   ===================================================================== */

document.addEventListener("DOMContentLoaded", async function () {
  if (store.mode === 'memory') {
    const box = document.querySelector('.modal-box');
    if (box) {
      const note = document.createElement('p');
      note.className = 'error-msg';
      note.textContent = 'Browser storage is blocked here, so accounts will be lost when you change pages. Open this project through a local server (e.g. VS Code Live Server) instead of double-clicking the files.';
      box.appendChild(note);
    }
  }
  await checkSession();
  await updateMetricsUI();
  await renderAllRequests();
  await checkResidentLatestRequest();
});

// Keep the two portals in sync if they're open in different tabs
window.addEventListener('storage', async (e) => {
  if (e.key === REQUESTS_KEY || e.key === USERS_KEY) {
    await updateMetricsUI();
    await renderAllRequests();
    await checkResidentLatestRequest();
  }
});

// Show login modal if nobody is logged in
async function checkSession() {
  const authModal = document.getElementById('auth-modal');
  try {
    const user = await apiCall('/auth/me');
    currentUser = user;

    const welcomeEl = document.getElementById('user-welcome');
    if (welcomeEl) {
      welcomeEl.innerText = `Logged in as: ${currentUser.name} (${currentUser.category})`;
    }
    if (authModal) authModal.classList.add('hidden');
  } catch (err) {
    currentUser = null;
    if (authModal) authModal.classList.remove('hidden');
  }
}

// Metric cards: registered residents only (excludes Secretary accounts)
async function updateMetricsUI() {
  const totalEl = document.getElementById('metric-total');
  const seniorEl = document.getElementById('metric-senior');
  const pwdEl = document.getElementById('metric-pwd');

  try {
    const metrics = await apiCall('/metrics');
    if (totalEl) totalEl.innerText = (metrics.total || 0).toLocaleString();
    if (seniorEl) seniorEl.innerText = (metrics.senior || 0).toLocaleString();
    if (pwdEl) pwdEl.innerText = (metrics.pwd || 0).toLocaleString();
  } catch (err) {
    console.error("Failed to load metrics:", err);
  }
}

// Switch between Login and Register tabs
function toggleAuthMode(mode) {
  isRegisterMode = mode === 'register';
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const regFields = document.getElementById('register-fields');
  const submitBtn = document.getElementById('auth-submit-btn');
  const errorMsg = document.getElementById('auth-error');

  if (tabLogin) tabLogin.classList.toggle('active', !isRegisterMode);
  if (tabRegister) tabRegister.classList.toggle('active', isRegisterMode);
  if (regFields) regFields.classList.toggle('hidden', !isRegisterMode);
  if (submitBtn) submitBtn.innerText = isRegisterMode ? 'Register Profile' : 'Login to Account';
  if (errorMsg) { errorMsg.classList.add('hidden'); errorMsg.style.color = ''; }
}

// Login / Register handler
const authForm = document.getElementById('auth-form');
if (authForm) {
  authForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const errorMsg = document.getElementById('auth-error');

    try {
      if (isRegisterMode) {
        const name = document.getElementById('reg-name').value.trim() || "Given Name Surname";
        const categoryInput = document.getElementById('reg-category');
        const category = categoryInput ? categoryInput.value : "General Resident";

        await apiCall('/auth/register', 'POST', { username, password, name, category });
        await updateMetricsUI();

        // Registered: go to the Login tab instead of logging in automatically
        authForm.reset();
        toggleAuthMode('login');
        document.getElementById('auth-username').value = username;
        if (errorMsg) {
          errorMsg.innerText = 'Registration successful! Please log in with your new account.';
          errorMsg.style.color = 'var(--success)';
          errorMsg.classList.remove('hidden');
        }
        document.getElementById('auth-password').focus();
        return;
      } else {
        currentUser = await apiCall('/auth/login', 'POST', { username, password });
      }

      if (errorMsg) errorMsg.classList.add('hidden');
      const welcomeEl = document.getElementById('user-welcome');
      if (welcomeEl) {
        welcomeEl.innerText = `Logged in as: ${currentUser.name} (${currentUser.category})`;
      }
      const authModal = document.getElementById('auth-modal');
      if (authModal) authModal.classList.add('hidden');

      authForm.reset();
      await checkResidentLatestRequest();
      await renderAllRequests();
    } catch (err) {
      if (errorMsg) {
        errorMsg.innerText = err.message || "Invalid credentials!";
        errorMsg.style.color = '';
        errorMsg.classList.remove('hidden');
      }
    }
  });
}

// Document request submission
const requestForm = document.getElementById('request-form');
if (requestForm) {
  requestForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!currentUser) {
      alert("Unauthorized! You must log in first.");
      const authModal = document.getElementById('auth-modal');
      if (authModal) authModal.classList.remove('hidden');
      return;
    }

    const documentType = document.getElementById('document').value;
    const purpose = document.getElementById('purpose').value;

    try {
      await apiCall('/requests', 'POST', { documentType, purpose });
      requestForm.reset();
      await checkResidentLatestRequest();
    } catch (err) {
      alert("Failed to submit request. Subukan ulit!");
    }
  });
}

// Resident side: status text / QR receipt
async function checkResidentLatestRequest() {
  const statusMsg = document.getElementById('status-message');
  const qrBox = document.getElementById('qr-container');
  if (!statusMsg) return;

  if (!currentUser) {
    statusMsg.innerText = "Please login to view active requests.";
    if (qrBox) qrBox.classList.add('hidden');
    return;
  }

  try {
    const userRequests = await apiCall('/requests/my-requests');

    if (!userRequests || userRequests.length === 0) {
      statusMsg.classList.remove('hidden');
      statusMsg.className = 'status-info-text';
      statusMsg.style.color = '';
      statusMsg.innerText = "No active document requests.";
      if (qrBox) qrBox.classList.add('hidden');
      return;
    }

    const latestReq = userRequests[0];

    if (latestReq.status === 'PENDING') {
      statusMsg.classList.remove('hidden');
      statusMsg.className = 'status-info-text';
      statusMsg.style.color = '#ffffff';
      statusMsg.innerText = `Request Submitted (${latestReq.trackingId}). Awaiting Secretary Review...`;
      if (qrBox) qrBox.classList.add('hidden');
    } else if (latestReq.status === 'APPROVED') {
      statusMsg.classList.add('hidden');
      if (qrBox) qrBox.classList.remove('hidden');

      const qrContainer = document.getElementById('qrcode');
      if (qrContainer) {
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
          text: latestReq.trackingId,
          width: 200,
          height: 200,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
      }

      const trackInfo = document.getElementById('tracking-info');
      if (trackInfo) trackInfo.innerText = `Tracking ID: ${latestReq.trackingId} (${latestReq.documentType})`;
    } else if (latestReq.status === 'REJECTED') {
      if (qrBox) qrBox.classList.add('hidden');
      statusMsg.classList.remove('hidden');
      statusMsg.className = 'status-info-text';
      statusMsg.style.color = '#ef4444';
      statusMsg.innerText = `Request (${latestReq.trackingId}) was REJECTED by the Secretary.`;
    } else if (latestReq.status === 'RELEASED') {
      if (qrBox) qrBox.classList.add('hidden');
      statusMsg.classList.remove('hidden');
      statusMsg.className = 'status-info-text';
      statusMsg.style.color = '#10b981';
      statusMsg.innerText = `Document (${latestReq.trackingId}) has been successfully ISSUED & RELEASED.`;
    }
  } catch (err) {
    console.error("Failed to check status:", err);
  }
}

// Secretary side: request table
async function renderAllRequests() {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;

  try {
    requestsList = await apiCall('/requests');

    tbody.innerHTML = '';

    if (!requestsList || requestsList.length === 0) {
      tbody.innerHTML = `
        <tr id="empty-table-row">
          <td colspan="5" style="text-align: center; color: #6b7280; padding: 20px;">No incoming document requests</td>
        </tr>
      `;
      return;
    }

    requestsList.forEach(data => {
      let statusBadge = `<span class="badge badge-pending">PENDING</span>`;
      let actionContent = `
        <button class="btn-sm btn-approve" onclick="reviewRequest('${data.trackingId}', true)">Approve</button>
        <button class="btn-sm btn-reject" onclick="reviewRequest('${data.trackingId}', false)">Reject</button>
      `;

      if (data.status === 'APPROVED') {
        statusBadge = `<span class="badge badge-success">APPROVED</span>`;
        actionContent = `<span style="font-size:0.75rem; color: #10b981;">Ready for Counter</span>`;
      } else if (data.status === 'REJECTED') {
        statusBadge = `<span class="badge badge-danger">REJECTED</span>`;
        actionContent = `<span style="font-size:0.75rem; color: #ef4444;">Rejected</span>`;
      } else if (data.status === 'RELEASED') {
        statusBadge = `<span class="badge badge-released">RELEASED</span>`;
        actionContent = `<span style="font-size:0.75rem; color: #818cf8;">Document Issued</span>`;
      }

      const row = document.createElement('tr');
      row.id = `row-${data.trackingId}`;
      row.innerHTML = `
        <td><strong>${escapeHtml(data.trackingId)}</strong></td>
        <td>${escapeHtml(data.residentName)}</td>
        <td>${escapeHtml(data.documentType)}</td>
        <td id="status-badge-${data.trackingId}">${statusBadge}</td>
        <td id="action-cell-${data.trackingId}">${actionContent}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Failed to render requests:", err);
  }
}

// Approve / Reject
async function reviewRequest(trackingId, isApproved) {
  try {
    const status = isApproved ? 'APPROVED' : 'REJECTED';
    await apiCall(`/requests/${trackingId}/status`, 'PATCH', { status });
    await renderAllRequests();
  } catch (err) {
    alert("Could not update request status.");
  }
}

// Camera scanner toggle
function toggleCameraScanner() {
  if (isCameraActive) {
    stopCameraScanner();
  } else {
    startCameraScanner();
  }
}

function startCameraScanner() {
  const scannerContainer = document.getElementById("qr-reader");
  const camBtn = document.getElementById("btn-toggle-camera");
  if (!scannerContainer) return;

  scannerContainer.style.display = "block";

  if (!html5QrCodeScanner) {
    html5QrCodeScanner = new Html5Qrcode("qr-reader");
  }

  html5QrCodeScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 220, height: 220 } },
    (decodedText) => {
      const scanInput = document.getElementById("scan-input");
      if (scanInput) scanInput.value = decodedText;
      stopCameraScanner();
      verifyAndPrint();
    },
    () => { /* keep scanning until a QR is found */ }
  ).then(() => {
    isCameraActive = true;
    if (camBtn) camBtn.innerText = "Close Camera Scanner";
  }).catch(err => {
    console.error("Camera access failed:", err);
    alert("Camera permission denied or camera unreadable.");
    scannerContainer.style.display = "none";
  });
}

function stopCameraScanner() {
  const scannerContainer = document.getElementById("qr-reader");
  const camBtn = document.getElementById("btn-toggle-camera");

  if (html5QrCodeScanner && isCameraActive) {
    html5QrCodeScanner.stop().then(() => {
      if (scannerContainer) scannerContainer.style.display = "none";
      isCameraActive = false;
      if (camBtn) camBtn.innerText = "Open Camera Scanner";
    }).catch(err => console.error("Error stopping camera:", err));
  }
}

// Verify tracking code, print, then mark RELEASED
async function verifyAndPrint() {
  const scanInputEl = document.getElementById('scan-input');
  if (!scanInputEl) return;

  const scanInput = scanInputEl.value.trim();
  const errorMsg = document.getElementById('scan-error');

  try {
    const matchedReq = await apiCall(`/requests/verify/${encodeURIComponent(scanInput)}`);

    if (!matchedReq || matchedReq.status !== 'APPROVED') {
      if (errorMsg) errorMsg.classList.remove('hidden');
      return;
    }

    if (errorMsg) errorMsg.classList.add('hidden');

    const titleEl = document.getElementById('print-doc-title');
    const nameEl = document.getElementById('print-name');
    const categoryEl = document.getElementById('print-category');
    const purposeEl = document.getElementById('print-purpose');

    if (titleEl) titleEl.innerText = (matchedReq.documentType || "").toUpperCase();
    if (nameEl) nameEl.innerText = matchedReq.residentName || "Given Name Surname";
    if (categoryEl) categoryEl.innerText = matchedReq.category;
    if (purposeEl) purposeEl.innerText = matchedReq.purpose;

    window.print();

    await apiCall(`/requests/${matchedReq.trackingId}/status`, 'PATCH', { status: 'RELEASED' });
    await renderAllRequests();
    scanInputEl.value = '';
  } catch (err) {
    if (errorMsg) errorMsg.classList.remove('hidden');
  }
}