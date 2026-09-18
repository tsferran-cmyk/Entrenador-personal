const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_API_KEY = window.GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY';
const USER_KEY = 'fitflow-user';
const DIRECTORY_KEY = 'fitflow-directory';
const DIRECTORY_STATUS_KEY = 'fitflow-directory-status';
const TRAINING_PREFIX_KEY = 'fitflow-training-prefix';
const TRAINING_FILE_KEY = 'fitflow-training-file';
const TRAINING_FILE_VERSION_KEY = 'fitflow-training-file-version';
const WORKOUT_STATE_KEY = 'fitflow-workout-in-progress';
const CALENDAR_MONTH_KEY = 'fitflow-calendar-month';
const CURRENT_REPETITIONS_FILE_NAME = 'Repeticions actuals.xlsx';

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
const generatedWorkoutCountFields = document.getElementById('generated-workout-count-fields');

let accessToken = null;
let tokenClient = null;
let directorySettingsOpen = false;
let workoutTimer = null;
let workoutStartedAt = null;
let workoutExercises = [];
let currentExerciseIndex = 0;
let currentSeriesIndex = 0;
let workoutTotalSeconds = 1800;
let catalogExercises = [];
let workoutCriteria = null;
let workoutSetupMessage = '';
let workoutLogFile = null;
let workoutLogHeaders = [];
let workoutSessionId = '';
let workoutDay = '';
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

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
  generatedWorkoutCountFields?.classList.toggle('hidden', mode !== 'auto-generat');
  togglePainFields();
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
  const focus = formData.getAll('focus');
  const plan = trainingMap[trainingType];

  return `
    <h3>${plan.label}</h3>
    <p><strong>Durada:</strong> ${duration} minuts</p>
    <p><strong>Zones:</strong> ${focus.length ? focus.map((item) => focusMap[item]).join(', ') : 'totes'}</p>
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
  const blocks = mode === 'pim-pam' ? plan.blocks : ['Exercici propi recuperat del directori'];

  return blocks.map((block, index) => ({
    type: mode === 'pim-pam' ? plan.label : 'Entrenament propi',
    videoUrl: '',
    nameCa: mode === 'pim-pam' ? block : 'Exercici del fitxer d’entrenament',
    nameEn: 'Exercise from training file',
    sets: '',
    reps: '',
    weight: '',
    equipment: '',
    description: '',
    label: block,
    index,
    source: mode === 'pim-pam' ? 'catalog' : 'propi'
  }));
}

function downloadSpreadsheetTemplate(type) {
  if (!window.XLSX) {
    directoryValidationResult.innerHTML = '<strong>La llibreria Excel encara no està disponible.</strong><br />Torna-ho a provar en uns segons.';
    return;
  }

  const ownHeaders = ['Numero', 'Tipus', 'Exercici', 'Sèries', 'Repeticions', 'Descans', 'Pes', 'Material', 'Descripció', 'Link'];
  const catalogHeaders = [
    'ID', 'Nom CA', 'Nom EN', 'Àlies CA', 'Àlies EN', 'Zones principals', 'Zones secundàries',
    'Fase', 'Modalitat', 'Patró de moviment', 'Material requerit', 'Material opcional',
    'Posició', 'Lateralitat', 'Dificultat', 'Mètriques de registre', 'Etiquetes',
    'Instruccions CA', 'Instruccions EN', 'Actiu', 'Notes', 'Link'
  ];
  const headers = type === 'propi' ? ownHeaders : catalogHeaders;
  const example = type === 'propi'
    ? [1, 'Força', 'Exemple d’exercici', 3, '8-10', '60"', 60, 'Material', 'Descriu aquí com fer-lo.', 'https://...']
    : ['EX001', 'Exemple d’exercici', 'Example exercise', '', '', '', 'Entrenament', 'Força', 'Patró', 'Cap', '', '', '', '', 'Inicial', 'Sèries; repeticions', 'força', 'Descriu aquí com fer-lo.', 'Describe here.', 'Sí', '', 'https://...'];
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
  XLSX.utils.book_append_sheet(workbook, sheet, type === 'propi' ? 'Entrenament propi' : 'Catàleg');
  XLSX.writeFile(workbook, type === 'propi' ? 'plantilla-entrenament-propi.xlsx' : 'plantilla-cataleg-exercicis.xlsx');
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

function parseSeriesCount(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Math.max(1, Number(match[0])) : 1;
}

function getExerciseSeries(exercise) {
  return Math.max(1, Number(exercise.totalSeries || parseSeriesCount(exercise.sets)) || 1);
}

function getExerciseDay(exercise) {
  const value = String(exercise.day || '').trim();
  const match = value.match(/\d+/);
  return match ? match[0] : value;
}

function getCurrentMonthAutoFileName(date = new Date()) {
  return `Entrenament auto-generat ${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.xlsx`;
}

function getExerciseRepetitionKey(exercise) {
  return String(exercise.id || exercise.nameCa || '').trim().toLocaleLowerCase();
}

async function readCurrentRepetitions() {
  const file = (window.driveFiles || []).find((item) => item.name === CURRENT_REPETITIONS_FILE_NAME);
  if (!file) return { file: null, rows: [], headers: ['Exercici ID', 'Exercici', 'Sèries', 'Repeticions', 'Pes (kg)'] };
  const rows = await readSpreadsheetRows(file);
  const headers = rows.shift()?.map((header) => String(header).trim()) || [];
  return { file, rows, headers };
}

function applyCurrentRepetition(exercise, repetitionRows, headers) {
  const idIndex = headers.findIndex((header) => ['exerciciid', 'id'].includes(normalizeColumnName(header)));
  const nameIndex = headers.findIndex((header) => ['exercici', 'nom'].includes(normalizeColumnName(header)));
  const match = repetitionRows.find((row) => (
    (exercise.id && String(row[idIndex] || '').trim() === String(exercise.id).trim())
    || (!exercise.id && String(row[nameIndex] || '').trim().toLocaleLowerCase() === String(exercise.nameCa).trim().toLocaleLowerCase())
  ));
  if (!match) return exercise;
  return {
    ...exercise,
    totalSeries: parseSeriesCount(match[headers.findIndex((header) => normalizeColumnName(header) === 'series')]),
    sets: match[headers.findIndex((header) => normalizeColumnName(header) === 'series')] || exercise.sets,
    reps: match[headers.findIndex((header) => normalizeColumnName(header) === 'repeticions')] || exercise.reps,
    weight: match[headers.findIndex((header) => ['pes', 'peskg'].includes(normalizeColumnName(header)))] || exercise.weight
  };
}

async function updateCurrentRepetitions(exercise, reps, weight) {
  if (!accessToken || !window.XLSX) return;
  const directoryId = extractGoogleId(directoryInput.value.trim());
  if (!directoryId) return;
  const current = await readCurrentRepetitions();
  const headers = current.headers.length ? current.headers : ['Exercici ID', 'Exercici', 'Sèries', 'Repeticions', 'Pes (kg)'];
  const idIndex = headers.findIndex((header) => ['exerciciid', 'id'].includes(normalizeColumnName(header)));
  const nameIndex = headers.findIndex((header) => ['exercici', 'nom'].includes(normalizeColumnName(header)));
  const row = headers.map((header) => {
    const normalized = normalizeColumnName(header);
    if (normalized === 'exerciciid' || normalized === 'id') return exercise.id || '';
    if (normalized === 'exercici' || normalized === 'nom') return exercise.nameCa || '';
    if (normalized === 'series' || normalized === 'serie') return getExerciseSeries(exercise);
    if (normalized === 'repeticions' || normalized === 'reps') return reps || exercise.reps || '';
    if (normalized === 'pes' || normalized === 'peskg') return weight || exercise.weight || '';
    return '';
  });
  const existingIndex = current.rows.findIndex((item) => (
    (exercise.id && String(item[idIndex] || '').trim() === String(exercise.id).trim())
    || (!exercise.id && String(item[nameIndex] || '').trim().toLocaleLowerCase() === String(exercise.nameCa).trim().toLocaleLowerCase())
  ));
  if (existingIndex >= 0) current.rows[existingIndex] = row;
  else current.rows.push(row);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...current.rows]), 'Repeticions actuals');
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const uploadedFile = await uploadSpreadsheet(CURRENT_REPETITIONS_FILE_NAME, content, current.file?.id || null, directoryId);
  window.driveFiles = (window.driveFiles || []).filter((file) => file.name !== CURRENT_REPETITIONS_FILE_NAME);
  window.driveFiles = [...(window.driveFiles || []), uploadedFile];
}

async function ensureCurrentRepetitionsFile() {
  if (!accessToken || !window.XLSX) return;
  const directoryId = extractGoogleId(directoryInput.value.trim());
  if (!directoryId) return;
  const current = await readCurrentRepetitions();
  if (current.file) return;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([current.headers]), 'Repeticions actuals');
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const uploadedFile = await uploadSpreadsheet(CURRENT_REPETITIONS_FILE_NAME, content, null, directoryId);
  window.driveFiles = [...(window.driveFiles || []), uploadedFile];
}

async function maybeUpdateCurrentRepetitions(exercise, reps, weight) {
  if (!reps && !weight) return;
  const currentReps = String(exercise.reps || '').trim();
  const nextReps = String(reps || '').trim();
  if (currentReps && nextReps && currentReps !== nextReps
    && !window.confirm(`Has fet ${nextReps} repeticions i en constaven ${currentReps}. Vols actualitzar Repeticions actuals?`)) return;
  await updateCurrentRepetitions(exercise, nextReps, String(weight || '').trim());
}

async function ensureAutoGeneratedTrainingFile(formData) {
  const directoryId = extractGoogleId(directoryInput.value.trim());
  if (!directoryId) throw new Error('No s’ha definit el directori de Google Drive.');
  const files = await collectDriveFiles(directoryId);
  const fileName = getCurrentMonthAutoFileName();
  const existingFile = files.find((file) => file.name === fileName);
  if (existingFile) return existingFile;
  if (!window.confirm(`No has definit encara l’entrenament auto-generat del mes. Vols crear ${fileName}?`)) {
    throw new Error('No s’ha creat cap entrenament auto-generat.');
  }
  const catalogFile = findCatalogFile();
  if (!catalogFile) throw new Error('No s’ha trobat el catàleg per crear l’entrenament auto-generat.');
  const catalogRows = await readSpreadsheetRows(catalogFile);
  const headers = catalogRows.shift().map((header) => String(header).trim());
  const catalog = catalogRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
  const focus = formData.getAll('focus');
  const trainingType = formData.get('trainingType') || 'forca';
  const count = Math.max(1, Math.min(7, Number(formData.get('generatedWorkoutCount') || 1)));
  const selected = catalog.filter((exercise) => {
    if (String(exercise.Actiu).toLocaleLowerCase() !== 'sí') return false;
    const modality = String(exercise.Modalitat).toLocaleLowerCase();
    const zones = `${exercise['Zones principals']} ${exercise['Zones secundàries']}`.toLocaleLowerCase();
    const typeMatches = trainingType === 'mobilitat' ? modality.includes('mobilitat') : trainingType === 'forcaMobilitat' ? modality.includes('força') || modality.includes('mobilitat') : modality.includes('força');
    return typeMatches && (!focus.length || focus.some((zone) => zones.includes(zone)));
  });
  if (!selected.length) throw new Error('No hi ha exercicis que coincideixin amb el qüestionari.');
  const repetitions = await readCurrentRepetitions();
  const ownHeaders = ['Numero', 'Tipus', 'Exercici', 'Sèries', 'Repeticions', 'Pes', 'Material', 'Descripció', 'Link', 'Exercici ID'];
  const generatedRows = [];
  for (let day = 1; day <= count; day += 1) {
    chooseDailyExercises(selected, Math.max(1, Math.floor(Number(formData.get('duration') || 30) / 5)))
      .forEach((exercise) => {
        const mapped = applyCurrentRepetition({ id: exercise.ID, nameCa: exercise['Nom CA'] }, repetitions.rows, repetitions.headers);
        generatedRows.push([day, exercise.Modalitat || 'Força', exercise['Nom CA'] || '', mapped.totalSeries || 1, mapped.reps || '', mapped.weight || '', exercise['Material requerit'] || 'Cap', exercise['Instruccions CA'] || '', exercise.Link || '', exercise.ID || '']);
      });
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([ownHeaders, ...generatedRows]), 'Entrenament auto-generat');
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const uploadedFile = await uploadSpreadsheet(fileName, content, null, directoryId);
  window.driveFiles = [...files, uploadedFile];
  return uploadedFile;
}

async function chooseNextOwnTrainingDay(availableDays) {
  const orderedDays = [...availableDays].sort((first, second) => Number(first) - Number(second));
  const directoryId = extractGoogleId(directoryInput.value.trim());
  if (!directoryId) return orderedDays[0];
  const files = await collectDriveFiles(directoryId);
  const now = new Date();
  const monthFileName = `${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} - Log entrenament.xlsx`;
  const logFile = files.find((file) => file.name === monthFileName);
  if (!logFile) return orderedDays[0];
  try {
    const rows = await readSpreadsheetRows(logFile);
    const headers = rows.shift()?.map((header) => String(header).trim()) || [];
    const dayIndex = headers.findIndex((header) => ['diaentrenament', 'numentrenament', 'numero'].includes(normalizeColumnName(header)));
    const typeIndex = headers.findIndex((header) => normalizeColumnName(header) === normalizeColumnName('Tipus entrenament'));
    const completedIndex = headers.findIndex((header) => normalizeColumnName(header) === normalizeColumnName('Completat'));
    const completedDays = rows
      .filter((row) => String(row[typeIndex] || '').toLocaleLowerCase() === 'propi'
        && ['sí', 'si', 'yes', 'completat'].includes(String(row[completedIndex] || '').toLocaleLowerCase()))
      .map((row) => String(row[dayIndex] || '').trim())
      .filter(Boolean);
    const lastDay = completedDays.at(-1);
    const lastIndex = orderedDays.indexOf(lastDay);
    return orderedDays[(lastIndex + 1) % orderedDays.length] || orderedDays[0];
  } catch {
    return orderedDays[0];
  }
}

async function createWorkoutExercises(formData) {
  workoutDay = '';
  const mode = formData.get('mode');
  if (mode === 'propio' || mode === 'auto-generat') {
    const selectedTrainingFile = mode === 'auto-generat'
      ? await ensureAutoGeneratedTrainingFile(formData)
      : JSON.parse(localStorage.getItem(TRAINING_FILE_KEY) || 'null');
    if (!selectedTrainingFile?.id) {
      workoutSetupMessage = 'No s’ha trobat el fitxer d’entrenament propi. Comprova el prefix i els permisos de Drive.';
      return [];
    }

    try {
      const rows = await readSpreadsheetRows({ ...selectedTrainingFile, cacheBust: Date.now() });
      if (rows.length < 2) throw new Error('El fitxer d’entrenament no conté files d’exercicis.');
      const headers = rows.shift().map((header) => String(header).trim());
      const exerciseColumnAliases = ['Exercici', 'Nom CA', 'Nom de l’exercici', 'Nom de l\'exercici', 'Nom exercici', 'Nom'];
      if (!headers.some((header) => exerciseColumnAliases.some((alias) => normalizeColumnName(alias) === normalizeColumnName(header)))) {
        throw new Error(`No s’ha trobat cap columna d’exercici. Columnes detectades: ${headers.join(', ')}`);
      }
      let activeDay = '';
      const exercises = rows
        .map((row) => {
          const exercise = Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? '']));
          const rowDay = getColumnValue(exercise, ['Dia', 'Day', 'Dia entrenament', 'Dia d’entrenament']);
          if (String(rowDay).trim()) activeDay = rowDay;
          return { ...exercise, Dia: activeDay };
        })
        .filter((exercise) => getColumnValue(exercise, ['Exercici', 'Nom CA', 'Nom de l’exercici', 'Nom de l\'exercici', 'Nom exercici', 'Nom']))
        .map((exercise, index) => ({
          day: getColumnValue(exercise, ['Numero', 'Número', 'Dia', 'Day', 'Dia entrenament', 'Dia d’entrenament']),
          type: getColumnValue(exercise, ['Tipus', 'Modalitat', 'Type']) || 'Entrenament propi',
          videoUrl: getColumnValue(exercise, ['Link', 'Enllaç vídeo', 'Enllaç video', 'Vídeo', 'Video', 'Video URL']),
          nameCa: getColumnValue(exercise, ['Exercici', 'Nom CA', 'Nom de l’exercici', 'Nom de l\'exercici', 'Nom exercici', 'Exercici CA', 'Nom', 'Exercise']) || `Exercici ${index + 1}`,
          nameEn: getColumnValue(exercise, ['Nom EN', 'Name', 'English name']) || 'Exercise from training file',
          sets: getColumnValue(exercise, ['Sèries', 'Series', 'Sets']),
          totalSeries: parseSeriesCount(getColumnValue(exercise, ['Sèries', 'Series', 'Sets'])),
          reps: getColumnValue(exercise, ['Repeticions', 'Reps', 'Repetitions']),
          weight: getColumnValue(exercise, ['Pes', 'Pes (kg)', 'Weight', 'Expected weight']),
          equipment: getColumnValue(exercise, ['Material', 'Material requerit', 'Equipment']) || 'Encara no especificat',
          description: getColumnValue(exercise, ['Descripció', 'Instruccions CA', 'Notes', 'Description']),
          label: getColumnValue(exercise, ['Exercici', 'Nom CA', 'Nom de l’exercici', 'Nom de l\'exercici', 'Nom exercici', 'Nom', 'Exercise']) || `Exercici ${index + 1}`,
          id: getColumnValue(exercise, ['ID', 'Exercise ID']),
          source: 'propi',
          zones: ''
        }));
      if (!exercises.length) throw new Error('El fitxer d’entrenament no conté cap exercici vàlid.');
      const availableDays = [...new Set(exercises.map(getExerciseDay).filter(Boolean))];
      if (availableDays.length) {
        workoutDay = await chooseNextOwnTrainingDay(availableDays);
        const selectedExercises = exercises.filter((exercise) => getExerciseDay(exercise) === workoutDay);
        if (!selectedExercises.length) throw new Error(`No hi ha exercicis per al dia ${workoutDay}.`);
        const repetitions = await readCurrentRepetitions();
        return selectedExercises.map((exercise) => applyCurrentRepetition(exercise, repetitions.rows, repetitions.headers));
      }
      workoutDay = '';
      const repetitions = await readCurrentRepetitions();
      return exercises.map((exercise) => applyCurrentRepetition(exercise, repetitions.rows, repetitions.headers));
    } catch (error) {
      workoutSetupMessage = `No s’ha pogut obrir l’entrenament propi. ${error.message}`;
      return [];
    }
  }

  try {
    const catalogFile = findCatalogFile();
    if (!catalogFile) {
      workoutSetupMessage = 'No s’ha trobat el catàleg. Comprova el nom i els permisos de Drive.';
      return [];
    }

    const rows = await readSpreadsheetRows(catalogFile);
    const headers = rows.shift().map((header) => String(header).trim());
    const exercises = rows
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
      .filter((exercise) => String(exercise.Actiu).toLocaleLowerCase() === 'sí');
    catalogExercises = exercises;
    updateCatalogZones(exercises);
    const trainingType = formData.get('trainingType') || 'forca';
    const focus = formData.getAll('focus');
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
      const focusMatches = !focus.length || focus.some((zone) => zones.includes(zone));
      const painMatches = !painZones.length || painZones.some((zone) => zones.includes(zone));
      const equipmentMatches = hasEquipment || String(exercise['Material requerit']).toLocaleLowerCase() === 'cap';
      return typeMatches && focusMatches && painMatches && equipmentMatches;
    });
    const duration = Number(formData.get('duration') || 15);
    const source = chooseDailyExercises(selected.length ? selected : exercises, Math.max(1, Math.floor(duration / 5)));

    const result = source.map((exercise, index) => ({
      type: exercise.Modalitat || 'Entrenament',
      videoUrl: exercise.Link || exercise['Enllaç vídeo'] || exercise['Vídeo'] || '',
      nameCa: exercise['Nom CA'] || 'Exercici sense nom',
      nameEn: exercise['Nom EN'] || 'Exercise without name',
      sets: '', reps: '', weight: '',
      equipment: exercise['Material requerit'] || 'Cap',
      description: exercise['Instruccions CA'] || '',
      label: exercise['Nom CA'] || `Exercici ${index + 1}`,
      id: exercise.ID || '',
      source: 'catalog',
      zones: `${exercise['Zones principals'] || ''};${exercise['Zones secundàries'] || ''}`
    }));
    const repetitions = await readCurrentRepetitions();
    return result.map((exercise) => applyCurrentRepetition(exercise, repetitions.rows, repetitions.headers));
  } catch (error) {
    console.warn('No s’ha pogut llegir el catàleg d’exercicis.', error);
    workoutSetupMessage = `No s’ha pogut llegir el catàleg. ${error.message}`;
    return [];
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

function getZoneTokens(value) {
  return String(value || '')
    .toLocaleLowerCase()
    .split(/[;,/]/)
    .map((zone) => normalizeColumnName(zone))
    .filter(Boolean);
}

function getCatalogUsage() {
  try {
    return JSON.parse(localStorage.getItem('fitflow-catalog-usage') || '{}');
  } catch {
    return {};
  }
}

function recordCatalogUsage(exerciseId) {
  if (!exerciseId) return;
  const usage = getCatalogUsage();
  usage[exerciseId] = Number(usage[exerciseId] || 0) + 1;
  localStorage.setItem('fitflow-catalog-usage', JSON.stringify(usage));
}

function findReplacementExercise(currentExercise) {
  if (!workoutCriteria || !catalogExercises.length) return null;
  const currentId = currentExercise.id;
  const currentZones = getZoneTokens(currentExercise.zones);
  const usage = getCatalogUsage();
  const candidates = catalogExercises.filter((exercise) => {
    if (exercise.ID === currentId) return false;
    const modality = String(exercise.Modalitat).toLocaleLowerCase();
    const typeMatches = workoutCriteria.trainingType === 'mobilitat'
      ? modality.includes('mobilitat')
      : workoutCriteria.trainingType === 'forcaMobilitat'
        ? modality.includes('força') || modality.includes('mobilitat')
        : modality.includes('força');
    const candidateZones = getZoneTokens(`${exercise['Zones principals']};${exercise['Zones secundàries']}`);
    const sharesZone = !currentZones.length || currentZones.some((zone) => candidateZones.includes(zone));
    return typeMatches && sharesZone && (!workoutCriteria.hasEquipment
      ? String(exercise['Material requerit']).toLocaleLowerCase() === 'cap'
      : true);
  });
  return [...candidates]
    .filter((exercise) => !workoutExercises.some((item) => item.id === exercise.ID))
    .sort((first, second) => {
      const firstZones = getZoneTokens(`${first['Zones principals']};${first['Zones secundàries']}`);
      const secondZones = getZoneTokens(`${second['Zones principals']};${second['Zones secundàries']}`);
      const firstMatch = currentZones.filter((zone) => firstZones.includes(zone)).length;
      const secondMatch = currentZones.filter((zone) => secondZones.includes(zone)).length;
      return secondMatch - firstMatch || Number(usage[first.ID] || 0) - Number(usage[second.ID] || 0);
    })[0] || null;
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
  const cacheBust = `&_fitflow=${Date.now()}`;
  if (!window.XLSX) throw new Error('La llibreria Excel encara no està disponible.');

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet${cacheBust}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error(`Drive ha rebutjat l’exportació del Google Sheet (${response.status}).`);
    const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      .filter((row, index) => index === 0 || row.some((cell) => String(cell).trim() !== ''));
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media${cacheBust}`, {
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
  await ensureCurrentRepetitionsFile();

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const fileName = `${month}.${year} - Log entrenament.xlsx`;
  const files = await collectDriveFiles(directoryId);
  const existingFile = files.find((file) => file.name === fileName);
  workoutLogFile = existingFile || null;
  const templateFile = files.find((file) => file.name.toLocaleLowerCase().startsWith('plantilla log entrenament'));
  if (formData.get('mode') === 'pim-pam') {
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
  const defaultHeaders = [
    'Sessió ID', 'Núm. entrenament', 'Data', 'Origen entrenament', 'Tipus entrenament',
    'Material disponible', 'Ordre exercici', 'Exercici ID', 'Exercici', 'Origen / motiu exercici',
    'Objectiu correctiu', 'Sèrie', 'Costat', 'Repeticions', 'Pes (kg)', 'Temps (s)',
    'Distància (m)', 'Descans (s)', 'Esforç RPE (1–10)', 'Completat', 'Molèsties',
    'Zona molèstia', 'Intensitat molèstia (0–10)', 'Descripció molèstia / què ha passat',
    'Adaptació feta', 'Observacions'
  ];
  let headers;
  if (existingFile) {
    const rows = await readSpreadsheetRows(existingFile);
    headers = rows.shift()?.map((header) => String(header).trim()) || defaultHeaders;
  } else {
    const templateRows = templateFile ? await readSpreadsheetRows(templateFile) : [];
    headers = templateRows.shift()?.map((header) => String(header).trim()) || defaultHeaders;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers]), 'Log entrenament');
    const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    workoutLogFile = await uploadSpreadsheet(fileName, content, null, directoryId);
    window.driveFiles = [...files, workoutLogFile];
  }
  workoutLogFile = workoutLogFile || existingFile;
  workoutLogHeaders = headers;
  workoutSessionId = `${now.toISOString().slice(0, 10)}-${Date.now()}`;
}

function logValue(headers, values, aliases) {
  const header = headers.find((item) => aliases.some((alias) => normalizeColumnName(alias) === normalizeColumnName(item)));
  return header ? values[header] ?? '' : '';
}

async function appendWorkoutLogRow(exercise, setNumber, completed, data = {}) {
  if (!workoutLogFile || !workoutLogHeaders.length || !accessToken) return;
  const rows = await readSpreadsheetRows(workoutLogFile);
  const headers = rows.shift()?.map((header) => String(header).trim()) || workoutLogHeaders;
  const values = {
    'Sessió ID': workoutSessionId,
    Data: new Date().toISOString().slice(0, 10),
    'Dia entrenament': workoutDay,
    'Núm. entrenament': workoutDay,
    Dia: workoutDay,
    'Tipus entrenament': exercise.source === 'catalog' ? 'Pim pam' : 'Entrenament propi',
    'Origen entrenament': exercise.source === 'catalog' ? 'Catàleg exercicis' : 'Fitxer d’entrenament',
    'Ordre exercici': currentExerciseIndex + 1,
    'Exercici ID': exercise.id || '',
    Exercici: exercise.nameCa || '',
    'Origen / motiu exercici': exercise.source === 'catalog' ? 'Catàleg d’exercicis' : 'Fitxer propi',
    Sèrie: `${setNumber}/${getExerciseSeries(exercise)}`,
    Repeticions: data.reps || exercise.reps || '',
    'Pes (kg)': data.weight || exercise.weight || '',
    Completat: completed ? 'Sí' : 'No',
    Molèsties: data.discomfort || '',
    Observacions: data.notes || ''
  };
  const row = headers.map((header) => {
    const normalized = normalizeColumnName(header);
    if (['dia', 'diaentrenament', 'numentrenament'].includes(normalized)) return workoutDay;
    if (normalized === 'origenentrenament') return values['Origen entrenament'];
    if (normalized === 'tipus') return values['Tipus entrenament'];
    if (normalized === 'exercici') return values.Exercici;
    if (['series', 'serie'].includes(normalized)) return values.Sèrie;
    if (normalized === 'repeticions' || normalized === 'reps') return values.Repeticions;
    if (normalized === 'pes' || normalized === 'peskg') return values['Pes (kg)'];
    if (normalized === 'observacions') return values.Observacions;
    return values[header] ?? '';
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows, row]), 'Log entrenament');
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const uploadedFile = await uploadSpreadsheet(workoutLogFile.name, content, workoutLogFile.id, extractGoogleId(directoryInput.value.trim()));
  workoutLogFile = { ...workoutLogFile, ...uploadedFile };
  window.driveFiles = (window.driveFiles || []).map((file) => file.id === workoutLogFile.id ? workoutLogFile : file);
  if (exercise.source === 'catalog') recordCatalogUsage(exercise.id);
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
    currentSeriesIndex,
    workoutDay,
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

async function resumeWorkout(state) {
  workoutExercises = state.exercises;
  currentExerciseIndex = Math.min(Math.max(Number(state.currentExerciseIndex) || 0, 0), workoutExercises.length - 1);
  currentSeriesIndex = Math.max(Number(state.currentSeriesIndex) || 0, 0);
  workoutDay = state.workoutDay || '';
  workoutTotalSeconds = Number(state.totalSeconds) || 1800;
  workoutStartedAt = Number(state.startedAt) || Date.now();
  const formData = new FormData();
  formData.set('mode', workoutExercises[0]?.source === 'catalog' ? 'pim-pam' : 'propio');
  try {
    await ensureMonthlyTrainingLog(workoutExercises, formData);
  } catch (error) {
    workoutSetupMessage = `No s’ha pogut reprendre el log mensual. ${error.message}`;
  }
  clearInterval(workoutTimer);
  workoutTimer = setInterval(() => {
    document.getElementById('elapsed-time').textContent = formatElapsedTime(Math.floor((Date.now() - workoutStartedAt) / 1000));
  }, 1000);
  quizPanel.classList.add('hidden');
  workoutScreen.classList.remove('hidden');
  appScreen.classList.add('workout-active');
  calendarPanel.classList.add('hidden');
  document.getElementById('workout-complete-notice').classList.add('hidden');
  document.getElementById('workout-setup-message').textContent = workoutSetupMessage;
  document.getElementById('workout-setup-notice').classList.toggle('hidden', !workoutSetupMessage);
  document.getElementById('total-time').textContent = formatElapsedTime(workoutTotalSeconds);
  renderCurrentExercise();
}

function offerWorkoutResume() {
  const state = getPendingWorkoutState();
  if (!state || !resumeWorkoutDialog?.showModal) return;
  resumeWorkoutDialog.showModal();
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('ca-ES', { month: 'long', year: 'numeric' }).format(date);
}

async function getTrainedDaysForMonth(date) {
  const directoryId = extractGoogleId(directoryInput.value.trim());
  if (!directoryId) return new Set();
  const monthFileName = `${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()} - Log entrenament.xlsx`;
  const files = await collectDriveFiles(directoryId);
  const logFile = files.find((file) => file.name === monthFileName);
  if (!logFile) return new Set();
  const rows = await readSpreadsheetRows(logFile);
  const headers = rows.shift()?.map((header) => String(header).trim()) || [];
  const dateIndex = headers.findIndex((header) => ['data', 'dia'].includes(normalizeColumnName(header)));
  const completedIndex = headers.findIndex((header) => normalizeColumnName(header) === normalizeColumnName('Completat'));
  const days = new Set();
  rows.forEach((row) => {
    const completed = String(row[completedIndex] || '').toLocaleLowerCase();
    if (!['sí', 'si', 'yes', 'completat'].includes(completed)) return;
    const value = String(row[dateIndex] || '');
    const isoMatch = value.match(/^\d{4}[-/]\d{1,2}[-/](\d{1,2})/);
    const dayMatch = value.match(/^\d{1,2}$/);
    if (isoMatch) days.add(Number(isoMatch[1]));
    else if (dayMatch) days.add(Number(dayMatch[0]));
  });
  return days;
}

async function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  document.getElementById('calendar-month-label').textContent = formatMonthLabel(calendarMonth);
  grid.innerHTML = [...['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg']]
    .map((day) => `<div class="calendar-weekday">${day}</div>`).join('');
  let trainedDays = new Set();
  try {
    trainedDays = await getTrainedDaysForMonth(calendarMonth);
  } catch (error) {
    console.warn('No s’han pogut carregar els dies entrenats.', error);
  }
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const todayKey = getLocalDateKey();
  for (let index = 0; index < offset; index += 1) grid.insertAdjacentHTML('beforeend', '<div></div>');
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = getLocalDateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    const classes = ['calendar-day'];
    if (dateKey === todayKey) classes.push('today');
    if (trainedDays.has(day)) classes.push('trained');
    grid.insertAdjacentHTML('beforeend', `<div class="${classes.join(' ')}">${day}</div>`);
  }
}

function renderCurrentExercise() {
  const exercise = workoutExercises[currentExerciseIndex];
  if (!exercise) return;

  document.getElementById('exercise-type').textContent = exercise.type;
  document.getElementById('exercise-name-ca').textContent = exercise.nameCa || 'Nom de l’exercici pendent';
  document.getElementById('exercise-name-en').textContent = exercise.nameEn || 'Exercise name pending';
  document.getElementById('exercise-sets').textContent = `${Math.min(currentSeriesIndex + 1, getExerciseSeries(exercise))}/${getExerciseSeries(exercise)}`;
  document.getElementById('exercise-reps').textContent = exercise.reps || '-';
  document.getElementById('exercise-weight').textContent = exercise.weight || '-';
  document.getElementById('exercise-equipment').textContent = exercise.equipment || 'Encara no especificat';
  document.getElementById('exercise-description').textContent = exercise.description || 'La descripció apareixerà quan el catàleg la proporcioni.';
  document.getElementById('exercise-step').textContent = currentExerciseIndex + 1;
  document.getElementById('current-exercise-number').textContent = currentExerciseIndex + 1;
  document.getElementById('total-exercises').textContent = workoutExercises.length;
  document.getElementById('workout-percent').textContent = `${Math.round((currentExerciseIndex / workoutExercises.length) * 100)}%`;
  document.getElementById('workout-progress-bar').style.width = `${(currentExerciseIndex / workoutExercises.length) * 100}%`;
  document.getElementById('replace-exercise-button').classList.toggle('hidden', exercise.source === 'propi');

  const video = document.getElementById('exercise-video');
  const videoSourceLabel = exercise.source === 'propi' ? 'fitxer d’entrenament propi' : 'catàleg';
  video.innerHTML = exercise.videoUrl
    ? `<span>Vídeo</span><a href="${exercise.videoUrl}" target="_blank" rel="noopener">Obrir</a>`
    : `<span>Vídeo</span><small>Sense link</small>`;
}

function showWorkoutSetupError(message) {
  const notice = document.getElementById('workout-setup-notice');
  document.getElementById('workout-setup-message').textContent = message;
  notice.classList.remove('hidden');
}

async function startWorkout(formData) {
  workoutSetupMessage = '';
  workoutExercises = await createWorkoutExercises(formData);
  if (!workoutExercises.length) {
    const formError = document.getElementById('workout-form-error');
    formError.textContent = workoutSetupMessage || 'No s’ha pogut preparar l’entrenament propi.';
    formError.classList.remove('hidden');
    quizPanel.classList.remove('hidden');
    workoutScreen.classList.add('hidden');
    return;
  }
  document.getElementById('workout-form-error')?.classList.add('hidden');
  try {
    await ensureMonthlyTrainingLog(workoutExercises, formData);
  } catch (error) {
    console.warn('No s’ha pogut preparar el log mensual.', error);
    workoutSetupMessage = `${workoutSetupMessage ? `${workoutSetupMessage} ` : ''}No s’ha pogut crear o actualitzar el log mensual. ${error.message}`;
  }
  currentExerciseIndex = 0;
  currentSeriesIndex = 0;
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
  document.getElementById('workout-setup-message').textContent = workoutSetupMessage;
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
  const exercise = workoutExercises[currentExerciseIndex];
  if (currentSeriesIndex + 1 < getExerciseSeries(exercise)) {
    currentSeriesIndex += 1;
    saveWorkoutState();
    renderCurrentExercise();
    return;
  }

  if (currentExerciseIndex >= workoutExercises.length - 1) {
    finishWorkout(true);
    return;
  }

  currentExerciseIndex += 1;
  currentSeriesIndex = 0;
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

  document.getElementById('download-own-template')?.addEventListener('click', () => downloadSpreadsheetTemplate('propi'));
  document.getElementById('download-catalog-template')?.addEventListener('click', () => downloadSpreadsheetTemplate('catalog'));

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

  document.getElementById('complete-exercise-button')?.addEventListener('click', () => {
    const exercise = workoutExercises[currentExerciseIndex];
    document.getElementById('completed-reps').value = exercise?.reps || '';
    document.getElementById('completed-weight').value = exercise?.weight || '';
    document.getElementById('completed-discomfort').value = '';
    exerciseDialog.showModal();
  });
  document.getElementById('cancel-exercise-button')?.addEventListener('click', () => exerciseDialog.close());
  document.getElementById('exercise-log-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    exerciseDialog.close();
    const hasLoggedData = ['completed-reps', 'completed-weight', 'completed-discomfort']
      .some((id) => document.getElementById(id).value.trim());
    if (!hasLoggedData) {
      emptyExerciseDialog.showModal();
      return;
    }
    const exercise = workoutExercises[currentExerciseIndex];
    try {
      await appendWorkoutLogRow(exercise, currentSeriesIndex + 1, true, {
        reps: document.getElementById('completed-reps').value.trim(),
        weight: document.getElementById('completed-weight').value.trim(),
        discomfort: document.getElementById('completed-discomfort').value.trim()
      });
      await maybeUpdateCurrentRepetitions(
        exercise,
        document.getElementById('completed-reps').value.trim(),
        document.getElementById('completed-weight').value.trim()
      );
    } catch (error) {
      showWorkoutSetupError(`No s’ha pogut guardar aquesta sèrie. ${error.message}`);
      return;
    }
    advanceExercise();
  });
  document.getElementById('cancel-empty-exercise-button')?.addEventListener('click', () => emptyExerciseDialog.close());
  document.getElementById('empty-exercise-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    emptyExerciseDialog.close();
    try {
      await appendWorkoutLogRow(workoutExercises[currentExerciseIndex], currentSeriesIndex + 1, true);
      await maybeUpdateCurrentRepetitions(workoutExercises[currentExerciseIndex], '', '');
    } catch (error) {
      showWorkoutSetupError(`No s’ha pogut guardar aquesta sèrie. ${error.message}`);
      return;
    }
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
        videoUrl: replacement.Link || replacement['Enllaç vídeo'] || replacement['Vídeo'] || '',
        nameCa: replacement['Nom CA'] || 'Exercici sense nom',
        nameEn: replacement['Nom EN'] || 'Exercise without name',
        sets: '', reps: '', weight: '',
        equipment: replacement['Material requerit'] || 'Cap',
        description: replacement['Instruccions CA'] || '',
        id: replacement.ID || '',
        source: 'catalog',
        zones: `${replacement['Zones principals'] || ''};${replacement['Zones secundàries'] || ''}`,
        status: 'Previst'
      };
      saveWorkoutState();
      renderCurrentExercise();
    } else {
      const setupNotice = document.getElementById('workout-setup-notice');
      document.getElementById('workout-setup-message').textContent = 'No hi ha cap altre exercici del mateix tipus disponible. Et quedes en aquest exercici.';
      setupNotice.classList.remove('hidden');
    }
  });
  document.getElementById('skip-exercise-button')?.addEventListener('click', () => skipExerciseDialog.showModal());
  document.getElementById('cancel-skip-button')?.addEventListener('click', () => skipExerciseDialog.close());
  document.getElementById('skip-exercise-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    workoutExercises[currentExerciseIndex].status = 'Saltat';
    try {
      await appendWorkoutLogRow(workoutExercises[currentExerciseIndex], currentSeriesIndex + 1, false, { notes: 'Saltat' });
    } catch (error) {
      showWorkoutSetupError(`No s’ha pogut guardar aquest salt. ${error.message}`);
      return;
    }
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
    renderCalendar();
  };
  document.getElementById('home-calendar-button')?.addEventListener('click', openCalendar);
  document.getElementById('close-calendar-button')?.addEventListener('click', () => {
    calendarPanel.classList.add('hidden');
    quizPanel.classList.remove('hidden');
  });
  document.getElementById('calendar-previous-button')?.addEventListener('click', () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById('calendar-next-button')?.addEventListener('click', () => {
    const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    if (nextMonth <= currentMonth) {
      calendarMonth = nextMonth;
      renderCalendar();
    }
  });
  document.getElementById('close-workout-setup-notice')?.addEventListener('click', () => {
    document.getElementById('workout-setup-notice').classList.add('hidden');
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
