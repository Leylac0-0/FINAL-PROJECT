// Dynamic Application State
let currentUser = null;
let requestsList = [];
let isRegisterMode = false;
let html5QrCodeScanner = null;
let isCameraActive = false;

// API Base URL - Update this string kung saan natin hohost yung database shits
const API_BASE_URL = '/api';

// Generic Fetch Wrapper para dynamic ang communication sa database
async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Call Error [${method} ${endpoint}]:`, error);
    throw error;
  }
}

// Pagka-load na pagka-load ng page, auto-calculate ng metrics at check dynamic requests
document.addEventListener("DOMContentLoaded", async function () {
  await checkSession();
  await updateMetricsUI();
  await renderAllRequests();
  await checkResidentLatestRequest(); // Auto check kung anong latest request ni resident
});

// Lumabas ka blurred login modal pag walang nakalog-in na feeling hero (Check session sa DB)
async function checkSession() {
  const authModal = document.getElementById('auth-modal');
  try {
    const user = await apiCall('/auth/me');
    currentUser = user;

    if (currentUser) {
      const welcomeEl = document.getElementById('user-welcome');
      if (welcomeEl) {
        welcomeEl.innerText = `Logged in as: ${currentUser.name} (${currentUser.category})`;
      }
      if (authModal) authModal.classList.add('hidden');
    }
  } catch (err) {
    currentUser = null;
    if (authModal) authModal.classList.remove('hidden');
  }
}

// Metric cards: kung ilan lang nag log in na RESIDENTS galing sa database (exclude Barangay Officials/Secretary)
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

// Switching effects sa Login at Register forms (magic visual switch)
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
  if (errorMsg) errorMsg.classList.add('hidden');
}

// Password Authentication at User Registration Handler guard nung database parang guard sa parking ng tip
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

        // Dito na natatago sa database stash yung bagong user
        currentUser = await apiCall('/auth/register', 'POST', {
          username,
          password,
          name,
          category
        });

        await updateMetricsUI();
        toggleAuthMode('login');
      } else {
        // Hinahanap si user sa database kung legit ang account o joke joke lang
        currentUser = await apiCall('/auth/login', 'POST', { username, password });
      }

      // Pag successful na naka-login, goodbye blur effect!
      if (errorMsg) errorMsg.classList.add('hidden');
      const welcomeEl = document.getElementById('user-welcome');
      if (welcomeEl) {
        welcomeEl.innerText = `Logged in as: ${currentUser.name} (${currentUser.category})`;
      }
      const authModal = document.getElementById('auth-modal');
      if (authModal) authModal.classList.add('hidden');

      authForm.reset();
      await checkResidentLatestRequest();
    } catch (err) {
      if (errorMsg) {
        errorMsg.innerText = err.message || "Invalid credentials! Bawal duplicate username o maling password.";
        errorMsg.classList.remove('hidden');
      }
    }
  });
}

// Document Request Submission (nag-iissue at nagpapasa sa DB ng fresh request)
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
      await apiCall('/requests', 'POST', {
        documentType,
        purpose
      });

      requestForm.reset();
      await checkResidentLatestRequest();
    } catch (err) {
      alert("Failed to submit request. Subukan ulit!");
    }
  });
}

// Eto ang taga-update ng status text o QR code receipt sa side ni Resident galing DB!
async function checkResidentLatestRequest() {
  const statusMsg = document.getElementById('status-message');
  const qrBox = document.getElementById('qr-container');
  if (!statusMsg) return; // Pag wala sa resident portal screen, kanya kanya na 

  if (!currentUser) {
    statusMsg.innerText = "Please login to view active requests.";
    if (qrBox) qrBox.classList.add('hidden');
    return;
  }

  try {
    // Filter dynamic requests para lang sa ongoing nakalog-in na resident galing database
    const userRequests = await apiCall('/requests/my-requests');

    if (!userRequests || userRequests.length === 0) {
      statusMsg.innerText = "No active document requests.";
      if (qrBox) qrBox.classList.add('hidden');
      return;
    }

    // Kunin yung pinaka-latest request submission
    const latestReq = userRequests[0];

    if (latestReq.status === 'PENDING') {
      statusMsg.classList.remove('hidden');
      statusMsg.className = 'status-info-text';
      statusMsg.style.color = '#1f2937';
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
      statusMsg.style.color = '#d90429';
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

// Render master list ng requests galing Database papuntang Secretary Table
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
        actionContent = `<span style="font-size:0.75rem; color: #3730a3;">Document Issued</span>`;
      }

      const row = document.createElement('tr');
      row.id = `row-${data.trackingId}`;
      row.innerHTML = `
        <td><strong>${data.trackingId}</strong></td>
        <td>${data.residentName}</td>
        <td>${data.documentType}</td>
        <td id="status-badge-${data.trackingId}">${statusBadge}</td>
        <td id="action-cell-${data.trackingId}">${actionContent}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Failed to render requests:", err);
  }
}

// Judge mode: Approve ba o Reject ang request ni resident? (save pabalik sa database)
async function reviewRequest(trackingId, isApproved) {
  try {
    const status = isApproved ? 'APPROVED' : 'REJECTED';
    await apiCall(`/requests/${trackingId}/status`, 'PATCH', { status });
    await renderAllRequests();
  } catch (err) {
    alert("Could not update request status.");
  }
}

// Button pambukas o pamsara ng camera scanner sa admin view
function toggleCameraScanner() {
  if (isCameraActive) {
    stopCameraScanner();
  } else {
    startCameraScanner();
  }
}

// Powerhouse scanner: Webcam reader gamit html5qrcode library
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
    (errorMessage) => {
      // Tuloy-tuloy lang ang scanning hanggang makakita ng QR...
    }
  ).then(() => {
    isCameraActive = true;
    if (camBtn) camBtn.innerText = "Close Camera Scanner";
  }).catch(err => {
    console.error("Camera access failed:", err);
    alert("Camera permission denied or camera unreadable.");
    scannerContainer.style.display = "none";
  });
}

// Patayin ang camera kapag tapos na mag-scan o kaya lumayas sa page
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

// Pag scan ng valid tracking code: Auto-print document & burst ng 'RELEASED' status badge yehey!
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

    // Update status to RELEASED in DB after print execution
    await apiCall(`/requests/${matchedReq.trackingId}/status`, 'PATCH', { status: 'RELEASED' });
    await renderAllRequests();
  } catch (err) {
    if (errorMsg) errorMsg.classList.remove('hidden');
  }
}