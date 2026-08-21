# Trabajo Farmer

App local para buscar, optimizar y gestionar ofertas laborales de LinkedIn. Incluye editor de CV con exportación PDF optimizada para ATS, rastreo de ofertas de LinkedIn, y mejorador de texto con IA.

## Stack

| Componente | Tecnología |
|------------|-----------|
| Backend | Node.js + Express :3001 |
| Frontend | React 19 + Vite :5173 |
| Base de datos | SQLite (node:sqlite, sin flags) |
| Estilos | Tailwind CSS v4 |
| PDF | pdfkit (exportación), pdfjs-dist (re-parseo) |
| IA | OpenAI-compatible API (DeepSeek, OpenAI, Groq, OpenRouter, Ollama) |
| Scraping | LinkedIn guest endpoint (sin API key) |

## Instalación

```bash
# Instalar dependencias del server y del client
cd server && npm install
cd ../client && npm install

# Volver a la raíz
cd ..
```

## Uso

```bash
# Arrancar server y client juntos
npm run dev

# O por separado
npm run dev:server   # Express en http://localhost:3001
npm run dev:client   # Vite en http://localhost:5173
```

## Funcionalidades

### CV
- **Upload de PDF**: extrae texto con parseo espacial (columnas, bullets, headers) y lo volca al editor
- **Editor completo**: nombre, título, contacto, resumen, experiencia, educación, skills, idiomas, proyectos, certificaciones
- **4 plantillas PDF**: Clásica, Moderna, Minimal, Sidebar (con aviso de riesgo ATS)
- **Auto-fit 1 hoja**: ajusta escala automáticamente para que el CV siempre entre en una página
- **ATS Check**: re-parsea el PDF exportado y verifica legibilidad (nombre, contacto, resumen, skills, fechas, columnas, etc.)
- **Exportación en inglés**: toggle ES/EN al exportar — traduce el CV completo con IA y descarga `cv_EN.pdf`

### Ofertas de LinkedIn
- **Búsquedas guardadas**: configurar keywords, ubicación, nivel de experiencia, tipo de empleo, modalidad, antigüedad
- **Scraping**: trae ofertas reales del endpoint guest de LinkedIn (sin API key)
- **Descripción del puesto**: fetch perezoso con caché en DB — se trae una vez y queda guardada
- **Gestión de estado**: marcar como nueva / interesante / aplicada / descartada
- **Notas**: agregar notas por oferta (salario, contacto, fecha de entrevista)
- **Filtros**: buscar por título/empresa, filtrar por estado, todo en tiempo real

### Mejorador de IA
- **Pulir texto**: reescribe resumen y descripciones con tono profesional, sin inventar datos
- **Preview editable**: muestra original vs mejorado, con textarea para retocar antes de aprobar
- **Asistente campo por campo**: "Mejorar todo" revisa cada campo uno por uno con opción de aprobar/saltar
- **Multi-proveedor**: soporta DeepSeek, OpenAI, Groq, OpenRouter y Ollama (local, sin key)

## Estructura del proyecto

```
Trabajo-Farmer/
├── server/
│   └── src/
│       ├── index.js        # Rutas Express
│       ├── db.js           # SQLite (cv, searches, jobs, settings)
│       ├── cvParser.js     # Parseo espacial de PDFs
│       ├── cvPdf.js        # Exportación PDF (4 plantillas, auto-fit)
│       ├── pdfText.js      # Extracción de texto + clustering de columnas
│       ├── ai.js           # Cliente IA (mejorar texto, test conexión)
│       └── linkedin.js     # Scraping LinkedIn (búsqueda + descripción)
├── client/
│   └── src/
│       ├── App.jsx          # Router y navegación
│       └── pages/
│           ├── CV.jsx       # Editor de CV + plantillas + preview IA
│           ├── Busquedas.jsx # CRUD de búsquedas de LinkedIn
│           ├── Ofertas.jsx  # Gestión de ofertas (estados, notas, descripción)
│           └── Configuracion.jsx # Configurar proveedor IA
└── mi-cv.pdf               # (local, no incluido en el repo)
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/cv` | Obtener CV guardado |
| PUT | `/api/cv` | Guardar CV |
| POST | `/api/cv/upload` | Subir PDF y parsear |
| GET | `/api/cv/export?template=clasica` | Exportar PDF |
| POST | `/api/cv/check` | Verificar compatibilidad ATS |
| POST | `/api/cv/improve` | Mejorar texto con IA |
| GET | `/api/settings` | Configuración IA (key enmascarada) |
| PUT | `/api/settings` | Guardar configuración IA |
| POST | `/api/ai/test` | Test de conexión con proveedor |
| GET | `/api/searches` | Listar búsquedas |
| POST | `/api/searches` | Crear búsqueda |
| PUT | `/api/searches/:id` | Editar búsqueda |
| DELETE | `/api/searches/:id` | Eliminar búsqueda |
| GET | `/api/jobs` | Listar ofertas (filtro por status, q, searchId) |
| PATCH | `/api/jobs/:id` | Actualizar estado/nota |
| GET | `/api/jobs/:id/description` | Obtener descripción de LinkedIn (caché) |
| POST | `/api/jobs/fetch` | Traer ofertas de LinkedIn |

## Configurar IA

En **Configuración** podés elegir proveedor y modelo:

| Proveedor | URL base | Key | Modelo default |
|-----------|----------|-----|----------------|
| DeepSeek | `https://api.deepseek.com` | Sí | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | Sí | `gpt-4o-mini` |
| Groq | `https://api.groq.com/openai/v1` | Sí | `llama-3.3-70b-versatile` |
| OpenRouter | `https://openrouter.ai/api/v1` | Sí | `deepseek/deepseek-chat` |
| Ollama | `http://localhost:11434/v1` | No | `llama3.2` |

Para Ollama: instalar localmente con `ollama pull llama3.2`.

## Notas técnicas

- El scraping de LinkedIn usa el endpoint guest público (sin OAuth). Puede bloquear temporalmente (999/429) si se abusa.
- El parseo de PDFs usa clustering por mediana de huecos para detectar columnas (funciona bien con Canva, Word, etc.)
- El auto-fit de 1 hoja prueba escalas decrecientes (1.0 → 0.74) hasta que el PDF quepa en una página.
- El parseo del CV corrige errores comunes del texto extraído de PDFs (espacios faltantes, bullets inline, headers ocupando líneas).
