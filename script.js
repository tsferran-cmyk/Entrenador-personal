const GOOGLE_API_KEY = window.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY';
const DIRECTORY_KEY = 'fitflow-directory';

const appScreen = document.getElementById('app-screen');
const userStatus = document.getElementById('user-status');
const resultPanel = document.getElementById('result-panel');
const resultContent = document.getElementById('result-content');
const directoryInput = document.getElementById('directory-id');
const rememberDirectory = document.getElementById('remember-directory');
const proposedFields = document.getElementById('proposed-fields');

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

function setAccessStatus(isAuthenticated) {
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
    resultContent.innerHTML = '<p>Si us plau, indica l’ID del full o carpeta de Google Drive.</p>';
    resultPanel.classList.remove('hidden');
    return;
  }

  if (rememberDirectory.checked) {
    localStorage.setItem(DIRECTORY_KEY, directoryValue);
  } else {
    localStorage.removeItem(DIRECTORY_KEY);
  }

  resultPanel.classList.add('hidden');
  resultContent.innerHTML = '';
}

function setAccessStatusFromValidation(hasAccess) {
  setAccessStatus(hasAccess);
  if (hasAccess) {
    appScreen.classList.remove('hidden');
  }
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

async function validateSharedGoogleLink(rawUrl) {
  const resultBox = document.getElementById('link-check-result');
  const url = rawUrl.trim();
  const id = extractGoogleId(url);

  if (!url || !id) {
    resultBox.innerHTML = '<strong>Link no vàlid.</strong> Introduïu un enllaç de Google Drive o Sheets vàlid.';
    setAccessStatus(false);
    return;
  }

  if (GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY') {
    resultBox.innerHTML = `
      <strong>URL detectada:</strong> ${id}<br />
      No es pot comptar fitxers/carpetes des del navegador sense una API key de Google Cloud.<br />
      Per fer-ho bé, comparteix la carpeta com a <strong>"Qualsevol amb l’enllaç pot veure-ho"</strong> i configura una API key pública a <strong>config.js</strong>.
    `;
    setAccessStatus(false);
    return;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${id}'+in+parents+and+trashed=false&key=${GOOGLE_API_KEY}&fields=files(id,name,mimeType),nextPageToken&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error('No es pot llegir aquesta carpeta amb la clau actual.');
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
      <strong>Es pot consultar sense login:</strong> sí, sempre que la carpeta estigui compartida públicament i la clau sigui vàlida.
    `;
    setAccessStatus(true);
  } catch (error) {
    resultBox.innerHTML = `
      <strong>No s’ha pogut validar el directori.</strong><br />
      Pot passar perquè el link no està compartit públicament, perquè l’API key no és vàlida o perquè la carpeta no és accessible sense login.<br />
      <small>${error.message}</small>
    `;
    setAccessStatus(false);
  }
}

document.getElementById('directory-form').addEventListener('submit', (event) => {
  event.preventDefault();
  saveDirectoryPreference();
});

document.getElementById('link-check-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const sharedLink = document.getElementById('shared-link').value;
  validateSharedGoogleLink(sharedLink);
});

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener('change', toggleModeFields);
});

document.getElementById('trainer-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  resultPanel.classList.remove('hidden');
  resultContent.innerHTML = createWorkoutPlan(formData);
});

loadDirectoryPreference();
appScreen.classList.remove('hidden');
toggleModeFields();
