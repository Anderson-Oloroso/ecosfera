const THEME_STORAGE_KEY = "ecosfera-theme";
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const LANGUAGE_LABELS = {
  es: "Español",
  en: "Inglés",
  instrumental: "Instrumental",
};

const PIPELINE_DEFAULTS = [
  { id: "embed_query", defaultDetail: "Vectoriza o reutiliza caché LRU." },
  { id: "sqlite_scan", defaultDetail: "Lee fichas y canciones vectorizadas." },
  { id: "cosine_rank", defaultDetail: "Filtra coincidencias sobre umbral." },
  { id: "llm_synthesis", defaultDetail: "Genera respuesta compacta en tokens." },
];

const STATUS_LABELS = {
  idle: "En espera",
  running: "En curso",
  done: "Completado",
  error: "Error",
};

const state = {
  activeView: "chat",
  documents: [],
  categories: [],
  selectedCategory: "",
  confirmDeleteId: null,
  tracks: [],
  trackGenres: [],
  selectedGenre: "",
  selectedLanguage: "",
  trackSearch: "",
  activeTrackId: null,
  confirmDeleteTrackId: null,
  chatHistory: [],
  chatBusy: false,
  isQuerying: false,
  isSyncing: false,
  pipelineTimer: null,
  clientCache: new Map(),
  activeQueryController: null,
  activeChatController: null,
};

const dom = {
  navChatBtn: document.getElementById("nav-chat-btn"),
  navStudioBtn: document.getElementById("nav-studio-btn"),
  viewChat: document.getElementById("view-chat"),
  viewStudio: document.getElementById("view-studio"),

  themeToggle: document.getElementById("theme-toggle"),
  themeToggleLabel: document.getElementById("theme-toggle-label"),
  healthPill: document.getElementById("health-pill"),
  healthVectors: document.getElementById("health-vectors"),
  healthModels: document.getElementById("health-models"),
  syncVectorsBtn: document.getElementById("sync-vectors-btn"),

  // App Chat
  chatOptBadge: document.getElementById("chat-opt-badge"),
  chatClearBtn: document.getElementById("chat-clear-btn"),
  chatMessages: document.getElementById("chat-messages"),
  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  chatCharCount: document.getElementById("chat-char-count"),
  chatSubmit: document.getElementById("chat-submit"),
  chatChips: document.querySelectorAll(".chat-chip"),

  chatYtStopBtn: document.getElementById("chat-yt-stop-btn"),
  chatYtEmpty: document.getElementById("chat-yt-empty"),
  chatYtFrameWrap: document.getElementById("chat-yt-frame-wrap"),
  chatYtIframe: document.getElementById("chat-yt-iframe"),
  chatYtNow: document.getElementById("chat-yt-now"),
  chatYtTitle: document.getElementById("chat-yt-title"),
  chatYtMeta: document.getElementById("chat-yt-meta"),
  chatYtLink: document.getElementById("chat-yt-link"),
  chatLangFilter: document.getElementById("chat-lang-filter"),
  chatGenrePills: document.getElementById("chat-genre-pills"),
  chatTrackSearch: document.getElementById("chat-track-search"),
  chatTracksList: document.getElementById("chat-tracks-list"),
  chatAddTrackForm: document.getElementById("chat-add-track-form"),
  chatTrackTitle: document.getElementById("chat-track-title"),
  chatTrackArtist: document.getElementById("chat-track-artist"),
  chatTrackGenre: document.getElementById("chat-track-genre"),
  chatTrackLang: document.getElementById("chat-track-lang"),
  chatTrackYear: document.getElementById("chat-track-year"),
  chatTrackYt: document.getElementById("chat-track-yt"),
  chatTrackNotes: document.getElementById("chat-track-notes"),
  chatAddTrackSubmit: document.getElementById("chat-add-track-submit"),
  chatAddTrackFeedback: document.getElementById("chat-add-track-feedback"),

  // Interfaz App
  queryForm: document.getElementById("query-form"),
  queryInput: document.getElementById("query-input"),
  queryCharCount: document.getElementById("query-char-count"),
  topKSelect: document.getElementById("topk-select"),
  querySubmit: document.getElementById("query-submit"),
  studioChips: document.querySelectorAll(".studio-chip"),
  pipelineSteps: document.getElementById("pipeline-steps"),
  pipelineTotalLatency: document.getElementById("pipeline-total-latency"),
  resultPlaceholder: document.getElementById("result-placeholder"),
  resultError: document.getElementById("result-error"),
  resultContent: document.getElementById("result-content"),
  groundedBadge: document.getElementById("grounded-badge"),
  resultOptimization: document.getElementById("result-optimization"),
  resultLatency: document.getElementById("result-latency"),
  answerBody: document.getElementById("answer-body"),
  vectorDims: document.getElementById("vector-dims"),
  vectorNorm: document.getElementById("vector-norm"),
  vectorVisualizer: document.getElementById("vector-visualizer"),
  studioTracksMatchBlock: document.getElementById("studio-tracks-match-block"),
  studioTracksMatchCount: document.getElementById("studio-tracks-match-count"),
  studioTracksMatchList: document.getElementById("studio-tracks-match-list"),
  matchesBlock: document.getElementById("matches-block"),
  matchesCount: document.getElementById("matches-count"),
  matchesList: document.getElementById("matches-list"),

  studioYtStopBtn: document.getElementById("studio-yt-stop-btn"),
  studioYtEmpty: document.getElementById("studio-yt-empty"),
  studioYtFrameWrap: document.getElementById("studio-yt-frame-wrap"),
  studioYtIframe: document.getElementById("studio-yt-iframe"),
  studioYtNow: document.getElementById("studio-yt-now"),
  studioYtTitle: document.getElementById("studio-yt-title"),
  studioYtMeta: document.getElementById("studio-yt-meta"),
  studioYtLink: document.getElementById("studio-yt-link"),
  studioLangFilter: document.getElementById("studio-lang-filter"),
  studioGenrePills: document.getElementById("studio-genre-pills"),
  studioTrackSearch: document.getElementById("studio-track-search"),
  studioMusicStatus: document.getElementById("studio-music-status"),
  studioTracksList: document.getElementById("studio-tracks-list"),

  addTrackForm: document.getElementById("add-track-form"),
  trackTitle: document.getElementById("track-title"),
  trackArtist: document.getElementById("track-artist"),
  trackGenre: document.getElementById("track-genre"),
  genreSuggestions: document.getElementById("genre-suggestions"),
  trackLanguage: document.getElementById("track-language"),
  trackYear: document.getElementById("track-year"),
  trackYoutube: document.getElementById("track-youtube"),
  trackNotes: document.getElementById("track-notes"),
  addTrackSubmit: document.getElementById("add-track-submit"),
  addTrackFeedback: document.getElementById("add-track-feedback"),

  catalogCount: document.getElementById("catalog-count"),
  categoryFilter: document.getElementById("category-filter"),
  categorySuggestions: document.getElementById("category-suggestions"),
  catalogStatus: document.getElementById("catalog-status"),
  documentsList: document.getElementById("documents-list"),
  addDocForm: document.getElementById("add-doc-form"),
  docTitle: document.getElementById("doc-title"),
  docCategory: document.getElementById("doc-category"),
  docTags: document.getElementById("doc-tags"),
  docContent: document.getElementById("doc-content"),
  addDocSubmit: document.getElementById("add-doc-submit"),
  addDocFeedback: document.getElementById("add-doc-feedback"),
  historyList: document.getElementById("history-list"),
};

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function debounce(fn, waitMs = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const apiErrorMessage =
      typeof data?.error === "string"
        ? data.error
        : data?.error?.message || data?.message;
    throw new Error(apiErrorMessage || `Error HTTP ${response.status} al consultar ${url}`);
  }

  return data;
}

/* ---------------- Tema Claro / Oscuro ---------------- */

function applyTheme(theme, persist = false) {
  const safeTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", safeTheme);

  const isDark = safeTheme === "dark";
  dom.themeToggle.setAttribute("aria-pressed", String(isDark));
  dom.themeToggle.setAttribute(
    "aria-label",
    isDark ? "Cambiar a modo día" : "Cambiar a modo noche"
  );
  dom.themeToggleLabel.textContent = isDark ? "Modo día" : "Modo noche";

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
    } catch {
      // Ignorar si storage está bloqueado
    }
  }
}

function initTheme() {
  let initialTheme = "dark";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      initialTheme = saved;
    }
  } catch {
    initialTheme = "dark";
  }

  applyTheme(initialTheme, false);

  dom.themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark", true);
  });
}

/* ---------------- Navegación de las 2 Vistas ---------------- */

function switchView(targetView, updateHash = true) {
  const isStudio = targetView === "studio";
  state.activeView = isStudio ? "studio" : "chat";

  dom.viewChat.hidden = isStudio;
  dom.viewStudio.hidden = !isStudio;

  dom.navChatBtn.setAttribute("aria-current", isStudio ? "false" : "page");
  dom.navStudioBtn.setAttribute("aria-current", isStudio ? "page" : "false");

  stopAllPlayers();

  if (updateHash) {
    const desiredHash = isStudio ? "#interfaz" : "#chat";
    if (window.location.hash !== desiredHash) {
      history.replaceState(null, "", desiredHash);
    }
  }
}

/* ---------------- Estado SQLite & Sync ---------------- */

async function loadHealth() {
  try {
    const raw = await apiRequest("/api/health");
    const docsReady = Number(raw?.vectorsReady ?? 0);
    const docsTotal = Number(raw?.totalDocuments ?? raw?.documentsTotal ?? 0);
    const tracksReady = Number(raw?.tracksVectorsReady ?? 0);
    const tracksTotal = Number(raw?.tracksTotal ?? 0);
    const pending =
      Number(raw?.vectorsPending ?? 0) + Number(raw?.tracksVectorsPending ?? 0);

    dom.healthVectors.textContent = `SQLite · ${docsReady}/${docsTotal} fichas · ${tracksReady}/${tracksTotal} pistas`;
    dom.healthModels.textContent = `${raw?.embeddingModel || "gemini-embedding-2"} · ${raw?.chatModel || "gemini-3.5-flash-lite"}`;

    if (raw?.ok === false) {
      dom.healthPill.setAttribute("data-state", "error");
    } else if (pending > 0) {
      dom.healthPill.setAttribute("data-state", "pending");
    } else {
      dom.healthPill.setAttribute("data-state", "ok");
    }

    dom.syncVectorsBtn.disabled = state.isSyncing;
    if (pending > 0) {
      dom.syncVectorsBtn.setAttribute("data-pending", "true");
      dom.syncVectorsBtn.textContent = `Sincronizar (${pending})`;
    } else {
      dom.syncVectorsBtn.removeAttribute("data-pending");
      dom.syncVectorsBtn.textContent = "Sincronizar";
    }
  } catch (error) {
    dom.healthPill.setAttribute("data-state", "error");
    dom.healthVectors.textContent = "SQLite · sin conexión";
    dom.healthModels.textContent = error.message;
    dom.syncVectorsBtn.disabled = true;
  }
}

async function handleSyncVectors() {
  if (state.isSyncing) return;
  state.isSyncing = true;
  dom.syncVectorsBtn.disabled = true;
  dom.syncVectorsBtn.textContent = "Sincronizando…";

  try {
    const result = await apiRequest("/api/sync-embeddings", {
      method: "POST",
      body: JSON.stringify({}),
    });
    state.clientCache.clear();
    dom.catalogStatus.textContent = `Sincronización completada (${result?.synced ?? 0} vectores).`;
    await Promise.all([loadHealth(), loadDocuments(), loadTracks()]);
  } catch (error) {
    dom.catalogStatus.textContent = `Error al sincronizar: ${error.message}`;
  } finally {
    state.isSyncing = false;
    await loadHealth();
  }
}

/* ---------------- Reproductor YouTube Integrado (Ambas Vistas) ---------------- */

function createPlayIconSvg() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M4 2.8v10.4L13 8 4 2.8Z");
  svg.appendChild(path);
  return svg;
}

function stopPlayerTargets(targets) {
  targets.forEach((t) => {
    t.iframe.src = "about:blank";
    t.wrap.hidden = true;
    t.now.hidden = true;
    t.stopBtn.hidden = true;
    t.empty.hidden = false;
  });
}

function stopAllPlayers() {
  state.activeTrackId = null;
  stopPlayerTargets([
    {
      iframe: dom.chatYtIframe,
      wrap: dom.chatYtFrameWrap,
      now: dom.chatYtNow,
      stopBtn: dom.chatYtStopBtn,
      empty: dom.chatYtEmpty,
    },
    {
      iframe: dom.studioYtIframe,
      wrap: dom.studioYtFrameWrap,
      now: dom.studioYtNow,
      stopBtn: dom.studioYtStopBtn,
      empty: dom.studioYtEmpty,
    },
  ]);
  renderIntegratedTrackLists();
}

function playTrackInActiveView(track) {
  if (!track || !YOUTUBE_ID_PATTERN.test(String(track.youtubeId || ""))) {
    return;
  }

  state.activeTrackId = track.id;
  const isStudio = state.activeView === "studio";
  const target = isStudio
    ? {
        iframe: dom.studioYtIframe,
        wrap: dom.studioYtFrameWrap,
        now: dom.studioYtNow,
        title: dom.studioYtTitle,
        meta: dom.studioYtMeta,
        link: dom.studioYtLink,
        stopBtn: dom.studioYtStopBtn,
        empty: dom.studioYtEmpty,
      }
    : {
        iframe: dom.chatYtIframe,
        wrap: dom.chatYtFrameWrap,
        now: dom.chatYtNow,
        title: dom.chatYtTitle,
        meta: dom.chatYtMeta,
        link: dom.chatYtLink,
        stopBtn: dom.chatYtStopBtn,
        empty: dom.chatYtEmpty,
      };

  const other = isStudio
    ? {
        iframe: dom.chatYtIframe,
        wrap: dom.chatYtFrameWrap,
        now: dom.chatYtNow,
        stopBtn: dom.chatYtStopBtn,
        empty: dom.chatYtEmpty,
      }
    : {
        iframe: dom.studioYtIframe,
        wrap: dom.studioYtFrameWrap,
        now: dom.studioYtNow,
        stopBtn: dom.studioYtStopBtn,
        empty: dom.studioYtEmpty,
      };

  stopPlayerTargets([other]);

  target.empty.hidden = true;
  target.wrap.hidden = false;
  target.now.hidden = false;
  target.stopBtn.hidden = false;

  target.iframe.src = `https://www.youtube.com/embed/${track.youtubeId}?autoplay=1&rel=0`;
  target.title.textContent = `${track.title} — ${track.artist}`;
  const langLabel = LANGUAGE_LABELS[track.language] || track.language;
  const yearLabel = track.releaseYear ? ` · ${track.releaseYear}` : "";
  target.meta.textContent = `${track.genre} · ${langLabel}${yearLabel}`;
  target.link.href = `https://www.youtube.com/watch?v=${track.youtubeId}`;

  renderIntegratedTrackLists();
  target.wrap.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "nearest",
  });
}

function buildRecommendedTrackStrip(tracks, container) {
  container.replaceChildren();
  tracks.forEach((track) => {
    const card = document.createElement("div");
    card.className = "inline-track-card";

    if (YOUTUBE_ID_PATTERN.test(String(track.youtubeId || ""))) {
      const img = document.createElement("img");
      img.className = "inline-track-thumb";
      img.src = `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg`;
      img.alt = `${track.title} — ${track.artist}`;
      img.loading = "lazy";
      card.appendChild(img);
    }

    const info = document.createElement("div");
    info.className = "inline-track-info";

    const title = document.createElement("p");
    title.className = "inline-track-title";
    title.textContent = track.title;

    const sub = document.createElement("p");
    sub.className = "inline-track-sub";
    const langLabel = LANGUAGE_LABELS[track.language] || track.language;
    sub.textContent = `${track.artist} · ${track.genre} · ${langLabel}`;

    info.append(title, sub);

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "play-mini-btn";
    playBtn.appendChild(createPlayIconSvg());
    const label = document.createElement("span");
    label.textContent = state.activeTrackId === track.id ? "Sonando" : "Play";
    playBtn.appendChild(label);
    playBtn.addEventListener("click", () => playTrackInActiveView(track));

    card.append(info, playBtn);
    container.appendChild(card);
  });
}

/* ---------------- Catálogo Musical Compartido (App Chat + Interfaz App) ---------------- */

function getFilteredTracks() {
  const needle = state.trackSearch.trim().toLowerCase();
  return state.tracks.filter((track) => {
    if (state.selectedGenre && track.genre !== state.selectedGenre) {
      return false;
    }
    if (state.selectedLanguage && track.language !== state.selectedLanguage) {
      return false;
    }
    if (needle) {
      const haystack = `${track.title} ${track.artist} ${track.genre} ${track.notes || ""}`.toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    return true;
  });
}

function renderGenrePillsFor(container) {
  if (!container) return;
  container.replaceChildren();

  const makePill = (label, value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-pill";
    if (state.selectedGenre === value) {
      btn.classList.add("is-active");
    }
    btn.textContent = label;
    btn.addEventListener("click", () => {
      state.selectedGenre = value;
      state.confirmDeleteTrackId = null;
      renderAllMusicFilters();
      renderIntegratedTrackLists();
    });
    return btn;
  };

  container.appendChild(makePill("Todos", ""));
  state.trackGenres.forEach((genre) => {
    container.appendChild(makePill(genre, genre));
  });
}

function renderAllMusicFilters() {
  renderGenrePillsFor(dom.chatGenrePills);
  renderGenrePillsFor(dom.studioGenrePills);

  [dom.chatLangFilter, dom.studioLangFilter].forEach((group) => {
    if (!group) return;
    group.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.classList.toggle("is-active", (btn.dataset.language || "") === state.selectedLanguage);
    });
  });

  if (dom.chatTrackSearch.value !== state.trackSearch) {
    dom.chatTrackSearch.value = state.trackSearch;
  }
  if (dom.studioTrackSearch.value !== state.trackSearch) {
    dom.studioTrackSearch.value = state.trackSearch;
  }

  dom.genreSuggestions.replaceChildren();
  state.trackGenres.forEach((genre) => {
    const opt = document.createElement("option");
    opt.value = genre;
    dom.genreSuggestions.appendChild(opt);
  });
}

function renderTrackListInto(container, tracks, allowDelete) {
  if (!container) return;
  container.replaceChildren();

  if (tracks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "Sin canciones que coincidan con el filtro.";
    container.appendChild(empty);
    return;
  }

  tracks.forEach((track) => {
    const li = document.createElement("li");
    li.className = "dock-track-row";
    li.setAttribute("data-playing", String(state.activeTrackId === track.id));

    const meta = document.createElement("div");
    meta.className = "dock-track-meta";

    const name = document.createElement("p");
    name.className = "dock-track-name";
    name.textContent = track.title;

    const sub = document.createElement("p");
    sub.className = "dock-track-sub";
    const langLabel = LANGUAGE_LABELS[track.language] || track.language;
    const yearText = track.releaseYear ? ` · ${track.releaseYear}` : "";
    sub.textContent = `${track.artist} · ${track.genre} · ${langLabel}${yearText}`;

    meta.append(name, sub);

    const actions = document.createElement("div");
    actions.className = "doc-actions";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "play-mini-btn";
    playBtn.appendChild(createPlayIconSvg());
    const playLabel = document.createElement("span");
    playLabel.textContent = state.activeTrackId === track.id ? "Sonando" : "Play";
    playBtn.appendChild(playLabel);
    playBtn.addEventListener("click", () => playTrackInActiveView(track));
    actions.appendChild(playBtn);

    if (allowDelete) {
      if (state.confirmDeleteTrackId === track.id) {
        const confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.className = "btn-ghost btn-danger-ghost";
        confirmBtn.textContent = "Confirmar";
        confirmBtn.addEventListener("click", () => deleteTrack(track.id));

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "btn-ghost";
        cancelBtn.textContent = "Cancelar";
        cancelBtn.addEventListener("click", () => {
          state.confirmDeleteTrackId = null;
          renderIntegratedTrackLists();
        });

        actions.append(confirmBtn, cancelBtn);
      } else {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn-ghost btn-danger-ghost";
        delBtn.textContent = "Eliminar";
        delBtn.setAttribute("aria-label", `Eliminar ${track.title}`);
        delBtn.addEventListener("click", () => {
          state.confirmDeleteTrackId = track.id;
          renderIntegratedTrackLists();
        });
        actions.appendChild(delBtn);
      }
    }

    li.append(meta, actions);
    container.appendChild(li);
  });
}

function renderIntegratedTrackLists() {
  const filtered = getFilteredTracks();
  renderTrackListInto(dom.chatTracksList, filtered, false);
  renderTrackListInto(dom.studioTracksList, filtered, true);
}

async function loadTracks() {
  try {
    const data = await apiRequest("/api/tracks");
    state.tracks = Array.isArray(data?.tracks) ? data.tracks : [];
    state.trackGenres = Array.isArray(data?.genres) ? data.genres : [];
    if (state.selectedGenre && !state.trackGenres.includes(state.selectedGenre)) {
      state.selectedGenre = "";
    }
    renderAllMusicFilters();
    renderIntegratedTrackLists();
  } catch (error) {
    dom.studioMusicStatus.textContent = `Error al cargar músicas: ${error.message}`;
  }
}

async function deleteTrack(id) {
  try {
    dom.studioMusicStatus.textContent = "Eliminando pista…";
    await apiRequest(`/api/tracks/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.clientCache.clear();
    if (state.activeTrackId === id) {
      stopAllPlayers();
    }
    state.confirmDeleteTrackId = null;
    dom.studioMusicStatus.textContent = "Pista eliminada de SQLite.";
    await Promise.all([loadTracks(), loadHealth()]);
  } catch (error) {
    dom.studioMusicStatus.textContent = `No se pudo eliminar: ${error.message}`;
  }
}

async function submitNewTrack(fields, feedbackEl, submitBtn, formEl) {
  const { title, artist, genre, language, youtubeUrl, releaseYear, notes } = fields;

  if (!title || !artist || !genre || !youtubeUrl) {
    feedbackEl.setAttribute("data-tone", "error");
    feedbackEl.textContent = "Completa título, artista, género y enlace o ID de YouTube.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Vectorizando…";
  feedbackEl.removeAttribute("data-tone");
  feedbackEl.textContent = "Guardando canción y calculando embedding en SQLite…";

  try {
    const payload = { title, artist, genre, language, youtubeUrl, notes };
    if (Number.isInteger(releaseYear)) {
      payload.releaseYear = releaseYear;
    }

    const res = await apiRequest("/api/tracks", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    state.clientCache.clear();
    formEl.reset();
    feedbackEl.setAttribute("data-tone", "ok");
    feedbackEl.textContent = "Música guardada y vectorizada.";
    await Promise.all([loadTracks(), loadHealth()]);
    if (res?.track) {
      playTrackInActiveView(res.track);
    }
  } catch (error) {
    feedbackEl.setAttribute("data-tone", "error");
    feedbackEl.textContent = `Error: ${error.message}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Guardar y vectorizar";
  }
}

/* ---------------- APP CHAT (#view-chat) ---------------- */

function renderInitialChatGreeting() {
  if (dom.chatMessages.children.length > 0) {
    return;
  }
  appendChatBubble({
    role: "assistant",
    text: "Hola, soy Ecosfera. Pregúntame sobre teoría musical, producción o pide canciones de las 27 pistas en SQLite (Electrónica, Reguetón, Rap Melódico, Emo Rap, Pop Alternativo o Indie Pop) para reproducirlas directo desde YouTube.",
    metaText: "Listo · RAG unificado",
    tracks: [],
    grounded: true,
  });
}

function appendInlineFormatted(parentEl, rawText) {
  const text = String(rawText || "");
  const lines = text.split("\n");

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      parentEl.appendChild(document.createElement("br"));
    }
    const parts = line.split(/(\*\*[^*\n]+?\*\*)/g);
    parts.forEach((part) => {
      if (!part) return;
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        const strong = document.createElement("strong");
        strong.textContent = part.slice(2, -2);
        parentEl.appendChild(strong);
      } else {
        parentEl.appendChild(document.createTextNode(part));
      }
    });
  });
}

function appendChatBubble({ role, text, metaText, tracks = [], grounded = false }) {
  const article = document.createElement("article");
  article.className = "chat-bubble";
  article.setAttribute("data-role", role);

  const meta = document.createElement("div");
  meta.className = "chat-bubble-meta";

  const who = document.createElement("span");
  who.className = "chat-bubble-role";
  who.textContent = role === "user" ? "Tú" : "Ecosfera";

  const rightMeta = document.createElement("span");
  rightMeta.className = "mono-stat";
  rightMeta.textContent = metaText || "";

  meta.append(who, rightMeta);

  const body = document.createElement("p");
  body.className = "chat-bubble-text";
  if (role === "assistant") {
    appendInlineFormatted(body, text);
  } else {
    body.textContent = text;
  }

  article.append(meta, body);

  if (role === "assistant" && grounded && Array.isArray(tracks) && tracks.length > 0) {
    const strip = document.createElement("div");
    strip.className = "chat-track-strip";
    buildRecommendedTrackStrip(tracks, strip);
    article.appendChild(strip);
  }

  dom.chatMessages.appendChild(article);
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

async function sendChatMessage(rawText) {
  const message = String(rawText || "").trim();
  if (!message || state.chatBusy) return;

  state.chatBusy = true;
  dom.chatSubmit.disabled = true;
  dom.chatSubmit.textContent = "Pensando…";

  appendChatBubble({
    role: "user",
    text: message,
    metaText: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }),
  });

  if (state.activeChatController) {
    state.activeChatController.abort();
  }
  state.activeChatController = new AbortController();

  try {
    const historyToSend = state.chatHistory.slice(-4);
    const response = await apiRequest("/api/chat", {
      method: "POST",
      signal: state.activeChatController.signal,
      body: JSON.stringify({
        message,
        history: historyToSend,
        topK: 3,
      }),
    });

    state.chatHistory.push({ role: "user", text: message });
    state.chatHistory.push({ role: "assistant", text: response.answer });
    if (state.chatHistory.length > 8) {
      state.chatHistory = state.chatHistory.slice(-8);
    }

    const opt = response?.optimization;
    const optLabel = opt?.cacheHit
      ? `0 tok (caché) · ${opt.latencyMs} ms`
      : `${opt?.estimatedInputTokens ?? 0} tok · ${response?.workflow?.latencyMs ?? 0} ms`;

    dom.chatOptBadge.textContent = optLabel;

    appendChatBubble({
      role: "assistant",
      text: response.answer,
      metaText: response.grounded ? `${response.model} · ${optLabel}` : `Fuera de catálogo · ${optLabel}`,
      tracks: response.grounded ? response.recommendedTracks || [] : [],
      grounded: Boolean(response.grounded),
    });

    await loadHistory();
  } catch (error) {
    if (error.name !== "AbortError") {
      appendChatBubble({
        role: "assistant",
        text: `No se pudo completar la consulta: ${error.message}`,
        metaText: "Error",
        tracks: [],
        grounded: false,
      });
    }
  } finally {
    state.chatBusy = false;
    dom.chatSubmit.disabled = false;
    dom.chatSubmit.textContent = "Enviar";
  }
}

/* ---------------- INTERFAZ APP (#view-studio) ---------------- */

function getStepElements() {
  const map = new Map();
  dom.pipelineSteps.querySelectorAll(".pipeline-step").forEach((item) => {
    map.set(item.dataset.step, item);
  });
  return map;
}

function updateStepNode(node, status, detail, durationText) {
  if (!node) return;
  const safeStatus = STATUS_LABELS[status] ? status : "idle";
  node.setAttribute("data-status", safeStatus);

  const badge = node.querySelector(".step-status-badge");
  const detailEl = node.querySelector(".step-detail");
  const durationEl = node.querySelector(".step-duration");

  if (badge) badge.textContent = STATUS_LABELS[safeStatus];
  if (detailEl && detail) detailEl.textContent = detail;
  if (durationEl && durationText !== undefined) {
    durationEl.textContent = durationText;
  }
}

function stopPipelineAnimation() {
  if (state.pipelineTimer) {
    clearInterval(state.pipelineTimer);
    state.pipelineTimer = null;
  }
}

function resetPipeline() {
  stopPipelineAnimation();
  const stepMap = getStepElements();
  PIPELINE_DEFAULTS.forEach((def) => {
    updateStepNode(stepMap.get(def.id), "idle", def.defaultDetail, "—");
  });
  dom.pipelineTotalLatency.textContent = "— ms";
}

function startPipelineAnimation() {
  stopPipelineAnimation();
  const stepMap = getStepElements();

  if (prefersReducedMotion()) {
    PIPELINE_DEFAULTS.forEach((def) => {
      updateStepNode(stepMap.get(def.id), "running", def.defaultDetail, "…");
    });
    dom.pipelineTotalLatency.textContent = "procesando";
    return;
  }

  let activeIndex = 0;
  const renderProgress = () => {
    PIPELINE_DEFAULTS.forEach((def, idx) => {
      const node = stepMap.get(def.id);
      if (idx < activeIndex) {
        updateStepNode(node, "done", def.defaultDetail, "ok");
      } else if (idx === activeIndex) {
        updateStepNode(node, "running", def.defaultDetail, "…");
      } else {
        updateStepNode(node, "idle", def.defaultDetail, "—");
      }
    });
  };

  dom.pipelineTotalLatency.textContent = "procesando";
  renderProgress();

  state.pipelineTimer = setInterval(() => {
    if (activeIndex < PIPELINE_DEFAULTS.length - 1) {
      activeIndex += 1;
      renderProgress();
    }
  }, 360);
}

function applyPipelineSteps(workflow) {
  stopPipelineAnimation();
  const stepMap = getStepElements();
  const serverSteps = Array.isArray(workflow?.steps) ? workflow.steps : [];

  PIPELINE_DEFAULTS.forEach((def, index) => {
    const matched =
      serverSteps.find((s) => s?.step === def.id || s?.id === def.id) ||
      serverSteps[index];
    const rawStatus = matched?.status || "done";
    const status = rawStatus === "ok" || rawStatus === "skipped" ? "done" : rawStatus;
    const detail = matched?.detail || def.defaultDetail;
    const duration =
      typeof matched?.durationMs === "number" ? `${Math.round(matched.durationMs)} ms` : "—";
    updateStepNode(stepMap.get(def.id), status, detail, duration);
  });

  dom.pipelineTotalLatency.textContent =
    typeof workflow?.latencyMs === "number" ? `${Math.round(workflow.latencyMs)} ms` : "listo";
}

function markPipelineError(message) {
  stopPipelineAnimation();
  const stepMap = getStepElements();
  let marked = false;
  PIPELINE_DEFAULTS.forEach((def) => {
    const node = stepMap.get(def.id);
    const cur = node?.getAttribute("data-status");
    if (!marked && (cur === "running" || cur === "idle")) {
      updateStepNode(node, "error", message, "error");
      marked = true;
    }
  });
  dom.pipelineTotalLatency.textContent = "error";
}

function renderAnswerText(container, answerText) {
  container.replaceChildren();
  const safeText = String(answerText || "Sin respuesta generada.");
  const paragraphs = safeText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  (paragraphs.length > 0 ? paragraphs : [safeText]).forEach((paragraph) => {
    const p = document.createElement("p");
    appendInlineFormatted(p, paragraph);
    container.appendChild(p);
  });
}

function renderVectorVisualizer(queryEmbedding) {
  dom.vectorVisualizer.replaceChildren();
  const dimensions = queryEmbedding?.dimensions;
  const norm = queryEmbedding?.norm;
  const preview = Array.isArray(queryEmbedding?.preview)
    ? queryEmbedding.preview.slice(0, 32)
    : [];

  dom.vectorDims.textContent = typeof dimensions === "number" ? `${dimensions} dim` : "— dim";
  dom.vectorNorm.textContent = typeof norm === "number" ? `norma ${norm.toFixed(4)}` : "norma —";

  if (preview.length === 0) return;

  const maxAbs = Math.max(...preview.map((v) => Math.abs(Number(v) || 0)), 0.0001);
  preview.forEach((rawValue, index) => {
    const value = Number(rawValue) || 0;
    const cell = document.createElement("div");
    cell.className = "vector-cell";
    cell.title = `dim ${index + 1}: ${value.toFixed(5)}`;

    const bar = document.createElement("span");
    bar.className = "vector-bar";
    bar.setAttribute("data-sign", value >= 0 ? "pos" : "neg");
    bar.style.height = `${Math.max(6, Math.round((Math.abs(value) / maxAbs) * 46))}%`;
    cell.appendChild(bar);
    dom.vectorVisualizer.appendChild(cell);
  });
}

function renderMatches(matches, grounded) {
  dom.matchesList.replaceChildren();
  const list = Array.isArray(matches) ? matches : [];

  if (!grounded || list.length === 0) {
    dom.matchesBlock.hidden = true;
    dom.matchesCount.textContent = "0 fichas";
    return;
  }

  dom.matchesBlock.hidden = false;
  dom.matchesCount.textContent = list.length === 1 ? "1 ficha" : `${list.length} fichas`;

  list.forEach((match, index) => {
    const li = document.createElement("li");
    li.className = "match-item";

    const top = document.createElement("div");
    top.className = "match-top";

    const heading = document.createElement("div");
    heading.className = "match-heading";

    const rank = document.createElement("span");
    rank.className = "match-rank";
    rank.textContent = `#${index + 1}`;

    const title = document.createElement("h4");
    title.className = "match-title";
    title.textContent = match?.title || "Ficha sin título";

    heading.append(rank, title);

    const badges = document.createElement("div");
    badges.className = "match-badges";
    if (match?.category) {
      const cat = document.createElement("span");
      cat.className = "category-tag";
      cat.textContent = match.category;
      badges.appendChild(cat);
    }

    top.append(heading, badges);

    const pct = Math.max(0, Math.min(100, Number(match?.similarity ?? 0) * 100));
    const simRow = document.createElement("div");
    simRow.className = "similarity-row";

    const track = document.createElement("div");
    track.className = "similarity-track";

    const fill = document.createElement("div");
    fill.className = "similarity-fill";
    fill.style.width = `${pct.toFixed(1)}%`;
    track.appendChild(fill);

    const simValue = document.createElement("span");
    simValue.className = "mono-stat";
    simValue.textContent = `${pct.toFixed(1)}%`;

    simRow.append(track, simValue);

    const excerpt = document.createElement("p");
    excerpt.className = "match-excerpt";
    excerpt.textContent = match?.content || "";

    li.append(top, simRow, excerpt);
    dom.matchesList.appendChild(li);
  });
}

function renderQueryResult(data) {
  dom.resultPlaceholder.hidden = true;
  dom.resultError.hidden = true;
  dom.resultContent.hidden = false;

  const grounded = Boolean(data?.grounded);
  dom.groundedBadge.setAttribute("data-tone", grounded ? "ok" : "warm");
  dom.groundedBadge.textContent = grounded ? "Fundamentada en SQLite" : "Fuera de catálogo";

  const opt = data?.optimization;
  dom.resultOptimization.textContent = opt?.cacheHit
    ? "0 tok (caché)"
    : `${opt?.estimatedInputTokens ?? 0} tok est.`;

  const latency = data?.workflow?.latencyMs;
  dom.resultLatency.textContent =
    typeof latency === "number" ? `${Math.round(latency)} ms` : "— ms";

  renderAnswerText(dom.answerBody, data?.answer);
  renderVectorVisualizer(data?.queryEmbedding);

  const recTracks = grounded && Array.isArray(data?.recommendedTracks) ? data.recommendedTracks : [];
  if (recTracks.length > 0) {
    dom.studioTracksMatchBlock.hidden = false;
    dom.studioTracksMatchCount.textContent =
      recTracks.length === 1 ? "1 pista" : `${recTracks.length} pistas`;
    buildRecommendedTrackStrip(recTracks, dom.studioTracksMatchList);
  } else {
    dom.studioTracksMatchList.replaceChildren();
    dom.studioTracksMatchBlock.hidden = true;
  }

  renderMatches(data?.matches, grounded);
}

async function runQuery(question, topK) {
  const trimmed = String(question || "").trim();
  if (!trimmed || state.isQuerying) return;

  const clientKey = `${Number(topK) || 3}::${trimmed.toLowerCase()}`;
  if (state.clientCache.has(clientKey)) {
    const cached = state.clientCache.get(clientKey);
    applyPipelineSteps(cached.workflow);
    renderQueryResult(cached);
    return;
  }

  state.isQuerying = true;
  dom.querySubmit.disabled = true;
  dom.querySubmit.textContent = "Consultando…";
  dom.resultError.hidden = true;

  if (state.activeQueryController) {
    state.activeQueryController.abort();
  }
  state.activeQueryController = new AbortController();

  startPipelineAnimation();

  try {
    const response = await apiRequest("/api/query", {
      method: "POST",
      signal: state.activeQueryController.signal,
      body: JSON.stringify({
        question: trimmed,
        topK: Number(topK) || 3,
      }),
    });

    state.clientCache.set(clientKey, response);
    applyPipelineSteps(response?.workflow);
    renderQueryResult(response);
    await loadHistory();
  } catch (error) {
    if (error.name !== "AbortError") {
      markPipelineError(error.message);
      dom.resultPlaceholder.hidden = true;
      dom.resultContent.hidden = true;
      dom.resultError.hidden = false;
      dom.resultError.textContent = `No se pudo completar la consulta: ${error.message}`;
    }
  } finally {
    state.isQuerying = false;
    dom.querySubmit.disabled = false;
    dom.querySubmit.textContent = "Consultar archivo";
  }
}

/* ---------------- Catálogo de Fichas RAG + Historial ---------------- */

function updateCategoryControls(categories) {
  const prevValue = state.selectedCategory;
  dom.categoryFilter.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "Todas las categorías";
  dom.categoryFilter.appendChild(allOption);

  categories.forEach((category) => {
    const opt = document.createElement("option");
    opt.value = category;
    opt.textContent = category;
    dom.categoryFilter.appendChild(opt);
  });

  state.selectedCategory = prevValue && categories.includes(prevValue) ? prevValue : "";
  dom.categoryFilter.value = state.selectedCategory;

  dom.categorySuggestions.replaceChildren();
  categories.forEach((category) => {
    const opt = document.createElement("option");
    opt.value = category;
    dom.categorySuggestions.appendChild(opt);
  });
}

function renderDocuments() {
  dom.documentsList.replaceChildren();
  const filtered = state.selectedCategory
    ? state.documents.filter((doc) => doc.category === state.selectedCategory)
    : state.documents;

  dom.catalogCount.textContent = filtered.length === 1 ? "1 ficha" : `${filtered.length} fichas`;

  if (filtered.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "Sin fichas registradas en esta categoría.";
    dom.documentsList.appendChild(empty);
    return;
  }

  filtered.forEach((doc) => {
    const li = document.createElement("li");
    li.className = "doc-item";

    const header = document.createElement("div");
    header.className = "doc-item-header";

    const title = document.createElement("h3");
    title.className = "doc-title";
    title.textContent = doc.title;

    const actions = document.createElement("div");
    actions.className = "doc-actions";

    if (state.confirmDeleteId === doc.id) {
      const confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "btn-ghost btn-danger-ghost";
      confirmBtn.textContent = "Confirmar";
      confirmBtn.addEventListener("click", () => deleteDocument(doc.id));

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn-ghost";
      cancelBtn.textContent = "Cancelar";
      cancelBtn.addEventListener("click", () => {
        state.confirmDeleteId = null;
        renderDocuments();
      });

      actions.append(confirmBtn, cancelBtn);
    } else {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn-ghost btn-danger-ghost";
      delBtn.textContent = "Eliminar";
      delBtn.addEventListener("click", () => {
        state.confirmDeleteId = doc.id;
        renderDocuments();
      });
      actions.appendChild(delBtn);
    }

    header.append(title, actions);

    const metaRow = document.createElement("div");
    metaRow.className = "doc-meta-row";

    const badges = document.createElement("div");
    badges.className = "doc-badges";

    if (doc.category) {
      const cat = document.createElement("span");
      cat.className = "category-tag";
      cat.textContent = doc.category;
      badges.appendChild(cat);
    }

    const vecState = document.createElement("span");
    vecState.className = "vector-state";
    vecState.setAttribute("data-ready", String(Boolean(doc.hasEmbedding)));

    const dot = document.createElement("span");
    dot.className = "vector-state-dot";
    dot.setAttribute("aria-hidden", "true");

    const vecLabel = document.createElement("span");
    vecLabel.textContent = doc.hasEmbedding ? "Vector listo" : "Pendiente";

    vecState.append(dot, vecLabel);
    badges.appendChild(vecState);
    metaRow.appendChild(badges);

    const details = document.createElement("details");
    details.className = "doc-details";
    const summary = document.createElement("summary");
    summary.textContent = "Ver contenido";
    const body = document.createElement("p");
    body.className = "doc-details-body";
    body.textContent = doc.content || "";
    details.append(summary, body);

    li.append(header, metaRow, details);
    dom.documentsList.appendChild(li);
  });
}

async function loadDocuments() {
  try {
    const data = await apiRequest("/api/documents");
    state.documents = Array.isArray(data?.documents) ? data.documents : [];
    state.categories = Array.isArray(data?.categories) ? data.categories : [];
    updateCategoryControls(state.categories);
    renderDocuments();
  } catch (error) {
    dom.catalogStatus.textContent = `Error al cargar fichas: ${error.message}`;
  }
}

async function deleteDocument(id) {
  try {
    dom.catalogStatus.textContent = "Eliminando ficha…";
    await apiRequest(`/api/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
    state.clientCache.clear();
    state.confirmDeleteId = null;
    dom.catalogStatus.textContent = "Ficha eliminada.";
    await Promise.all([loadDocuments(), loadHealth()]);
  } catch (error) {
    dom.catalogStatus.textContent = `Error al eliminar: ${error.message}`;
  }
}

async function handleAddDocument(event) {
  event.preventDefault();

  const title = dom.docTitle.value.trim();
  const category = dom.docCategory.value.trim();
  const tags = dom.docTags.value.trim();
  const content = dom.docContent.value.trim();

  if (!title || !category || !content) {
    dom.addDocFeedback.setAttribute("data-tone", "error");
    dom.addDocFeedback.textContent = "Completa título, categoría y contenido.";
    return;
  }

  dom.addDocSubmit.disabled = true;
  dom.addDocSubmit.textContent = "Vectorizando…";
  dom.addDocFeedback.removeAttribute("data-tone");
  dom.addDocFeedback.textContent = "Calculando embedding y guardando en SQLite…";

  try {
    await apiRequest("/api/documents", {
      method: "POST",
      body: JSON.stringify({ title, category, tags, content }),
    });
    state.clientCache.clear();
    dom.addDocForm.reset();
    dom.addDocFeedback.setAttribute("data-tone", "ok");
    dom.addDocFeedback.textContent = "Ficha guardada y vectorizada.";
    await Promise.all([loadDocuments(), loadHealth()]);
  } catch (error) {
    dom.addDocFeedback.setAttribute("data-tone", "error");
    dom.addDocFeedback.textContent = `Error: ${error.message}`;
  } finally {
    dom.addDocSubmit.disabled = false;
    dom.addDocSubmit.textContent = "Guardar y vectorizar";
  }
}

function renderHistory(items) {
  dom.historyList.replaceChildren();
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "Aún no hay consultas registradas.";
    dom.historyList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-item-btn";

    const questionEl = document.createElement("span");
    questionEl.className = "history-question";
    questionEl.textContent = item.question || "";

    const meta = document.createElement("span");
    meta.className = "history-meta";

    const docLabel = document.createElement("span");
    docLabel.textContent = item.topDocumentTitle ? `Top: ${item.topDocumentTitle}` : "Consulta musical";

    const metrics = document.createElement("span");
    metrics.className = "mono-stat";
    const simRaw = Number(item.topSimilarity);
    const simPct = Number.isFinite(simRaw) && simRaw > 0 ? `${(simRaw * 100).toFixed(1)}%` : "—";
    const lat = typeof item.latencyMs === "number" ? `${Math.round(item.latencyMs)} ms` : "— ms";
    metrics.textContent = `${simPct} · ${lat}`;

    meta.append(docLabel, metrics);
    btn.append(questionEl, meta);

    btn.addEventListener("click", () => {
      if (!item.question) return;
      dom.queryInput.value = item.question;
      dom.queryCharCount.textContent = `${item.question.length}/400`;
      runQuery(item.question, dom.topKSelect.value);
    });

    li.appendChild(btn);
    dom.historyList.appendChild(li);
  });
}

async function loadHistory() {
  try {
    const data = await apiRequest("/api/history");
    renderHistory(Array.isArray(data?.history) ? data.history : []);
  } catch (error) {
    dom.historyList.replaceChildren();
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = `No se pudo cargar el historial: ${error.message}`;
    dom.historyList.appendChild(empty);
  }
}

/* ---------------- Eventos e Inicialización ---------------- */

function bindEvents() {
  dom.navChatBtn.addEventListener("click", () => switchView("chat"));
  dom.navStudioBtn.addEventListener("click", () => switchView("studio"));
  dom.syncVectorsBtn.addEventListener("click", handleSyncVectors);

  dom.chatYtStopBtn.addEventListener("click", stopAllPlayers);
  dom.studioYtStopBtn.addEventListener("click", stopAllPlayers);

  // App Chat events
  dom.chatInput.addEventListener("input", () => {
    dom.chatCharCount.textContent = `${dom.chatInput.value.length}/400`;
  });

  dom.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      dom.chatForm.requestSubmit();
    }
  });

  dom.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = dom.chatInput.value.trim();
    if (!text) return;
    dom.chatInput.value = "";
    dom.chatCharCount.textContent = "0/400";
    sendChatMessage(text);
  });

  dom.chatClearBtn.addEventListener("click", () => {
    state.chatHistory = [];
    dom.chatMessages.replaceChildren();
    renderInitialChatGreeting();
  });

  dom.chatChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const msg = chip.dataset.message || chip.textContent.trim();
      sendChatMessage(msg);
    });
  });

  // Filtros musicales compartidos en ambas vistas
  [dom.chatLangFilter, dom.studioLangFilter].forEach((group) => {
    group.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedLanguage = btn.dataset.language || "";
        state.confirmDeleteTrackId = null;
        renderAllMusicFilters();
        renderIntegratedTrackLists();
      });
    });
  });

  const handleTrackSearch = debounce((value) => {
    state.trackSearch = value;
    renderAllMusicFilters();
    renderIntegratedTrackLists();
  }, 200);

  dom.chatTrackSearch.addEventListener("input", () =>
    handleTrackSearch(dom.chatTrackSearch.value)
  );
  dom.studioTrackSearch.addEventListener("input", () =>
    handleTrackSearch(dom.studioTrackSearch.value)
  );

  dom.chatAddTrackForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const rawYear = dom.chatTrackYear.value.trim();
    submitNewTrack(
      {
        title: dom.chatTrackTitle.value.trim(),
        artist: dom.chatTrackArtist.value.trim(),
        genre: dom.chatTrackGenre.value.trim(),
        language: dom.chatTrackLang.value,
        youtubeUrl: dom.chatTrackYt.value.trim(),
        releaseYear: rawYear ? Number(rawYear) : undefined,
        notes: dom.chatTrackNotes.value.trim(),
      },
      dom.chatAddTrackFeedback,
      dom.chatAddTrackSubmit,
      dom.chatAddTrackForm
    );
  });

  dom.addTrackForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const rawYear = dom.trackYear.value.trim();
    submitNewTrack(
      {
        title: dom.trackTitle.value.trim(),
        artist: dom.trackArtist.value.trim(),
        genre: dom.trackGenre.value.trim(),
        language: dom.trackLanguage.value,
        youtubeUrl: dom.trackYoutube.value.trim(),
        releaseYear: rawYear ? Number(rawYear) : undefined,
        notes: dom.trackNotes.value.trim(),
      },
      dom.addTrackFeedback,
      dom.addTrackSubmit,
      dom.addTrackForm
    );
  });

  // Interfaz App events
  dom.queryInput.addEventListener("input", () => {
    dom.queryCharCount.textContent = `${dom.queryInput.value.length}/400`;
  });

  dom.queryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = dom.queryInput.value.trim();
    if (!question) {
      dom.queryInput.focus();
      return;
    }
    runQuery(question, dom.topKSelect.value);
  });

  dom.studioChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const question = chip.dataset.question || chip.textContent.trim();
      dom.queryInput.value = question;
      dom.queryCharCount.textContent = `${question.length}/400`;
      runQuery(question, dom.topKSelect.value);
    });
  });

  dom.categoryFilter.addEventListener("change", () => {
    state.selectedCategory = dom.categoryFilter.value;
    state.confirmDeleteId = null;
    renderDocuments();
  });

  dom.addDocForm.addEventListener("submit", handleAddDocument);
}

async function init() {
  initTheme();
  resetPipeline();
  renderInitialChatGreeting();
  bindEvents();

  if (window.location.hash === "#interfaz") {
    switchView("studio", false);
  } else {
    switchView("chat", false);
  }

  await Promise.all([loadHealth(), loadDocuments(), loadHistory(), loadTracks()]);
}

init();
