const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_API_KEY = window.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY';
const USER_KEY = 'fitflow-user';
const DIRECTORY_KEY = 'fitflow-directory';
const DIRECTORY_STATUS_KEY = 'fitflow-directory-status';
const TRAINING_PREFIX_KEY = 'fitflow-training-prefix';
const TRAINING_FILE_KEY = 'fitflow-training-file';
const WORKOUT_STATE_KEY = 'fitflow-workout-in-progress';

const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const userStatus = document.getElementById('user-status');
const googleLoginHeader = document.getElementById('google-login-header');
const resultPanel = document.getElementById('result-panel');
const resultContent = document.getElementById('result-content');
const directoryInput = document.getElementById('directory-id');
const trainingFilePrefixInput = document.getElementById('training-file-prefix');
const rememberDirectory = document.getElementById('remember-directory');
const directorySettings = document.getElementById('directory-settings');
const directorySettingsButton = document.getElementById('directory-settings-button');
const directorySettingsAlert = document.getElementById('directory-settings-alert');
const directoryValidationResult = document.getElementById('directory-validation-result');
const closeDirectorySettings = document.getElementById('close-directory-settings');
const quizPanel = document.getElementById('quiz-panel');
const workoutScreen = document.getElementById('workout-screen');
const calendarPanel = document.getElementById('calendar-panel');
const exerciseDialog = document.getElementById('exercise-dialog');
const finishDialog = document.getElementById('finish-dialog');
const emptyExerciseDialog = document.getElementById('empty-exercise-dialog');
const replaceExerciseDialog = document.getElementById('replace-exercise-dialog');
const skipExerciseDialog = document.getElementById('skip-exercise-dialog');
const resumeWorkoutDialog = document.getElementById('resume-workout-dialog');
const proposedFields = document.getElementById('proposed-fields');
const painFields = document.getElementById('pain-fields');

let accessToken = null;
let tokenClient = null;
let directorySettingsOpen = false;
let workoutTimer = null;
let workoutStartedAt = null;
let workoutExercises = [];
let currentExerciseIndex = 0;
let workoutTotalSeconds = 1800;
let catalogExercises = [];
let workoutCriteria = null;
let workoutSetupMessage = '';

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

  if (openSettings) {
    directorySettingsOpen = true;
    directorySettings?.classList.remove('hidden');
    quizPanel?.classList.add('hidden');
    directorySettingsButton?.setAttribute('aria-expanded', 'true');
    return;
  }

  if (validDirectory) {
    if (directorySettingsOpen) {
      directorySettings?.classList.remove('hidden');
      quizPanel?.classList.add('hidden');
      directorySettingsButton?.setAttribute('aria-expanded', 'true');
      return;
    }

    directorySettings?.classList.add('hidden');
    quizPanel?.classList.remove('hidden');
    directorySettingsButton?.setAttribute('aria-expanded', 'false');
    return;
  }

  directorySettings?.classList.remove('hidden');
  directorySettingsOpen = true;
  directorySettingsButton?.setAttribute('aria-expanded', 'true');
  if (!validDirectory) {
    quizPanel?.classList.add('hidden');
  }
}

function loadDirectoryPreference() {
  const saved = localStorage.getItem(DIRECTORY_KEY);
  const savedPrefix = localStorage.getItem(TRAINING_PREFIX_KEY);
  if (saved) {
    directoryInput.value = saved;
    rememberDirectory.checked = true;
  }
  if (savedPrefix) {
    trainingFilePrefixInput.value = savedPrefix;
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
    localStorage.setItem(TRAINING_PREFIX_KEY, trainingFilePrefixInput.value.trim() || 'entrenament');
  } else {
    localStorage.removeItem(DIRECTORY_KEY);
    localStorage.removeItem(TRAINING_PREFIX_KEY);
    localStorage.removeItem(TRAINING_FILE_KEY);
  }

  validateDriveDirectory(directoryValue);
}

function toggleModeFields() {
  const mode = document.querySelector('input[name="mode"]:checked')?.value || 'propio';
  proposedFields.classList.toggle('hidden', mode === 'propio');
  if (mode === 'proposat') {
    togglePainFields();
  }
}

function togglePainFields() {
  const hasPain = document.querySelector('input[name="hasPain"]:checked')?.value === 'si';
  painFields?.classList.toggle('hidden', !hasPain);
}

function updateCatalogZones(exercises) {
  const zones = new Set();
  exercises.forEach((exercise) => {
    `${exercise['Zones principals']};${exercise['Zones secundàries']}`
      .split(';')
      .map((zone) => zone.trim())
      .filter(Boolean)
      .forEach((zone) => zones.add(zone));
  });
  const zoneContainer = document.getElementById('catalog-zones');
  if (!zoneContainer || !zones.size) return;
  zoneContainer.innerHTML = [...zones].map((zone) => `
    <label class="option-card">
      <input type="checkbox" name="painZone" value="${zone.toLocaleLowerCase()}" />
      <span>${zone}</span>
    </label>
  `).join('');
}

function createWorkoutPlan(formData) {
  const mode = formData.get('mode');

  if (mode === 'propio') {
    const selectedTrainingFile = JSON.parse(localStorage.getItem(TRAINING_FILE_KEY) || 'null');
    return `
      <h3>Entrenament propi</h3>
      <p>Has seleccionat llegir el teu propi entrenament des del directori autoritzat.</p>
      <p><strong>Directori seleccionat:</strong> ${directoryInput.value.trim() || 'No definit'}</p>
      <p><strong>Fitxer seleccionat:</strong> ${selectedTrainingFile?.name || 'No trobat'}</p>
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

function createFallbackWorkoutExercises(formData) {
  const mode = formData.get('mode');
  const plan = trainingMap[formData.get('trainingType') || 'forca'];
  const blocks = mode === 'proposat' ? plan.blocks : ['Exercici propi recuperat del directori'];

  return blocks.map((block, index) => ({
    type: mode === 'proposat' ? plan.label : 'Entrenament propi',
    videoUrl: '',
    nameCa: mode === 'proposat' ? block : 'Exercici del fitxer d’entrenament',
    nameEn: 'Exercise from training file',
    sets: '',
    reps: '',
    weight: '',
    equipment: '',
    description: '',
    label: block,
    index,
    source: mode === 'proposat' ? 'catalog' : 'propi'
  }));
}

function normalizeColumnName(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function getColumnValue(row, aliases) {
  const normalizedRow = new Map(Object.entries(row).map(([key, value]) => [normalizeColumnName(key), value]));
  for (const alias of aliases) {
    const value = normalizedRow.get(normalizeColumnName(alias));
    if (value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
}

async function createWorkoutExercises(formData) {
  if (formData.get('mode') !== 'proposat') {
    const selectedTrainingFile = JSON.parse(localStorage.getItem(TRAINING_FILE_KEY) || 'null');
    if (!selectedTrainingFile?.id) {
      workoutSetupMessage = 'No s’ha trobat el fitxer d’entrenament propi. Comprova el prefix i els permisos de Drive.';
      return createFallbackWorkoutExercises(formData);
    }

    try {
      const rows = await readSpreadsheetRows(selectedTrainingFile);
      if (rows.length < 2) throw new Error('El fitxer d’entrenament no conté files d’exercicis.');
      const headers = rows.shift().map((header) => String(header).trim());
      const exercises = rows
        .map((row) => Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ''])))
        .filter((exercise) => Object.values(exercise).some((value) => String(value).trim() !== ''))
        .map((exercise, index) => ({
          type: getColumnValue(exercise, ['Tipus', 'Modalitat', 'Type']) || 'Entrenament propi',
          videoUrl: getColumnValue(exercise, ['Enllaç vídeo', 'Enllaç video', 'Vídeo', 'Video', 'Video URL']),
          nameCa: getColumnValue(exercise, ['Exercici', 'Nom CA', 'Nom de l’exercici', 'Nom de l\'exercici', 'Nom exercici', 'Exercici CA', 'Nom', 'Exercise']) || `Exercici ${index + 1}`,
          nameEn: getColumnValue(exercise, ['Nom EN', 'Name', 'English name']) || 'Exercise from training file',
          sets: getColumnValue(exercise, ['Sèries', 'Series', 'Sets']),
          reps: getColumnValue(exercise, ['Repeticions', 'Reps', 'Repetitions']),
          weight: getColumnValue(exercise, ['Pes', 'Pes (kg)', 'Weight', 'Expected weight']),
          equipment: getColumnValue(exercise, ['Material', 'Material requerit', 'Equipment']) || 'Encara no especificat',
          description: getColumnValue(exercise, ['Descripció', 'Instruccions CA', 'Notes', 'Description']),
          label: getColumnValue(exercise, ['Exercici', 'Nom CA', 'Nom de l’exercici', 'Nom de l\'exercici', 'Nom exercici', 'Nom', 'Exercise']) || `Exercici ${index + 1}`,
          id: getColumnValue(exercise, ['ID', 'Exercise ID']),
          source: 'propi'
        }));
      if (!exercises.length) throw new Error('El fitxer d’entrenament no conté cap exercici vàlid.');
      return exercises;
    } catch (error) {
      workoutSetupMessage = `No s’ha pogut obrir l’entrenament propi. ${error.message}`;
      return createFallbackWorkoutExercises(formData);
    }
  }

  try {
    const catalogFile = findCatalogFile();
    if (!catalogFile) {
      workoutSetupMessage = 'No s’ha trobat el catàleg. Comprova el nom i els permisos de Drive.';
      return createFallbackWorkoutExercises(formData);
    }

    const rows = await readSpreadsheetRows(catalogFile);
    const headers = rows.shift().map((header) => String(header).trim());
    const exercises = rows
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
      .filter((exercise) => String(exercise.Actiu).toLocaleLowerCase() === 'sí');
    catalogExercises = exercises;
    updateCatalogZones(exercises);
    const trainingType = formData.get('trainingType') || 'forca';
    const focus = focusMap[formData.get('focus') || 'fullbody'];
    const hasEquipment = formData.get('hasEquipment') === 'si';
    const painZones = formData.getAll('painZone');
    workoutCriteria = { trainingType, focus, hasEquipment, painZones };
    const selected = exercises.filter((exercise) => {
      const modality = String(exercise.Modalitat).toLocaleLowerCase();
      const zones = `${exercise['Zones principals']} ${exercise['Zones secundàries']}`.toLocaleLowerCase();
      const typeMatches = trainingType === 'mobilitat'
        ? modality.includes('mobilitat')
        : trainingType === 'forcaMobilitat'
          ? modality.includes('força') || modality.includes('mobilitat')
          : modality.includes('força');
      const focusMatches = focus === 'full body' || zones.includes(focus.split(' ')[0]);
      const painMatches = !painZones.length || painZones.some((zone) => zones.includes(zone));
      const equipmentMatches = hasEquipment || String(exercise['Material requerit']).toLocaleLowerCase() === 'cap';
      return typeMatches && focusMatches && painMatches && equipmentMatches;
    });
    const source = chooseDailyExercises(selected.length ? selected : exercises, 5);

    return source.map((exercise, index) => ({
      type: exercise.Modalitat || 'Entrenament',
      videoUrl: exercise['Enllaç vídeo'] || exercise['Vídeo'] || '',
      nameCa: exercise['Nom CA'] || 'Exercici sense nom',
      nameEn: exercise['Nom EN'] || 'Exercise without name',
      sets: '', reps: '', weight: '',
      equipment: exercise['Material requerit'] || 'Cap',
      description: exercise['Instruccions CA'] || '',
      label: exercise['Nom CA'] || `Exercici ${index + 1}`,
      id: exercise.ID || '',
      source: 'catalog'
    }));
  } catch (error) {
    console.warn('No s’ha pogut llegir el catàleg d’exercicis.', error);
    workoutSetupMessage = `No s’ha pogut llegir el catàleg. ${error.message}`;
    return createFallbackWorkoutExercises(formData);
  }
}

function isFavoriteExercise(exercise) {
  const value = exercise['Agrada molt'] || exercise['Agrada molt?'] || exercise['Preferit'];
  return ['sí', 'si', 'true', '1', 'molt'].includes(String(value).trim().toLocaleLowerCase());
}

function chooseDailyExercises(exercises, count) {
  const state = JSON.parse(localStorage.getItem('fitflow-proposal-state') || '{"sessions":0,"recent":[]}');
  const recentIds = new Set(state.recent || []);
  const repeatSession = state.sessions % 2 === 1;
  const ordered = [...exercises].sort((first, second) => {
    const favoriteDifference = Number(isFavoriteExercise(second)) - Number(isFavoriteExercise(first));
    if (favoriteDifference) return favoriteDifference;
    if (repeatSession) {
      return Number(recentIds.has(second.ID)) - Number(recentIds.has(first.ID));
    }
    return Number(recentIds.has(first.ID)) - Number(recentIds.has(second.ID));
  });
  const selected = ordered.slice(0, count);
  localStorage.setItem('fitflow-proposal-state', JSON.stringify({
    sessions: state.sessions + 1,
    recent: selected.map((exercise) => exercise.ID).filter(Boolean)
  }));
  return selected;
}

function findReplacementExercise(currentExercise) {
  if (!workoutCriteria || !catalogExercises.length) return null;
  const currentId = currentExercise.id;
  const candidates = catalogExercises.filter((exercise) => {
    if (exercise.ID === currentId) return false;
    const modality = String(exercise.Modalitat).toLocaleLowerCase();
    const typeMatches = workoutCriteria.trainingType === 'mobilitat'
      ? modality.includes('mobilitat')
      : workoutCriteria.trainingType === 'forcaMobilitat'
        ? modality.includes('força') || modality.includes('mobilitat')
        : modality.includes('força');
    return typeMatches && (!workoutCriteria.hasEquipment
      ? String(exercise['Material requerit']).toLocaleLowerCase() === 'cap'
      : true);
  });
  return candidates.find((exercise) => !workoutExercises.some((item) => item.id === exercise.ID)) || null;
}

function findCatalogFile() {
  const savedFile = JSON.parse(localStorage.getItem('fitflow-catalog-file') || 'null');
  if (savedFile?.id) return savedFile;
  return (window.driveFiles || []).find((file) => file.mimeType !== 'application/vnd.google-apps.folder'
    && file.name.toLocaleLowerCase().startsWith('catàleg exercicis'));
}

async function readSpreadsheetRows(file) {
  const fileId = typeof file === 'string' ? file : file.id;
  const mimeType = typeof file === 'string' ? '' : file.mimeType;
  if (!window.XLSX) throw new Error('La llibreria Excel encara no està disponible.');

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`Drive ha rebutjat l’exportació del Google Sheet (${response.status}).`);
    const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      .filter((row, index) => index === 0 || row.some((cell) => String(cell).trim() !== ''));
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Drive ha rebutjat la descàrrega del fitxer (${response.status}).`);
  const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    .filter((row, index) => index === 0 || row.some((cell) => String(cell).trim() !== ''));
}

async function ensureMonthlyTrainingLog(exercises, formData) {
  if (!accessToken || !window.XLSX) return;

  const directoryId = extractGoogleId(directoryInput.value.trim());
  if (!directoryId) return;

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const fileName = `${month}.${year} - Log entrenament.xlsx`;
  const files = window.driveFiles || await collectDriveFiles(directoryId);
  const existingFile = files.find((file) => file.name === fileName);
  const templateFile = files.find((file) => file.name.toLocaleLowerCase().startsWith('plantilla log entrenament'));
  if (formData.get('mode') === 'proposat') {
    const catalogFile = files.find((file) => file.mimeType !== 'application/vnd.google-apps.folder'
      && file.name.toLocaleLowerCase().startsWith('catàleg exercicis'));
    if (catalogFile) {
      try {
        const catalogRows = await readSpreadsheetRows(catalogFile);
        const catalogHeaders = catalogRows.shift().map((header) => String(header).trim());
        const catalog = catalogRows.map((row) => Object.fromEntries(
          catalogHeaders.map((header, index) => [header, row[index] ?? ''])
        ));
        updateCatalogZones(catalog);
      } catch (error) {
        console.warn('No s’han pogut carregar les zones del catàleg.', error);
      }
    }
  }
  const templateRows = templateFile ? await readSpreadsheetRows(templateFile) : [];
  const headers = templateRows.shift() || [
    'Sessió ID', 'Data', 'Tipus entrenament', 'Material disponible', 'Ordre exercici',
    'Exercici ID', 'Exercici', 'Origen / motiu exercici', 'Objectiu correctiu', 'Sèrie',
    'Costat', 'Repeticions', 'Pes (kg)', 'Temps (s)', 'Distància (m)', 'Descans (s)',
    'Esforç RPE (1–10)', 'Completat', 'Molèsties', 'Zona molèstia',
    'Intensitat molèstia (0–10)', 'Descripció molèstia / què ha passat', 'Adaptació feta', 'Observacions'
  ];
  const rows = existingFile ? await readSpreadsheetRows(existingFile) : templateRows;
  const sessionId = `${now.toISOString().slice(0, 10)}-${Date.now()}`;
  const plannedRows = exercises.map((exercise, index) => {
    const values = {
      'Sessió ID': sessionId,
      Data: now.toISOString().slice(0, 10),
      'Tipus entrenament': formData.get('mode') === 'proposat' ? 'Proposat' : 'Propi',
      'Ordre exercici': index + 1,
      'Exercici ID': exercise.id || '',
      Exercici: exercise.nameCa || '',
      'Origen / motiu exercici': formData.get('mode') === 'proposat' ? 'Catàleg d’exercicis' : 'Fitxer propi',
      Sèrie: 1,
      Completat: exercise.status === 'Saltat' ? 'Saltat' : 'No',
      Observacions: exercise.discardReason ? `Descartat: ${exercise.discardReason}` : ''
    };
    return headers.map((header) => values[header] ?? '');
  });
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows, ...plannedRows]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Log entrenament');
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const uploadedFile = await uploadSpreadsheet(fileName, content, existingFile?.id, directoryId);
  workoutLogFile = uploadedFile;
}

async function uploadSpreadsheet(fileName, content, fileId, parentId) {
  const boundary = `fitflow-${Date.now()}`;
  const metadata = {
    name: fileName,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  if (!fileId) metadata.parents = [parentId];
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    new Uint8Array(content),
    `\r\n--${boundary}--`
  ]);
  const endpoint = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const response = await fetch(endpoint, {
    method: fileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body
  });
  if (!response.ok) {
    let details = '';
    try {
      const errorData = await response.json();
      details = errorData.error?.message || '';
    } catch {
      details = response.statusText;
    }
    throw new Error(`Drive ha rebutjat el log (${response.status}). ${details}`);
  }
  return response.json();
}

function formatElapsedTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function saveWorkoutState() {
  if (!workoutExercises.length) return;

  localStorage.setItem(WORKOUT_STATE_KEY, JSON.stringify({
    date: getLocalDateKey(),
    exercises: workoutExercises,
    currentExerciseIndex,
    totalSeconds: workoutTotalSeconds,
    startedAt: workoutStartedAt
  }));
}

function clearWorkoutState() {
  localStorage.removeItem(WORKOUT_STATE_KEY);
}

function getPendingWorkoutState() {
  try {
    const state = JSON.parse(localStorage.getItem(WORKOUT_STATE_KEY) || 'null');
    if (!state || state.date !== getLocalDateKey() || !Array.isArray(state.exercises) || !state.exercises.length) {
      clearWorkoutState();
      return null;
    }
    return state;
  } catch {
    clearWorkoutState();
    return null;
  }
}

function resumeWorkout(state) {
  workoutExercises = state.exercises;
  currentExerciseIndex = Math.min(Math.max(Number(state.currentExerciseIndex) || 0, 0), workoutExercises.length - 1);
  workoutTotalSeconds = Number(state.totalSeconds) || 1800;
  workoutStartedAt = Number(state.startedAt) || Date.now();
  clearInterval(workoutTimer);
  workoutTimer = setInterval(() => {
    document.getElementById('elapsed-time').textContent = formatElapsedTime(Math.floor((Date.now() - workoutStartedAt) / 1000));
  }, 1000);
  quizPanel.classList.add('hidden');
  workoutScreen.classList.remove('hidden');
  appScreen.classList.add('workout-active');
  calendarPanel.classList.add('hidden');
  document.getElementById('workout-complete-notice').classList.add('hidden');
  document.getElementById('workout-setup-notice').classList.add('hidden');
  document.getElementById('total-time').textContent = formatElapsedTime(workoutTotalSeconds);
  renderCurrentExercise();
}

function offerWorkoutResume() {
  const state = getPendingWorkoutState();
  if (!state || !resumeWorkoutDialog?.showModal) return;
  resumeWorkoutDialog.showModal();
}

function renderCurrentExercise() {
  const exercise = workoutExercises[currentExerciseIndex];
  if (!exercise) return;

  document.getElementById('exercise-type').textContent = exercise.type;
  document.getElementById('exercise-name-ca').textContent = exercise.nameCa || 'Nom de l’exercici pendent';
  document.getElementById('exercise-name-en').textContent = exercise.nameEn || 'Exercise name pending';
  document.getElementById('exercise-sets').textContent = exercise.sets || '-';
  document.getElementById('exercise-reps').textContent = exercise.reps || '-';
  document.getElementById('exercise-weight').textContent = exercise.weight || '-';
  document.getElementById('exercise-equipment').textContent = exercise.equipment || 'Encara no especificat';
  document.getElementById('exercise-description').textContent = exercise.description || 'La descripció apareixerà quan el catàleg la proporcioni.';
  document.getElementById('exercise-step').textContent = currentExerciseIndex + 1;
  document.getElementById('current-exercise-number').textContent = currentExerciseIndex + 1;
  document.getElementById('total-exercises').textContent = workoutExercises.length;
  document.getElementById('workout-percent').textContent = `${Math.round((currentExerciseIndex / workoutExercises.length) * 100)}%`;
  document.getElementById('workout-progress-bar').style.width = `${(currentExerciseIndex / workoutExercises.length) * 100}%`;

  const video = document.getElementById('exercise-video');
  const videoSourceLabel = exercise.source === 'propi' ? 'fitxer d’entrenament propi' : 'catàleg';
  video.innerHTML = exercise.videoUrl
    ? `<span>Vídeo de l'exercici</span><a href="${exercise.videoUrl}" target="_blank" rel="noopener">Obrir vídeo</a>`
    : `<span>Vídeo de l’exercici</span><small>Enllaç pendent del ${videoSourceLabel}</small>`;
}

async function startWorkout(formData) {
  workoutSetupMessage = '';
  workoutExercises = await createWorkoutExercises(formData);
  try {
    await ensureMonthlyTrainingLog(workoutExercises, formData);
  } catch (error) {
    console.warn('No s’ha pogut preparar el log mensual.', error);
    workoutSetupMessage = `${workoutSetupMessage ? `${workoutSetupMessage} ` : ''}No s’ha pogut crear o actualitzar el log mensual. ${error.message}`;
  }
  currentExerciseIndex = 0;
  workoutTotalSeconds = Number(formData.get('duration') || 30) * 60;
  workoutStartedAt = Date.now();
  saveWorkoutState();
  clearInterval(workoutTimer);
  workoutTimer = setInterval(() => {
    document.getElementById('elapsed-time').textContent = formatElapsedTime(Math.floor((Date.now() - workoutStartedAt) / 1000));
  }, 1000);
  quizPanel.classList.add('hidden');
  workoutScreen.classList.remove('hidden');
  appScreen.classList.add('workout-active');
  calendarPanel.classList.add('hidden');
  document.getElementById('workout-complete-notice').classList.add('hidden');
  const setupNotice = document.getElementById('workout-setup-notice');
  setupNotice.textContent = workoutSetupMessage;
  setupNotice.classList.toggle('hidden', !workoutSetupMessage);
  document.getElementById('total-time').textContent = formatElapsedTime(workoutTotalSeconds);
  renderCurrentExercise();
}

function finishWorkout(completed = false) {
  clearInterval(workoutTimer);
  workoutTimer = null;
  workoutScreen.classList.add('hidden');
  quizPanel.classList.remove('hidden');
  appScreen.classList.remove('workout-active');
  document.getElementById('workout-complete-notice').classList.toggle('hidden', !completed);
  currentExerciseIndex = 0;
  clearWorkoutState();
}

function advanceExercise() {
  if (currentExerciseIndex >= workoutExercises.length - 1) {
    finishWorkout(true);
    return;
  }

  currentExerciseIndex += 1;
  saveWorkoutState();
  renderCurrentExercise();
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
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets.readonly',
    callback: (response) => {
      accessToken = response.access_token || null;
      if (accessToken) {
        setAccessStatus(true);
        googleLoginHeader?.classList.add('hidden');
        const savedDirectory = localStorage.getItem(DIRECTORY_KEY) || directoryInput?.value.trim();
        if (savedDirectory) {
          validateDriveDirectory(savedDirectory);
        }
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
    const files = await collectDriveFiles(id);
    const carpetes = files.filter((item) => item.mimeType === 'application/vnd.google-apps.folder').length;
    const fitxers = files.filter((item) => item.mimeType !== 'application/vnd.google-apps.folder').length;
    const prefix = trainingFilePrefixInput.value.trim() || 'entrenament';
    const normalizedPrefix = prefix.toLocaleLowerCase();
    const matchingFiles = files.filter((item) => (
      item.mimeType !== 'application/vnd.google-apps.folder'
      && item.name.toLocaleLowerCase().startsWith(normalizedPrefix)
    ));
    const selectedTrainingFile = selectLatestTrainingFile(matchingFiles, prefix);

    if (selectedTrainingFile) {
      localStorage.setItem(TRAINING_FILE_KEY, JSON.stringify(selectedTrainingFile));
    } else {
      localStorage.removeItem(TRAINING_FILE_KEY);
    }

    resultBox.innerHTML = `
      <strong>Validació correcta.</strong><br />
      <strong>ID:</strong> ${id}<br />
      <strong>Fitxers:</strong> ${fitxers}<br />
      <strong>Carpetes:</strong> ${carpetes}<br />
      <strong>Fitxer d'entrenament:</strong> ${selectedTrainingFile?.name || `No s'ha trobat cap fitxer amb el prefix "${prefix}"`}<br />
      ${selectedTrainingFile?.path ? `<strong>Ubicació:</strong> ${selectedTrainingFile.path}<br />` : ''}
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

async function collectDriveFiles(rootId) {
  const files = [];
  const foldersToVisit = [{ id: rootId, path: '' }];
  const visitedFolders = new Set();

  while (foldersToVisit.length) {
    const currentFolder = foldersToVisit.shift();
    if (visitedFolders.has(currentFolder.id)) continue;
    visitedFolders.add(currentFolder.id);

    const children = await fetchDriveChildren(currentFolder.id);
    for (const child of children) {
      const childPath = currentFolder.path ? `${currentFolder.path}/${child.name}` : child.name;
      const fileWithPath = { ...child, path: childPath };
      files.push(fileWithPath);

      if (child.mimeType === 'application/vnd.google-apps.folder') {
        foldersToVisit.push({ id: child.id, path: childPath });
      }
    }
  }

  window.driveFiles = files;
  return files;
}

async function fetchDriveChildren(parentId) {
  const children = [];
  let pageToken = '';

  do {
    const query = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
    const tokenQuery = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,modifiedTime),nextPageToken&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${tokenQuery}`,
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
    children.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return children;
}

function selectLatestTrainingFile(files, prefix) {
  if (!files.length) return null;

  const normalizedPrefix = prefix.toLocaleLowerCase();
  const getVersion = (file) => {
    const suffix = file.name.slice(normalizedPrefix.length);
    const dateMatch = suffix.match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
    if (dateMatch) {
      return { type: 'date', value: Number(`${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`) };
    }

    const numberMatch = suffix.match(/(?:^|[-_.\s])([0-9]+)(?:\D*)$/);
    return { type: 'number', value: numberMatch ? Number(numberMatch[1]) : 0 };
  };

  return [...files].sort((first, second) => {
    const firstVersion = getVersion(first);
    const secondVersion = getVersion(second);
    if (firstVersion.value !== secondVersion.value) {
      return secondVersion.value - firstVersion.value;
    }
    return new Date(second.modifiedTime || 0) - new Date(first.modifiedTime || 0);
  })[0];
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
      directorySettingsOpen = false;
      updateDirectoryFlow();
    }
  });

  directoryInput?.addEventListener('input', () => {
    setDirectoryStatus(false);
  });

  trainingFilePrefixInput?.addEventListener('input', () => {
    setDirectoryStatus(false);
  });

  if (trainerForm) {
    trainerForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      startWorkout(formData);
    });
  }

  document.querySelectorAll('input[name="mode"]').forEach((input) => {
    input.addEventListener('change', toggleModeFields);
  });
  document.querySelectorAll('input[name="hasPain"]').forEach((input) => {
    input.addEventListener('change', togglePainFields);
  });

  document.getElementById('complete-exercise-button')?.addEventListener('click', () => exerciseDialog.showModal());
  document.getElementById('cancel-exercise-button')?.addEventListener('click', () => exerciseDialog.close());
  document.getElementById('exercise-log-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    exerciseDialog.close();
    const hasLoggedData = ['completed-reps', 'completed-weight', 'completed-discomfort']
      .some((id) => document.getElementById(id).value.trim());
    if (!hasLoggedData) {
      emptyExerciseDialog.showModal();
      return;
    }
    advanceExercise();
  });
  document.getElementById('cancel-empty-exercise-button')?.addEventListener('click', () => emptyExerciseDialog.close());
  document.getElementById('empty-exercise-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    emptyExerciseDialog.close();
    advanceExercise();
  });
  document.getElementById('replace-exercise-button')?.addEventListener('click', () => replaceExerciseDialog.showModal());
  document.getElementById('cancel-replace-button')?.addEventListener('click', () => replaceExerciseDialog.close());
  document.getElementById('replace-exercise-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const currentExercise = workoutExercises[currentExerciseIndex];
    const reason = new FormData(event.currentTarget).get('replaceReason');
    const replacement = findReplacementExercise(currentExercise);
    replaceExerciseDialog.close();
    currentExercise.status = 'Descartat';
    currentExercise.discardReason = reason;
    if (replacement) {
      workoutExercises[currentExerciseIndex] = {
        type: replacement.Modalitat || currentExercise.type,
        videoUrl: replacement['Enllaç vídeo'] || replacement['Vídeo'] || '',
        nameCa: replacement['Nom CA'] || 'Exercici sense nom',
        nameEn: replacement['Nom EN'] || 'Exercise without name',
        sets: '', reps: '', weight: '',
        equipment: replacement['Material requerit'] || 'Cap',
        description: replacement['Instruccions CA'] || '',
        id: replacement.ID || '',
        status: 'Previst'
      };
      saveWorkoutState();
      renderCurrentExercise();
    } else {
      const setupNotice = document.getElementById('workout-setup-notice');
      setupNotice.textContent = 'No hi ha cap altre exercici del mateix tipus disponible. Et quedes en aquest exercici.';
      setupNotice.classList.remove('hidden');
    }
  });
  document.getElementById('skip-exercise-button')?.addEventListener('click', () => skipExerciseDialog.showModal());
  document.getElementById('cancel-skip-button')?.addEventListener('click', () => skipExerciseDialog.close());
  document.getElementById('skip-exercise-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    workoutExercises[currentExerciseIndex].status = 'Saltat';
    saveWorkoutState();
    skipExerciseDialog.close();
    advanceExercise();
  });
  document.getElementById('resume-workout-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const state = getPendingWorkoutState();
    resumeWorkoutDialog.close();
    if (state) resumeWorkout(state);
  });
  document.getElementById('discard-resume-button')?.addEventListener('click', () => {
    clearWorkoutState();
    resumeWorkoutDialog.close();
  });
  document.getElementById('finish-workout-button')?.addEventListener('click', () => finishDialog.showModal());
  document.getElementById('cancel-finish-button')?.addEventListener('click', () => finishDialog.close());
  document.getElementById('finish-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    finishDialog.close();
    finishWorkout();
  });
  const openCalendar = () => {
    calendarPanel.classList.remove('hidden');
    quizPanel.classList.add('hidden');
    workoutScreen.classList.add('hidden');
  };
  document.getElementById('home-calendar-button')?.addEventListener('click', openCalendar);
  document.getElementById('close-calendar-button')?.addEventListener('click', () => {
    calendarPanel.classList.add('hidden');
    quizPanel.classList.remove('hidden');
  });

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
    offerWorkoutResume();
  }

  document.getElementById('logout-btn').addEventListener('click', () => {
    clearUser();
    clearWorkoutState();
    directoryInput.value = '';
    trainingFilePrefixInput.value = '';
    localStorage.removeItem(DIRECTORY_KEY);
    localStorage.removeItem(DIRECTORY_STATUS_KEY);
    localStorage.removeItem(TRAINING_PREFIX_KEY);
    localStorage.removeItem(TRAINING_FILE_KEY);
    if (google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
  });
}

initApp();
