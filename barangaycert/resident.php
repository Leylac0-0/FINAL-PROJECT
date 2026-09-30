<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BarangayCert System - Resident Portal</title>
  <link rel="stylesheet" href="style.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <!-- HTML5 Camera QR Code Scanner Library -->
  <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
</head>
<body>

  <!-- Top Navigation Header -->
  <header class="navbar">
    <div class="logo">
      <span class="title">BarangayCert System</span>
    </div>
   
  <div class="nav-actions">
      <button type="button" id="btn-logout" class="btn-logout" onclick="fetch('api/auth/logout', { method: 'POST' }).then(function () { location.reload(); });">Logout</button>
    </div>
  </header>

  <!-- AUTHENTICATION MODAL (Password-Based Access) -->
  <div id="auth-modal" class="modal-overlay">
    <div class="modal-box">
      <!-- Back Navigation Link -->
      <div class="modal-header-nav">
        <a href="index.php" class="btn-back">
          <svg viewBox="0 0 24 24" class="back-icon">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Back to Portals
        </a>
      </div>

      <h2 id="auth-title">Resident Portal Access</h2>
      <div class="auth-tabs">
        <button id="tab-login" class="auth-tab-btn active" onclick="toggleAuthMode('login')">Login</button>
        <button id="tab-register" class="auth-tab-btn" onclick="toggleAuthMode('register')">Register Profile</button>
      </div>

      <form id="auth-form">
        <div class="form-group">
          <label for="auth-username">Username or Identifier</label>
          <input type="text" id="auth-username" placeholder="Enter username" required>
        </div>

        <div class="form-group">
          <label for="auth-password">Password</label>
          <input type="password" id="auth-password" placeholder="Enter password" required>
        </div>
        
        <div id="register-fields" class="hidden">
          <div class="form-group">
            <label for="reg-name">Full Name</label>
            <input type="text" id="reg-name" placeholder="Given Name Surname">
          </div>
          <div class="form-group">
            <label for="reg-category">Category Profiling</label>
            <select id="reg-category">
              <option value="General Resident">General Resident</option>
              <option value="Senior Citizen">Senior Citizen</option>
              <option value="PWD / Solo Parent">PWD / Solo Parent</option>
            </select>
          </div>
        </div>

        <p id="auth-error" class="error-msg hidden">Incorrect password or user not found!</p>

        <button type="submit" id="auth-submit-btn" class="btn-primary">Login to Account</button>
      </form>
    </div>
  </div>

  <!-- Main Container -->
  <main class="container">

    <!-- RESIDENT PORTAL VIEW -->
    <div id="resident-view" class="portal-view">
      
      <!-- Request Form -->
      <div class="card">
        <h2>Online Document Request</h2>
        <div id="user-welcome" class="user-welcome-text">Not logged in</div>
        <form id="request-form">
          <div class="form-group">
            <label for="document">Document Needed</label>
            <select id="document">
              <option value="Barangay Clearance">Barangay Clearance</option>
              <option value="Certificate of Indigency">Certificate of Indigency</option>
              <option value="Certificate of Residency">Certificate of Residency</option>
            </select>
          </div>

          <div class="form-group">
            <label for="purpose">Purpose</label>
            <input type="text" id="purpose" placeholder="e.g. Employment / Local Assistance" required>
          </div>

          <button type="submit" class="btn-primary">Submit Request to Secretary</button>
        </form>
      </div>

      <!-- Receipt Card -->
      <div class="card">
        <h2>Digital Request Receipt & QR</h2>
        <p class="subtitle">Once reviewed & approved by the Secretary, your official QR Verification code will display here.</p>
        
        <div id="receipt-box" class="placeholder-box">
          <div id="status-message" class="status-info-text">No active document request submitted</div>
          <div id="qr-container" class="qr-container hidden">
            <div id="qrcode-wrapper" style="background: #ffffff; padding: 16px; border-radius: 8px; display: inline-block; border: 1px solid #cbd5e1;">
              <div id="qrcode"></div>
            </div>
            <p id="tracking-info" class="tracking-text"></p>
          </div>
        </div>
      </div>

    </div>

  </main>

  <script src="script.js"></script>
  <script src="details.js"></script>
</body>
</html>