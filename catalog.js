// Compatibility with the original catalogue and the current catalogue schema.
function normalizeCatalogExercise(row) {
  row = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), value]));
  const value = (...aliases) => getColumnValue(row, aliases);
  const muscles = value('Grups musculars', 'Zones principals');
  const joints = value('Grups articulars');
  return {
    ...row,
    ID: String(value('ID')).trim(),
    Actiu: value('Actiu') || 'sí',
    'Nom CA': value('Nom CA'),
    'Nom EN': value('Nom EN'),
    Modalitat: value('Modalitat'),
    'Grups musculars': muscles,
    'Grups articulars': joints,
    'Mètriques de registre': value('Mètriques de registre'),
    catalogRegionInferred: !value('Zona corporal'),
    'Zones principals': normalizeColumnName(value('Modalitat')).includes('forca') ? muscles : joints || muscles,
    'Zones secundàries': value('Zones secundàries'),
    'Material requerit': value('Material', 'Material requerit'),
    'Instruccions CA': value('Instruccions', 'Instruccions CA'),
    Link: value('Vídeo / enllaç', 'Link', 'Enllaç vídeo', 'Vídeo'),
    'Zona corporal': value('Zona corporal') || inferCatalogRegion(`${muscles};${joints}`)
  };
}

function inferCatalogRegion(groups) {
  const tokens = normalizeColumnName(groups);
  if (/cossencer|fullbody/.test(tokens)) return 'fullbody';
  const regions = [];
  if (/pectoral|dorsal|esquena|delto|espatll|biceps|triceps|brac|colze|canell/.test(tokens)) regions.push('superior');
  if (/abdomin|core|oblic|lumbar|tronc|columna/.test(tokens)) regions.push('core');
  if (/gluti|glute|quadriceps|isquio|bess|soli|cames?|maluc|genoll|turmell|adductor|abductor/.test(tokens)) regions.push('inferior');
  return regions.length > 1 ? 'fullbody' : regions[0] || '';
}

// A mixed exercise uses the groups belonging to the requested modality.
function catalogGroups(exercise, trainingType) {
  const modality = normalizeColumnName(exercise.Modalitat || exercise.modality || exercise.type || '');
  const muscles = exercise['Grups musculars'] ?? exercise['Zones principals'] ?? '';
  const joints = exercise['Grups articulars'] ?? exercise['Zones principals'] ?? '';
  if (trainingType === 'cardio') return muscles || joints;
  if (trainingType === 'forca') return modality.includes('forca') ? muscles : '';
  if (trainingType === 'mobilitat') return modality.includes('mobilitat') ? joints : '';
  return [modality.includes('forca') ? muscles : '', modality.includes('mobilitat') ? joints : ''].filter(Boolean).join(';');
}

function isCatalogAvailable(exercise) {
  return ['si', 'potser'].includes(normalizeColumnName(exercise.Actiu));
}

async function loadExerciseCatalog() {
  const file = findCatalogFile();
  if (!file) throw new Error('No s’ha trobat el catàleg d’exercicis.');
  const rows = await readSpreadsheetRows(file);
  return parseExerciseCatalog(rows);
}

function parseExerciseCatalog(rows) {
  const headers = rows.shift() || [];
  const currentSchema = headers.some((header) => normalizeColumnName(header) === 'grupsmusculars');
  const seen = new Set();
  return rows.map((row, index) => {
    const exercise = normalizeCatalogExercise(Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
    if (!exercise.ID && !exercise['Nom CA']) return null;
    if (!exercise.ID || seen.has(exercise.ID)) throw new Error(`Fila ${index + 2}: cal un ID únic.`);
    seen.add(exercise.ID);
    if (!['si', 'no', 'potser'].includes(normalizeColumnName(exercise.Actiu))) throw new Error(`Fila ${index + 2}: Actiu ha de ser sí, no o potser.`);
    if (currentSchema && isCatalogAvailable(exercise)) {
      const required = ['Nom CA', 'Modalitat', 'Material requerit', 'Mètriques de registre'];
      const modality = normalizeColumnName(exercise.Modalitat);
      if (modality.includes('forca')) required.push('Grups musculars');
      if (modality.includes('mobilitat')) required.push('Grups articulars');
      const missing = required.filter((field) => !String(exercise[field] || '').trim());
      if (missing.length) throw new Error(`Fila ${index + 2} (${exercise.ID}): falten ${missing.join(', ')}.`);
    }
    return exercise;
  }).filter(Boolean);
}

// Preserve every sheet and cell outside the explicit edits, including historical data.
async function editExerciseWorkbook(file, edit) {
  if (!accessToken) throw new Error('Cal tornar a iniciar sessió amb Google.');
  const native = file.mimeType === 'application/vnd.google-apps.spreadsheet';
  const url = native
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(`No s’ha pogut llegir ${file.name} (${response.status}).`);
  const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true });
  const changes = edit(rows);
  if (!changes.length) return;
  if (native) {
    const data = changes.map(({ row, column, value }) => ({
      range: `'${workbook.SheetNames[0].replace(/'/g, "''")}'!${XLSX.utils.encode_cell({ r: row, c: column })}`,
      values: [[value]]
    }));
    const saved = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(file.id)}/values:batchUpdate`, {
      method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data })
    });
    if (!saved.ok) throw new Error(`No s’han pogut desar els canvis (${saved.status}).`);
  } else {
    changes.forEach(({ row, column, value }) => {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      sheet[address] = { ...(sheet[address] || {}), t: 's', v: String(value) };
      delete sheet[address].f;
      delete sheet[address].w;
    });
    await uploadSpreadsheet(file.name, XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }), file.id, extractGoogleId(directoryInput.value.trim()));
  }
}

async function saveExerciseRating(id, rating) {
  await editExerciseWorkbook(findCatalogFile(), (rows) => {
    const idColumn = rows[0].findIndex((h) => normalizeColumnName(h) === 'id');
    const activeColumn = rows[0].findIndex((h) => normalizeColumnName(h) === 'actiu');
    const row = rows.findIndex((r, i) => i > 0 && String(r[idColumn]).trim() === id);
    if (row < 1 || activeColumn < 0) throw new Error('Cal que el catàleg tingui ID únic i columna Actiu.');
    return [{ row, column: activeColumn, value: rating }];
  });
}

function equivalentCatalogExercises(original, catalog, criteria) {
  const mobility = normalizeColumnName(original.Modalitat).includes('mobilitat');
  const groups = (exercise) => getZoneTokens(criteria
    ? catalogGroups(exercise, criteria.trainingType)
    : mobility ? exercise['Grups articulars'] || exercise['Zones principals']
    : exercise['Grups musculars'] || exercise['Zones principals']);
  const required = groups(original);
  if (!required.length) return [];
  return catalog.filter((candidate) => candidate.ID !== original.ID && isCatalogAvailable(candidate)
    && normalizeColumnName(candidate.Modalitat) === normalizeColumnName(original.Modalitat)
    && required.every((group) => groups(candidate).includes(group))
    && (!criteria || exerciseMatchesCriteria(candidate, criteria)));
}

async function confirmMonthlyReplacements(file, catalog, criteria) {
  const rows = await readSpreadsheetRows(file);
  const headers = rows.shift() || [];
  const idColumn = headers.findIndex((h) => normalizeColumnName(h) === 'exerciciid');
  if (idColumn < 0) return;
  const ids = new Set(rows.map((r) => String(r[idColumn]).trim()));
  for (const original of catalog.filter((exercise) => ids.has(exercise.ID) && normalizeColumnName(exercise.Actiu) === 'no')) {
    const candidates = equivalentCatalogExercises(original, catalog, criteria);
    const replacement = candidates.find((candidate) => !ids.has(candidate.ID)) || candidates[0];
    if (!replacement) {
      window.alert(`No hi ha cap equivalent disponible per a «${original['Nom CA']}». Revisa el catàleg; no es proposarà l’exercici descartat.`);
      continue;
    }
    if (!window.confirm(`Vols substituir «${original['Nom CA']}» per «${replacement['Nom CA']}» a les sessions que facis a partir d’ara aquest mes? El registre d’entrenaments fets es conservarà.`)) continue;
    const repetitions = await readCurrentRepetitions();
    const mapped = applyCurrentRepetition({ id: replacement.ID, nameCa: replacement['Nom CA'], totalSeries: 1 }, repetitions.rows, repetitions.headers);
    const values = {
      exerciciid: replacement.ID, exercici: replacement['Nom CA'], modalitat: replacement.Modalitat,
      tipus: `${replacement.Fase || 'Entrenament principal'} - ${replacement.Modalitat}`,
      material: replacement['Material requerit'], materialopcional: replacement['Material opcional'] || '',
      descripcio: replacement['Instruccions CA'], link: replacement.Link,
      zonacorporal: replacement['Zona corporal'], zonesprincipals: replacement['Zones principals'],
      zonessecundaries: replacement['Zones secundàries'] || '', fase: replacement.Fase || '',
      series: mapped.totalSeries || 1, repeticions: mapped.reps || '', pes: mapped.weight || ''
    };
    await editExerciseWorkbook(file, (allRows) => allRows.flatMap((row, index) => index > 0 && String(row[idColumn]).trim() === original.ID
      ? allRows[0].flatMap((header, column) => Object.hasOwn(values, normalizeColumnName(header))
        ? [{ row: index, column, value: values[normalizeColumnName(header)] }] : []) : []));
    ids.delete(original.ID);
    ids.add(replacement.ID);
  }
}

function askExerciseRating(exercise) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'exercise-dialog';
    const title = document.createElement('h3');
    title.textContent = `T’agrada «${exercise['Nom CA']}»?`;
    dialog.append(title);
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    const close = (value) => { dialog.close(); dialog.remove(); resolve(value); };
    [['Més endavant', null], ['No m’agrada', 'no'], ['M’agrada', 'sí']].forEach(([label, value]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button ghost';
      button.textContent = label;
      button.addEventListener('click', () => close(value));
      actions.append(button);
    });
    dialog.append(actions);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(null); });
    document.body.append(dialog);
    dialog.showModal();
  });
}

let reviewingExercises = false;
async function reviewTriedExercises(exercises) {
  if (reviewingExercises || !exercises.some((exercise) => exercise.performed)) return;
  reviewingExercises = true;
  try {
    const catalog = await loadExerciseCatalog();
    const tried = new Set(exercises.filter((exercise) => exercise.performed).map((exercise) => String(exercise.id)));
    const pending = catalog.filter((exercise) => tried.has(exercise.ID) && normalizeColumnName(exercise.Actiu) === 'potser');
    if (!pending.length || !window.confirm('Has provat exercicis nous. Vols valorar-los ara? Si ho deixes per més endavant, t’ho tornarem a demanar quan els tornis a fer.')) return;
    for (const exercise of pending) {
      const rating = await askExerciseRating(exercise);
      if (!rating) continue;
      await saveExerciseRating(exercise.ID, rating);
      exercise.Actiu = rating;
    }
    const file = (window.driveFiles || []).find((item) => item.name === getCurrentMonthAutoFileName());
    if (file) await confirmMonthlyReplacements(file, catalog, workoutCriteria);
  } catch (error) {
    window.alert(`No s’ha pogut completar la valoració. ${error.message} Les valoracions no desades es tornaran a demanar després de fer l’exercici.`);
  } finally {
    reviewingExercises = false;
  }
}
