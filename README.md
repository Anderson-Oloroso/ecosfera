# Ecosfera — Chat Musical Dinámico & Estudio RAG en SQLite

## Objetivo
**Ecosfera** es una aplicación web modular en Node.js ESM que unifica búsqueda vectorial en **SQLite nativo**, **embeddings con Gemini** y **reproducción directa desde YouTube** en dos funcionalidades integradas:
1. **App Chat (`#view-chat`):** asistente conversacional dinámico con contexto multi-turno acotado, tarjetas de canciones reproducibles desde YouTube cuando el tema coincide y un reproductor integrado en el mismo espacio.
2. **Interfaz App (`#view-studio`):** consola técnica RAG con trazabilidad de 4 etapas, huella del vector de 32 dimensiones, métricas de optimización/caché, catálogo de fichas teóricas, catálogo musical bilingüe/instrumental (`27` canciones iniciales) y gestión CRUD en SQLite.

---

## Arquitectura UX & Optimización (Fine-Tuning de Tokens)
- **Estética Negro Puro + Luces de Borde:** modo oscuro por defecto con fondo negro neutro (`#050506` / `#0C0C0E` / `#141417`) sin contaminación naranja en el fondo, reservando rojo (`#E53935`), naranja (`#FF7A1A`) y amarillo (`#F5C542`) para bordes degradados, contornos activos y botones; incluye toggle a modo claro neutro.
- **Reducción de tokens y latencia:**
  - Caché LRU en RAM para embeddings de consulta (`128` entradas) y respuestas (`64` entradas, TTL `5 min`), logrando `0` tokens y respuesta inmediata en consultas repetidas (`cacheHit: true`).
  - Índices vectoriales de fichas y canciones cacheados en memoria e invalidados al crear o eliminar registros.
  - Prompt del sistema compacto, contexto recortado (`MAX_CONTEXT_CHARS=1400`) e historial de chat limitado a los últimos `4` turnos.
  - Cero consumo de LLM y cero tarjetas de coincidencia cuando una pregunta sale del dominio musical (`grounded: false`, `matches: []`).

---

## Tecnologías
- **Runtime:** Node.js `>=22.0.0` (probado en `v25.9.0`, ES Modules nativos + `node:sqlite`)
- **IA y Embeddings:** `@google/genai` (`^3.6.1`), `gemini-embedding-2` (`768` dims) y `gemini-3.5-flash-lite` (respaldo automático vía `GEMINI_CHAT_FALLBACK_MODELS=gemini-3.5-flash,gemini-4-hydrogen`)
- **Base de datos:** SQLite (`./data/music_knowledge.db`) con `knowledge_documents`, `music_tracks` (con columna `embedding BLOB`) y `query_logs`
- **Frontend:** HTML5 semántico, CSS3 bitema sin dependencias externas y reproductor embebido YouTube

---

## Endpoints Principales

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado de SQLite, modelos activos, vectores listos/pendientes y estadísticas de caché |
| `POST` | `/api/chat` | Conversación dinámica de **App Chat** con historial acotado y canciones recomendadas |
| `POST` | `/api/query` | Consulta técnica de **Interfaz App** (devuelve `matches: []` si `grounded === false`) |
| `GET` / `POST` / `DELETE` | `/api/documents` | Gestión de fichas de teoría musical con vectorización inmediata |
| `GET` / `POST` / `DELETE` | `/api/tracks` | Catálogo musical (`es`, `en`, `instrumental`) con extracción y vectorización YouTube |
| `POST` | `/api/sync-embeddings` | Sincroniza vectores faltantes de fichas y canciones en SQLite |
| `GET` | `/api/history` | Últimas consultas registradas en `query_logs` |

---

## Cómo Ejecutar y Validar

1. Configura tu `GEMINI_API_KEY` en `.env` (usa `.env.example` como plantilla).
2. Verifica sintaxis y configuración (`sí` / `no`):
   ```bash
   npm run check
   npm test
   ```
   Para ver el detalle paso a paso:
   ```bash
   npm run test:verbose
   ```
3. Inicia **Ecosfera**:
   ```bash
   npm start
   ```
   Abre `http://localhost:3000`.

---

## Creador
- **Nombre:** Henrik Anderson Oloroso García (`Anderson-Oloroso`)
- **GitHub:** [github.com/Anderson-Oloroso](https://github.com/Anderson-Oloroso)
- **Portafolio:** [anderson-oloroso.github.io/portfolio](https://anderson-oloroso.github.io/portfolio/)
- **Fecha:** `2026-11-27`
