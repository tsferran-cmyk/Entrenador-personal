# Entrenador personal + Google Sheets

> Nota de validació de desplegament: aquesta versió s’ha revisat el 14/09/2026 i està preparada per publicar-se a GitHub Pages amb la branca `main` com a font de desplegament.

Aplicació web per gestionar accés segur amb Google, carregar les dades d’un full de Google Sheets i generar entrenaments personalitzats a partir d’un breu qüestionari.

## Què fa

- Login mitjançant Google Identity Services
- Accés i escriptura de fitxers de Google Drive amb OAuth 2.0
- Pregunta si vols:
  - accedir a un entrenament propi
  - o que la web et proposi un entrenament
- Si és proposat, pregunta:
  - tipus d’entrenament: força, mobilitat o força + mobilitat
  - durada: 15, 30, 45 o 60 minuts
  - zona a treballar: part superior, core, inferior, full body o recuperació
- Genera un entrenament automàtic
- Llegeix el `Catàleg exercicis.xlsx` del directori configurat
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

- `Catàleg exercicis` — font dels exercicis proposats
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
