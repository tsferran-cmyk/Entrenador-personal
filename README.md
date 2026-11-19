# Entrenador personal + Google Sheets

## Plans mensuals i Pim pam

En seleccionar entrenament auto-generat, primer es comprova si ja existeix
el fitxer del mes. Si existeix, es mostren **Entrenar** i **Revisar entrenaments**;
no es torna a generar ni es compara amb els valors del qüestionari.
Entrenar obre la rutina següent a l'última sessió acabada i torna a la primera
quan s'ha completat el cicle. Revisar mostra exercicis, modalitat, durada i
sessions acabades aquest mes. En obrir una rutina es poden escollir i desar
alternatives abans d'entrenar, conservant modalitat, material, zones i alternança.
Els pesos i les repeticions del substitut provenen del seu propi registre.
Els canvis afecten el pla; el log històric es conserva.

El recompte agrupa les files per sessió, no per sèrie. Les sessions noves desen
una marca explícita de finalització; per als logs antics es comprova que hi
constin totes les sèries de tots els exercicis de la rutina. Les sessions
incompletes no fan avançar la rotació. Si no es pot llegir el pla, es mostra
l'error i es permet reintentar, sense generar-ne un altre automàticament.

L'entrenament auto-generat correspon al mes natural a Europa/Madrid. Per crear
un pla nou no es poden demanar més rutines que dies restants, incloent-hi avui:
el 29 de novembre en queden 2; el 23 en queden 8. Un pla ja creat es pot tornar
a obrir fins al final del seu mes. El mes següent es genera un fitxer nou i
es conserva l'anterior com a històric. Una sessió oberta també caduca en canviar de mes.

El formulari demana dies totals, material, durada, dies de força/mobilitat/càrdio
i, per als dies de força, dies per zona corporal. Les modalitats han de sumar
el total i les zones han de sumar els dies de força. Cada rutina té la seva
modalitat i zona; no es barregen els filtres de totes les rutines en obrir-ne una.
Si el catàleg no permet crear prou rutines diferents, s'indica l'error.
Les opcions de força inclouen `Superior + Inferior`, `Superior + Core` i
`Inferior + Core`. Cada combinació compta com un sol dia. Els exercicis
alternen les zones, sense repetir-ne dos de seguits; amb un nombre imparell,
una zona té un exercici més. L'Excel del pla conserva la combinació i la zona
de cada exercici, que també es mostra durant la sessió i es registra al log.
Si falta una zona o no hi ha prou exercicis per alternar, cal canviar els
filtres, reduir la durada o ampliar el catàleg. Els plans anteriors continuen
obrint-se quan les combinacions noves tenen zero dies.
Els fitxers mensuals antics, sense la nova distribució, demanen confirmar-ne la regeneració.

Pim pam genera una sessió: primer modalitat i, si és força, zones corporals.
Si s'escullen diverses zones concretes de força, també s'alternen els exercicis.
Força + mobilitat ja no és una opció del qüestionari.

A `demo.html`, el camp «Data per provar el canvi de mes» permet comprovar
els exemples sense OAuth. La demo reutilitza el generador i les validacions
de l'aplicació; el fitxer i els registres es mantenen en memòria.

Proves locals: `tests/run-catalog-tests.ps1`,
`tests/run-workout-ui-tests.ps1`, `tests/run-workout-ui-tests.ps1 -Monthly`
i `tests/run-workout-ui-tests.ps1 -Demo`.
El nou flux de consulta i edició es comprova amb `tests/run-workout-ui-tests.ps1 -Hub`.

## Catàleg actual: 12 columnes

El catàleg local té 66 exercicis i les columnes, en aquest ordre:
`ID`, `Nom CA`, `Nom EN`, `Modalitat`, `Grups musculars`, `Grups articulars`,
`Patró de moviment`, `Material`, `Lateralitat`, `Mètriques de registre`,
`Instruccions`, `Vídeo / enllaç`.

Cal informar ID únic, nom català, modalitat, material i mètriques. Força exigeix
grups musculars; mobilitat exigeix grups articulars; una modalitat combinada
exigeix tots dos. Els filtres utilitzen els grups de la modalitat escollida.
Cardio també accepta la classificació existent `Condicionament`.
Els grups múltiples se separen amb punt i coma. `Instruccions` és text lliure;
es poden incloure traduccions dins de la mateixa cel·la (no es tradueix automàticament).

`Actiu` és opcional per compatibilitat: si falta, tots els exercicis estan disponibles.
Les valoracions sí/no/potser continuen funcionant en catàlegs que conservin aquesta
columna. Les columnes antigues i les preferències originals es conserven a
`backups/Catàleg exercicis.original.xlsx`.

La migració és local: per utilitzar el nou catàleg a l'aplicació connectada cal
actualitzar també el fitxer corresponent de Google Drive.

### Previsualització dins de Visual Studio Code

Per provar les tres opcions d'entrenament sense OAuth, obre
`http://127.0.0.1:8000/demo.html` al Simple Browser. Aquesta pàgina reutilitza
la interfície original, el catàleg local i un entrenament propi d'exemple.
El registre i les repeticions de demostració es mantenen en memòria i es perden
en recarregar. No es connecta a Google Drive.

1. Obre aquesta carpeta a VS Code.
2. Executa **Terminal > Run Task > Fit Flow: previsualitzar**.
3. Prem `Ctrl+Shift+P`, executa **Simple Browser: Show** i introdueix
   `http://127.0.0.1:8000/preview.html`.

La previsualització funciona sense Google ni biblioteques externes. Utilitza
els mateixos filtres que el programa i una còpia de les dades de l'Excel.
Després d'editar l'Excel, executa `python tools/migrate_catalog.py` per actualitzar-la.
El programa complet és a `http://127.0.0.1:8000/index.html` i requereix Google.

La documentació històrica següent descriu també el format anterior amb `Actiu`.

## Catàleg i valoració dels exercicis

El catàleg admet `Actiu` amb `sí`, `no` i `potser`. Tant `sí` com `potser` entren a les propostes. Després d’una sessió, es poden valorar els exercicis `potser` que s’han registrat com a fets. «Més endavant» conserva aquest estat i es torna a preguntar després de tornar a fer l’exercici. «M’agrada» desa `sí`; «No m’agrada» desa `no` al catàleg de Drive.

Per als exercicis descartats del pla auto-generat del mes, es proposa un equivalent de la mateixa modalitat que cobreixi tots els grups musculars originals (grups articulars per a mobilitat), respectant els filtres del qüestionari. Cal confirmar cada substitució. Si s’ajorna, es torna a proposar quan s’obre el pla mensual; l’exercici marcat `no` s’exclou de la sessió. Si no hi ha equivalent, l’app ho indica. Les substitucions afecten les rutines que es faran a partir d’ara; el registre mensual del que ja s’ha fet es conserva. Els valors de pes i repeticions del substitut provenen de `Repeticions actuals`, sense copiar els de l’exercici descartat.

La plantilla nova inclou: `ID`, `Nom CA`, `Nom EN`, `Modalitat`, `Grups musculars`, `Grups articulars`, `Patró de moviment`, `Material`, `Lateralitat`, `Mètriques de registre`, `Instruccions`, `Vídeo / enllaç` i `Actiu`. Es manté la lectura dels noms de columna antics. Per a les zones superior/core/inferior, es conserva `Zona corporal` si existeix; altrament s’infereix dels grups coneguts. Es recomana conservar aquesta columna opcional per a classificacions amb noms especials.

L’Excel local conserva també les columnes anteriors i afegeix els grups articulars dels exercicis de mobilitat a partir de la classificació existent, que es pot refinar manualment. `Actiu` té una llista de validació amb els tres estats. Les preferències existents es conserven.

Per desar valoracions en catàlegs natius de Google Sheets cal tornar a autoritzar Google amb permís d’escriptura de Sheets. Els canvis es desen a les cel·les afectades; en Excel es conserva el llibre amb totes les pestanyes. El fitxer local s’ha de pujar al directori de Drive si es vol utilitzar la versió migrada.

Comprovacions locals del JavaScript amb Edge sense finestra: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/run-catalog-tests.ps1`. El canvi de política només afecta aquest procés de proves. Es validen els camps obligatoris de les files disponibles del catàleg nou, els estats i els ID únics.

> Nota de validació de desplegament: aquesta versió s’ha revisat el 14/09/2026 i està preparada per publicar-se a GitHub Pages amb la branca `main` com a font de desplegament.

Aplicació web per gestionar accés segur amb Google, carregar les dades d’un full de Google Sheets i generar entrenaments personalitzats a partir d’un breu qüestionari.

## Què fa

- Login mitjançant Google Identity Services
- Accés i escriptura de fitxers de Google Drive amb OAuth 2.0
- Permet escollir entre:
  - entrenament propi
  - entrenament auto-generat per al mes actual
  - `Pim pam`, una proposta nova a partir del catàleg
- Per als entrenaments auto-generats i `Pim pam`, pregunta:
  - tipus d’entrenament: força, mobilitat o força + mobilitat
  - durada: 15, 30, 45 o 60 minuts
  - una o més zones a treballar: part superior, core o inferior
- L'entrenament auto-generat demana quantes rutines diferents vols i crea o reutilitza `Entrenament auto-generat AAAA.MM.xlsx`.
- Crea `Repeticions actuals.xlsx` i hi desa les sèries, repeticions i pesos per reutilitzar-los en propostes futures.
- Genera un entrenament automàtic
- Llegeix el catàleg d’exercicis en format Excel o Google Sheets
- La columna opcional `Zona corporal` classifica els exercicis com `superior`, `inferior`, `core` o `fullbody`; si falta, es dedueix dels grups musculars o articulars reconeguts.
- `Material opcional` es mostra a la fitxa de l’exercici. Quan s’indica que no es disposa de material, només es proposen exercicis amb `Material requerit` igual a `Cap` (o equivalent).
- Crea o actualitza el log mensual `MM.AAAA - Log entrenament.xlsx`

## Important: arquitectura real a GitHub

GitHub Pages és una web estàtica. Per autenticar amb Google i llegir dades privades de Google Sheets, el que s’ha de fer és:

1. Configurar OAuth 2.0 amb Google Cloud
2. Habilitar Google Sheets API
3. Registrar l’origen web a GitHub Pages i el localhost per provar-ho localment
4. Autoritzar els permisos del compte de Google

Això permet que l’usuari faci login amb el seu compte i autoritzi només el seu propi full de Google Sheets. No hi ha una base de dades compartida i no es penja cap secret al repositori.

## Fitxers principals

- `index.html` — formulari i pantalla principal
- `styles.css` — estil i maquetació
- `script.js` — flux de login i generació de l’entrenament
- `config.js` — configuració del Client ID de Google

## Configurar Google

1. Crea un projecte a Google Cloud Console
2. Habilita l’API de Google Sheets
3. Habilita també la **Google Drive API**
4. Crea un OAuth Client ID de tipus Web
5. Afegeix com a JavaScript origins:
   - `http://localhost:8000`
   - `https://<el-teu-usuari>.github.io`
6. Afegeix el compte de proves a la pantalla de consentiment OAuth
7. Omple el valor de `GOOGLE_CLIENT_ID` a `config.js`

L’aplicació busca al directori configurat els fitxers que comencen per:

- `Catàleg exercicis` — font dels exercicis proposats, en `.xlsx` o Google Sheets
- `Plantilla log entrenament` — plantilla del log mensual

En generar un entrenament, necessita el permís OAuth de Drive per llegir el catàleg i crear o actualitzar el fitxer mensual.

Exemple:

```js
window.GOOGLE_CLIENT_ID = '123456789012-abc...apps.googleusercontent.com';
```

## Executar localment

```bash
cd "C:\ruta\al\projecte"
python -m http.server 8000
```

I obre:

```text
http://localhost:8000
```

## Pujar a GitHub

```bash
git init
git add .
git commit -m "Primer commit: web entrenador personal"
git branch -M main
git remote add origin https://github.com/<USUARI>/<REPOSITORI>.git
git push -u origin main
```

## Activar GitHub Pages

- Entra al repositori de GitHub
- Settings > Pages
- Source: Deploy from a branch
- Branch: main / root

## Recomendació de continuació

La següent millora útil és afegir:

- una base de dades pròpia per gravar plans assignats
- una pàgina d’admin amb clients i activitat
- un botó per guardar entrenaments a Google Sheets
- login amb rol d’entrenador i client
