<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LTMS Portal Selector</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body class="split-screen-body">

  <!-- Resident Side -->
  <a href="resident.php" class="portal-option resident-side">
    <div class="avatar-wrapper">
      <!-- Resident Line Icon -->
      <svg class="avatar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </div>
    <h1 class="portal-title">Resident Portal</h1>
    <button class="select-btn">Access Portal</button>
  </a>

  <!-- Secretary Side -->
  <a href="secretary.php" class="portal-option secretary-side">
    <div class="avatar-wrapper">
      <!-- Secretary Line Icon -->
      <svg class="avatar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
        <path d="M9 12h6"></path>
        <path d="M9 16h6"></path>
      </svg>
    </div>
    <h1 class="portal-title">Secretary Portal</h1>
    <button class="select-btn">Access Portal</button>
  </a>

</body>
</html>