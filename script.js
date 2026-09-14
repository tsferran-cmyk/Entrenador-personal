const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const state = {
  user: null,
  accessToken: null,
  tokenClient: null,
};

const userStatus = document.getElementById('user-status');
const resultPanel = document.getElementById('result-panel');
const resultContent = document.getElementById('result-content');
const proposedFields = document.getElementById('proposed-fields');
const modeRadios = document.querySelectorAll('input[name="mode"]');
const sheetInput = document.getElementById('sheet-id');

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

function setUser(user) {
  state.user = user;
  const displayName = user?.name || 'Usuari';
  const email = user?.email || 'sense email';

  userStatus.textContent = `Autenticat: ${displayName}`;
  userStatus.classList.remove('offline');
  userStatus.classList.add('online');

  localStorage.setItem('trainer-user', JSON.stringify({ name: displayName, email }));
}

function clearUser() {
  state.user = null;
  state.accessToken = null;
  userStatus.textContent = 'No autenticat';
  userStatus.classList.remove('online');
  userStatus.classList.add('offline');
  localStorage.removeItem('trainer-user');
}

function setupGoogleAuth() {
  if (!window.google || !window.google.accounts) {
    console.warn('Google Identity Services no està disponible encara.');
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
    context: 'signin'
  });

  google.accounts.id.renderButton(document.getElementById('google-login-btn'), {
    theme: 'filled_blue',
    size: 'large',
    width: 250,
    text: 'continue_with',
    shape: 'pill'
  });

  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SHEETS_SCOPE,
    callback: (response) => {
      if (response.error) {
        console.error('Error d’autorització de Sheets:', response.error);
        resultContent.innerHTML = '<p>La connexió amb Google Sheets no s’ha pogut completar. Revisa el Client ID i el consentiment de l’aplicació.</p>';
        resultPanel.classList.remove('hidden');
        return;
      }

      state.accessToken = response.access_token;
      const storedUser = JSON.parse(localStorage.getItem('trainer-user') || 'null');
      if (storedUser) {
        setUser(storedUser);
      }
    }
  });
}

function handleCredentialResponse(response) {
  if (!response.credential) {
    return;
  }

  const payload = JSON.parse(atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  const user = {
    name: payload.name || payload.given_name || 'Usuari',
    email: payload.email || 'sense-email@google.com'
  };

  setUser(user);
  state.accessToken = null;

  if (GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE')) {
    resultContent.innerHTML = `
      <p>Login de prova detectat.</p>
      <p>Per connectar el teu compte real de Google, substitueix <strong>YOUR_GOOGLE_CLIENT_ID</strong> a <strong>config.js</strong> i habilita l’API de Google Sheets.</p>
    `;
    resultPanel.classList.remove('hidden');
    return;
  }

  if (state.tokenClient) {
    state.tokenClient.requestAccessToken();
  }
}

function toggleModeFields() {
  const selectedMode = document.querySelector('input[name="mode"]:checked')?.value || 'propio';
  proposedFields.classList.toggle('hidden', selectedMode === 'propio');
}

function generateWorkoutPlan(formData) {
  const mode = formData.get('mode');

  if (mode === 'propio') {
    return `
      <h3>Entrenament propi</h3>
      <p>Has seleccionat accedir al teu entrenament personal. Si el teu full de Google Sheets té dades, les podràs carregar des del panell lateral.</p>
      <p><strong>Compte connectat:</strong> ${state.user?.email || 'No autenticat'}</p>
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

function readSheetValues(sheetId) {
  const cleanId = sheetId.trim();
  if (!cleanId) {
    throw new Error('Falta l’ID del full de Google Sheets.');
  }

  if (!state.accessToken) {
    throw new Error('Primer has de iniciar sessió amb Google i autoritzar l’accés a Google Sheets.');
  }

  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/Hoja1!A1:D30?valueRenderOption=FORMATTED_VALUE`, {
    headers: { Authorization: `Bearer ${state.accessToken}` }
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('No s’ha pogut llegir el full. Comprova l’ID i el consentiment de Google.');
      }
      return response.json();
    })
    .then((data) => {
      const rows = data.values || [];
      if (!rows.length) {
        return '<p>El full està buit o no te dades per mostrar.</p>';
      }

      return rows
        .slice(0, 6)
        .map((row) => `<li>${row.join(' | ')}</li>`)
        .join('');
    });
}

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener('change', toggleModeFields);
});

document.getElementById('trainer-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  resultPanel.classList.remove('hidden');
  resultContent.innerHTML = generateWorkoutPlan(formData);
});

document.getElementById('load-own-plan').addEventListener('click', async () => {
  try {
    const rowsHtml = await readSheetValues(sheetInput.value);
    resultPanel.classList.remove('hidden');
    resultContent.innerHTML = `
      <h3>Entrenaments guardats al full</h3>
      <ul>${rowsHtml}</ul>
    `;
  } catch (error) {
    resultPanel.classList.remove('hidden');
    resultContent.innerHTML = `<p>${error.message}</p>`;
  }
});

const storedUser = JSON.parse(localStorage.getItem('trainer-user') || 'null');
if (storedUser) {
  setUser(storedUser);
}

toggleModeFields();
setupGoogleAuth();
