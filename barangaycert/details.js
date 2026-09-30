/* Resident only: after a normal login, ask
   "Would you like to update your profile information?" (Yes / No).
   Works on top of script.js (does not modify it). Load AFTER script.js. */
(function () {
  const modal = document.getElementById('auth-modal');
  if (!modal) return;

  // ---- small self-contained styles ----
  const style = document.createElement('style');
  style.textContent = `
    .details-btn-row { display: flex; gap: 10px; margin-top: 20px; }
    .details-btn-row button { flex: 1; }
    .btn-secondary {
      width: 100%; padding: 12px; border-radius: 6px; font-weight: 700; font-size: 0.95rem;
      cursor: pointer; color: #ffffff; background: transparent; border: 1px solid var(--border-color);
      transition: all 0.2s ease-in-out;
    }
    .btn-secondary:hover { border-color: var(--text-muted); transform: translateY(-1px); }
    .details-text { color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; }
    .details-text strong { color: var(--text-main); }
  `;
  document.head.appendChild(style);

  // Only ask after a real LOGIN (not after registering, not on page refresh)
  let justLoggedIn = false;
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'auth-form') {
      justLoggedIn = !isRegisterMode;
    }
  }, true);

  new MutationObserver(function () {
    if (justLoggedIn && modal.classList.contains('hidden') && currentUser) {
      justLoggedIn = false;
      showAskPrompt();
    }
  }).observe(modal, { attributes: true, attributeFilter: ['class'] });

  function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'details-modal';
    const box = document.createElement('div');
    box.className = 'modal-box';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    return { overlay, box };
  }

  // Step 1: Yes / No question
  function showAskPrompt() {
    const { overlay, box } = buildOverlay();

    const title = document.createElement('h2');
    title.textContent = 'Would you like to update your profile information?';
    title.style.marginBottom = '12px';

    const info = document.createElement('p');
    info.className = 'details-text';
    info.innerHTML = 'Please review your current information on file:<br><br>Full Name: <strong></strong><br>Category: <strong></strong>';
    const strongs = info.querySelectorAll('strong');
    strongs[0].textContent = currentUser.name;
    strongs[1].textContent = currentUser.category;

    const row = document.createElement('div');
    row.className = 'details-btn-row';

    const yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'btn-primary';
    yes.textContent = 'Yes';
    yes.onclick = function () { showEditForm(overlay, box); };

    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'btn-secondary';
    no.textContent = 'No';
    no.onclick = function () { overlay.remove(); };

    row.append(yes, no);
    box.append(title, info, row);
  }

  // Step 2: edit form
  function showEditForm(overlay, box) {
    box.innerHTML = '';

    const title = document.createElement('h2');
    title.textContent = 'Update Profile Information';
    title.style.marginBottom = '16px';

    const form = document.createElement('form');
    form.innerHTML = `
      <div class="form-group">
        <label for="edit-name">Full Name</label>
        <input type="text" id="edit-name" required>
      </div>
      <div class="form-group">
        <label for="edit-category">Category Profiling</label>
        <select id="edit-category">
          <option value="General Resident">General Resident</option>
          <option value="Senior Citizen">Senior Citizen</option>
          <option value="PWD / Solo Parent">PWD / Solo Parent</option>
        </select>
      </div>
      <div class="form-group">
        <label for="edit-password">New Password (optional)</label>
        <input type="password" id="edit-password" placeholder="Leave blank to keep your current password">
      </div>
      <p id="edit-error" class="error-msg hidden"></p>
      <div class="details-btn-row">
        <button type="submit" class="btn-primary">Save Changes</button>
        <button type="button" class="btn-secondary" id="edit-cancel">Cancel</button>
      </div>
    `;
    box.append(title, form);

    form.querySelector('#edit-name').value = currentUser.name;
    form.querySelector('#edit-category').value = currentUser.category;
    form.querySelector('#edit-cancel').onclick = function () { overlay.remove(); };

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errorEl = form.querySelector('#edit-error');
      errorEl.classList.add('hidden');

      try {
        const updated = await apiCall('/auth/profile', 'PATCH', {
          name: form.querySelector('#edit-name').value.trim(),
          category: form.querySelector('#edit-category').value,
          password: form.querySelector('#edit-password').value
        });

        currentUser = updated;
        const welcomeEl = document.getElementById('user-welcome');
        if (welcomeEl) {
          welcomeEl.innerText = `Logged in as: ${currentUser.name} (${currentUser.category})`;
        }
        overlay.remove();
      } catch (err) {
        errorEl.innerText = err.message || 'Could not save your changes. Please try again.';
        errorEl.classList.remove('hidden');
      }
    });
  }
})();
