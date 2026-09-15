const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_API_KEY = window.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY';
const USER_KEY = 'fitflow-user';
const DIRECTORY_KEY = 'fitflow-directory';
const DIRECTORY_STATUS_KEY = 'fitflow-directory-status';

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const userStatus = document.getElementById('user-status');
const googleLoginHeader = document.getElementById('google-login-header');
const resultPanel = document.getElementById('result-panel');
const resultContent = document.getElementById('result-content');
const directoryInput = document.getElementById('directory-id');
const rememberDirectory = document.getElementById('remember-directory');
const directorySettings = document.getElementById('directory-settings');
const directorySettingsButton = document.getElementById('directory-settings-button');
const directorySettingsAlert = document.getElementById('directory-settings-alert');
const directoryValidationResult = document.getElementById('directory-validation-result');
const closeDirectorySettings = document.getElementById('close-directory-settings');
const quizPanel = document.getElementById('quiz-panel');
const proposedFields = document.getElementById('proposed-fields');

let accessToken = null;
let tokenClient = null;

const trainingMap = {
  forca: {
    label: 'Força',
    intro: 'Treball principal de força i hipertrofia.',
    blocks: ['3 x 6-8 sentadillas', '3 x 8-10 press de banca', '3 x 10 rems', '3 x 12-15 elevacions de cames']
  },
  mobilitat: {
    label: 'Mobilitat',
    intro: 'Treball de mobilitat articular i activació.',
    blocks: ['5 min mobilitat de maluc', '3 rondes de 30s rotació de columna', '2 rondes de 30s estiraments de cames', '5 min respiració i relaxació']
  },
  forcaMobilitat: {
    label: 'Força + mobilitat',
    intro: 'Combina resistència amb mobilitat per mantenir el moviment net.',
    blocks: ['3 x 8 press militar', '3 x 10 pesos morts', '2 rondes de 45s mobilitat de turmell', '2 rondes de 45s hip mobility']
  }
};

const focusMap = {
  superior: 'part superior',
  core: 'core',
  inferior: 'part inferior',
  fullbody: 'full body',
  recuperacio: 'recuperació i mobilitat'
};

function showApp() {
  if (loginScreen) loginScreen.classList.add('hidden');
  if (appScreen) appScreen.classList.remove('hidden');
  if (googleLoginHeader) {
    googleLoginHeader.classList.toggle('hidden', !!localStorage.getItem(USER_KEY));
  }
}

function showLogin() {
  if (appScreen) appScreen.classList.add('hidden');
  if (loginScreen) loginScreen.classList.remove('hidden');
  if (googleLoginHeader) {
    googleLoginHeader.classList.remove('hidden');
  }
}

function setAccessStatus(isAuthenticated) {
  if (!userStatus) return;

  if (isAuthenticated) {
    userStatus.textContent = 'Autenticat';
    userStatus.classList.remove('offline');
    userStatus.classList.add('online');
    return;
  }

  userStatus.textContent = 'No autenticat';
  userStatus.classList.remove('online');
  userStatus.classList.add('offline');
}

function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  userStatus.textContent = `Autenticat: ${user.name}`;
  userStatus.classList.remove('offline');
  userStatus.classList.add('online');
}

function clearUser() {
  localStorage.removeItem(USER_KEY);
  accessToken = null;
  setAccessStatus(false);
  showLogin();
}

function hasValidDirectory() {
  return Boolean(directoryInput?.value.trim())
    && localStorage.getItem(DIRECTORY_STATUS_KEY) === 'valid';
}

function setDirectoryStatus(isValid) {
  if (isValid) {
    localStorage.setItem(DIRECTORY_STATUS_KEY, 'valid');
    directorySettingsAlert?.classList.add('hidden');
    return;
  }

  localStorage.setItem(DIRECTORY_STATUS_KEY, 'invalid');
  directorySettingsAlert?.classList.remove('hidden');
}

function updateDirectoryFlow(openSettings = false) {
  const validDirectory = hasValidDirectory();
  directorySettingsAlert?.classList.toggle('hidden', validDirectory);

  if (validDirectory && !openSettings) {
    directorySettings?.classList.add('hidden');
    quizPanel?.classList.remove('hidden');
    directorySettingsButton?.setAttribute('aria-expanded', 'false');
    return;
  }

  directorySettings?.classList.remove('hidden');
  directorySettingsButton?.setAttribute('aria-expanded', 'true');
  if (!validDirectory) {
    quizPanel?.classList.add('hidden');
  }
}

function loadDirectoryPreference() {
  const saved = localStorage.getItem(DIRECTORY_KEY);
  if (saved) {
    directoryInput.value = saved;
    rememberDirectory.checked = true;
  }
}

function saveDirectoryPreference() {
  const directoryValue = directoryInput.value.trim();
  if (!directoryValue) {
    directoryValidationResult.innerHTML = '<strong>Falta el directori.</strong><br />Indica una URL o ID de Google Drive.';
    setDirectoryStatus(false);
    updateDirectoryFlow(true);
    return;
  }

  if (rememberDirectory.checked) {
    localStorage.setItem(DIRECTORY_KEY, directoryValue);
  } else {
    localStorage.removeItem(DIRECTORY_KEY);
  }

  validateDriveDirectory(directoryValue);
}

function toggleModeFields() {
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'propio';
  proposedFields.classList.toggle('hidden', mode === 'propio');
}

function createWorkoutPlan(formData) {
  const mode = formData.get('mode');

  if (mode === 'propio') {
    return `
      <h3>Entrenament propi</h3>
      <p>Has seleccionat llegir el teu propi entrenament des del directori autoritzat.</p>
      <p><strong>Directori seleccionat:</strong> ${directoryInput.value.trim() || 'No definit'}</p>
      <p><strong>Accés:</strong> ${userStatus.textContent}</p>
    `;
  }

  const trainingType = formData.get('trainingType') || 'forca';
  const duration = Number(formData.get('duration') || 30);
  const focus = formData.get('focus') || 'fullbody';
  const plan = trainingMap[trainingType];

  return `
    <h3>${plan.label}</h3>
    <p><strong>Durada:</strong> ${duration} minuts</p>
    <p><strong>Zona:</strong> ${focusMap[focus]}</p>
    <p><strong>Objectiu:</strong> ${plan.intro}</p>
    <ul>
      ${plan.blocks
        .map((block, index) => `<li>${index === 0 ? 'Calentament' : `Bloc ${index}`}: ${block}</li>`)
        .join('')}
      <li>3-5 min de cooldown i estiraments finals.</li>
    </ul>
  `;
}

function extractGoogleId(value) {
  if (!value) return null;

  const normalized = value.trim();
  const patterns = [
    /[?&]id=([^&#]+)/,
    /[?&]folderid=([^&#]+)/i,
    /drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]+)/i,
    /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/i,
    /docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/i,
    /[A-Za-z0-9_-]{10,}/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }

  return null;
}

function requestDriveAccess(prompt = 'consent') {
  if (!tokenClient) {
    console.warn('Google token client no està preparat.');
    return;
  }

  tokenClient.requestAccessToken({ prompt });
}

function setupGoogleAuth() {
  if (!window.google || !window.google.accounts) {
    console.warn('Google Identity Services encara no està disponible.');
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    callback: (response) => {
      accessToken = response.access_token || null;
      if (accessToken) {
        setAccessStatus(true);
        googleLoginHeader?.classList.add('hidden');
      }
    },
    error_callback: () => {
      accessToken = null;
      setAccessStatus(false);
      googleLoginHeader?.classList.remove('hidden');
    }
  });

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
    context: 'signin'
  });

  google.accounts.id.renderButton(document.getElementById('google-login-btn'), {
    theme: 'outline',
    size: 'large',
    width: '100%',
    text: 'continue_with'
  });

  if (googleLoginHeader) {
    google.accounts.id.renderButton(googleLoginHeader, {
      theme: 'outline',
      size: 'large',
      width: '180',
      text: 'continue_with'
    });
  }
}

function handleCredentialResponse(response) {
  if (!response.credential) {
    return;
  }

  const payload = JSON.parse(
    atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
  );

  const user = {
    name: payload.name || payload.given_name || 'Usuari',
    email: payload.email || 'sense-email@google.com'
  };

  setUser(user);
  requestDriveAccess();
  showApp();
  loadDirectoryPreference();
  updateDirectoryFlow();
}

async function validateDriveDirectory(rawUrl) {
  const resultBox = directoryValidationResult;
  const url = rawUrl.trim();
  const id = extractGoogleId(url);

  if (!url || !id) {
    resultBox.innerHTML = '<strong>Directori no vàlid.</strong><br />Indica una URL o ID de Google Drive vàlid.';
    setDirectoryStatus(false);
    updateDirectoryFlow(true);
    return;
  }

  if (!accessToken) {
    resultBox.innerHTML = `
      <strong>Primer has d’iniciar sessió amb Google.</strong><br />
      Necessitem autoritzar l’accés a Google Drive per poder llegir el directori o full compartit.
    `;
    setDirectoryStatus(false);
    updateDirectoryFlow(true);
    return;
  }

  try {
    const query = encodeURIComponent(`'${id}' in parents and trashed=false`);
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType),nextPageToken&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      let details = '';
      try {
        const errorData = await response.json();
        details = errorData.error?.message || '';
      } catch {
        details = response.statusText;
      }

      const error = new Error(details || 'Google Drive ha rebutjat la petició.');
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const files = data.files || [];
    const carpetes = files.filter((item) => item.mimeType === 'application/vnd.google-apps.folder').length;
    const fitxers = files.filter((item) => item.mimeType !== 'application/vnd.google-apps.folder').length;

    resultBox.innerHTML = `
      <strong>Validació correcta.</strong><br />
      <strong>ID:</strong> ${id}<br />
      <strong>Fitxers:</strong> ${fitxers}<br />
      <strong>Carpetes:</strong> ${carpetes}<br />
      <strong>Accés:</strong> autoritzat amb Google OAuth.
    `;
    setDirectoryStatus(true);
    setAccessStatus(true);
    updateDirectoryFlow();
  } catch (error) {
    resultBox.innerHTML = `
      <strong>No s’ha pogut validar el directori.</strong><br />
      Pot passar perquè el link no és accessible per aquest compte, perquè la carpeta no està compartida correctament o perquè falta autorització.
      <small>Error ${error.status || ''}: ${error.message}</small>
    `;
    setDirectoryStatus(false);
    updateDirectoryFlow(true);
    if (error.status === 401) {
      accessToken = null;
      setAccessStatus(false);
      googleLoginHeader?.classList.remove('hidden');
    }
  }
}

function initApp() {
  const directoryForm = document.getElementById('directory-form');
  const trainerForm = document.getElementById('trainer-form');

  if (directoryForm) {
    directoryForm.addEventListener('submit', (event) => {
      event.preventDefault();
      saveDirectoryPreference();
    });
  }

  directorySettingsButton?.addEventListener('click', () => {
    if (directorySettings?.classList.contains('hidden')) {
      updateDirectoryFlow(true);
      return;
    }

    if (hasValidDirectory()) {
      updateDirectoryFlow();
    }
  });

  closeDirectorySettings?.addEventListener('click', () => {
    if (hasValidDirectory()) {
      updateDirectoryFlow();
    }
  });

  directoryInput?.addEventListener('input', () => {
    setDirectoryStatus(false);
  });

  if (trainerForm) {
    trainerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      resultPanel.classList.remove('hidden');
      resultContent.innerHTML = createWorkoutPlan(formData);
    });
  }

  const savedUser = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  if (savedUser) {
    setUser(savedUser);
    showApp();
  } else {
    showLogin();
  }

  loadDirectoryPreference();
  toggleModeFields();
  updateDirectoryFlow();
  setupGoogleAuth();

  if (savedUser) {
    requestDriveAccess('');
  }

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearUser();
    directoryInput.value = '';
    localStorage.removeItem(DIRECTORY_KEY);
    if (google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
  });
}

initApp();
