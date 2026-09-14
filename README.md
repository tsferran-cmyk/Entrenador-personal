# Entrenador personal

Una web de presentació per a un entrenador personal, dissenyada per a presentar serveis, objectius, programes i captar clients via formularis.

## Requisits

- Un navegador modern.
- Opcionalment, Python per servir el projecte localment.

## Executar localment

Des de la carpeta del projecte:

```bash
python -m http.server 8000
```

I obre a:

```text
http://localhost:8000
```

## Estructura

- `index.html` — contingut de la pàgina
- `styles.css` — estil i maquetació
- `script.js` — lògica de programes i formularis

## Publicar a GitHub

1. Crea un repositori a GitHub.
2. Inicialitza el repositori local amb `git init`.
3. Connecta el remot:

```bash
git remote add origin https://github.com/USUARI/REPOSITORI.git
```

4. Fes el primer commit i puja:

```bash
git add .
git commit -m "Primer commit: web d'entrenador personal"
git push -u origin main
```

## Personalització

- Canvia el nom i el text a `index.html`.
- Modifica els colors i la tipografia a `styles.css`.
- Ajusta la lògica de planificació a `script.js`.

## Recomendació

Per a una versió més avançada, el següent pas és afegir:

- panell d'administració per gestionar clients
- login d'entrenador
- base de dades o Google Sheets
- reserva de cites i pagaments
