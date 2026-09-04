(function () {
  var STORAGE_BASE = "requeue.dashboard.baseUrl";
  var STORAGE_KEY = "requeue.dashboard.apiKey";
  var DEMO_KEY = "rq_demo_local_dev_only_do_not_use_in_prod";
  var DEFAULT_BASE = "http://127.0.0.1:8787";
  var INBOX_STATUSES = { failed: true, pending_replay: true };

  var form = document.getElementById("connect-form");
  var baseInput = document.getElementById("base-url");
  var keyInput = document.getElementById("api-key");
  var connectBtn = document.getElementById("connect-btn");
  var refreshBtn = document.getElementById("refresh-btn");
  var clearBtn = document.getElementById("clear-btn");
  var connectStatus = document.getElementById("connect-status");
  var eventList = document.getElementById("event-list");
  var eventCount = document.getElementById("event-count");
  var detailEmpty = document.getElementById("detail-empty");
  var detailBody = document.getElementById("detail-body");
  var yearEl = document.getElementById("year");
  var navToggle = document.getElementById("nav-toggle");
  var navLinks = document.getElementById("nav-links");

  var state = {
    events: [],
    selectedId: null,
    detail: null,
    filter: "inbox",
    connected: false,
    replayBusy: false,
    replayNote: "",
    replayNoteState: "",
  };

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var open = navLinks.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  baseInput.value = readStore(STORAGE_BASE) || DEFAULT_BASE;
  keyInput.value = readStore(STORAGE_KEY) || DEMO_KEY;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    connect(true);
  });

  refreshBtn.addEventListener("click", function () {
    if (!state.connected) {
      connect(true);
      return;
    }
    refresh();
  });

  clearBtn.addEventListener("click", function () {
    localStorage.removeItem(STORAGE_BASE);
    localStorage.removeItem(STORAGE_KEY);
    state.events = [];
    state.selectedId = null;
    state.detail = null;
    state.replayNote = "";
    state.replayNoteState = "";
    state.connected = false;
    baseInput.value = DEFAULT_BASE;
    keyInput.value = DEMO_KEY;
    setStatus("Cleared localStorage credentials.", "warn");
    eventCount.textContent = "Not connected";
    renderList();
    renderDetail();
  });

  document.querySelectorAll(".filter").forEach(function (button) {
    button.addEventListener("click", function () {
      state.filter = button.getAttribute("data-filter") || "inbox";
      document.querySelectorAll(".filter").forEach(function (item) {
        var active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderList();
    });
  });

  eventList.addEventListener("click", function (event) {
    var replayBtn = event.target.closest("[data-replay-id]");
    if (replayBtn) {
      var replayId = replayBtn.getAttribute("data-replay-id");
      selectEvent(replayId).then(function () {
        replayEvent(replayId);
      });
      return;
    }
    var row = event.target.closest("[data-event-id]");
    if (!row) return;
    selectEvent(row.getAttribute("data-event-id"));
  });

  eventList.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("[data-replay-id]")) return;
    var row = event.target.closest("[data-event-id]");
    if (!row) return;
    event.preventDefault();
    selectEvent(row.getAttribute("data-event-id"));
  });

  if (readStore(STORAGE_BASE) && readStore(STORAGE_KEY)) {
    connect(false);
  }

  function credentials() {
    return {
      baseUrl: normalizeBase(baseInput.value),
      apiKey: keyInput.value.trim(),
    };
  }

  async function connect(save) {
    var creds = credentials();
    if (!creds.baseUrl || !creds.apiKey) {
      setStatus("Paste an API base URL and API key.", "error");
      return;
    }

    if (save) {
      localStorage.setItem(STORAGE_BASE, creds.baseUrl);
      localStorage.setItem(STORAGE_KEY, creds.apiKey);
    }

    connectBtn.disabled = true;
    setStatus("Checking " + creds.baseUrl + " …", "");

    try {
      warnMixedContent(creds.baseUrl);
      var health = await request(creds, "/health", { auth: false });
      if (!health || health.ok !== true) {
        throw apiError("health_failed", "GET /health did not return ok.");
      }
      await loadEvents(creds);
      state.connected = true;
      setStatus(
        "Connected to " +
          creds.baseUrl +
          " · " +
          (health.service || "requeue") +
          " " +
          (health.version || "") +
          ". Key stays in localStorage only.",
        "ok"
      );
    } catch (error) {
      state.connected = false;
      setStatus(explainError(error, creds.baseUrl), "error");
    } finally {
      connectBtn.disabled = false;
    }
  }

  async function refresh() {
    var creds = credentials();
    setStatus("Refreshing events…", "");
    try {
      await loadEvents(creds);
      if (state.selectedId) {
        await loadDetail(creds, state.selectedId);
      }
      setStatus("Inbox refreshed from " + creds.baseUrl + ".", "ok");
    } catch (error) {
      setStatus(explainError(error, creds.baseUrl), "error");
    }
  }

  async function loadEvents(creds) {
    var data = await request(creds, "/v1/events?limit=100", { auth: true });
    state.events = Array.isArray(data.events) ? data.events : [];
    renderList();
    if (state.selectedId && !state.events.some(function (item) { return item.id === state.selectedId; })) {
      state.selectedId = null;
      state.detail = null;
      renderDetail();
    }
  }

  async function selectEvent(id) {
    state.selectedId = id;
    state.replayNote = "";
    state.replayNoteState = "";
    renderList();
    detailBody.hidden = false;
    detailEmpty.hidden = true;
    detailBody.innerHTML = "<p class=\"empty\">Loading " + escapeHtml(id) + "…</p>";
    try {
      await loadDetail(credentials(), id);
    } catch (error) {
      detailBody.innerHTML =
        "<p class=\"detail-note\" data-state=\"error\">" +
        escapeHtml(explainError(error, credentials().baseUrl)) +
        "</p>";
    }
  }

  async function loadDetail(creds, id) {
    var data = await request(creds, "/v1/events/" + encodeURIComponent(id), { auth: true });
    state.detail = data;
    renderDetail();
  }

  async function replayEvent(id) {
    if (state.replayBusy) return;
    state.replayBusy = true;
    renderDetail();
    try {
      var result = await request(credentials(), "/v1/events/" + encodeURIComponent(id) + "/replay", {
        auth: true,
        method: "POST",
      });
      state.replayNote = result.queued
        ? "Queued for the outbox cron (pending_replay)."
        : replaySummary(result);
      state.replayNoteState = result.attempt && result.attempt.success === false ? "error" : "ok";
      await loadEvents(credentials());
      await loadDetail(credentials(), id);
    } catch (error) {
      state.replayNote = explainError(error, credentials().baseUrl);
      state.replayNoteState = "error";
    } finally {
      state.replayBusy = false;
      renderDetail();
    }
  }

  function renderList() {
    var visible = visibleEvents();
    var failed = state.events.filter(function (item) {
      return item.status === "failed" || item.status === "pending_replay";
    }).length;

    if (!state.connected && !state.events.length) {
      eventCount.textContent = "Not connected";
      eventList.innerHTML =
        "<p class=\"empty\">Connect to a running Requeue core API to list failed and pending events.</p>";
      return;
    }

    eventCount.textContent =
      failed === 1 ? "1 failed/pending" : failed + " failed/pending";

    if (!visible.length) {
      eventList.innerHTML =
        "<p class=\"empty\">No events in this view. Ingest a failure against the core API, then refresh.</p>";
      return;
    }

    eventList.innerHTML = visible
      .map(function (item) {
        var selected = item.id === state.selectedId ? " is-selected" : "";
        return (
          "<div class=\"dash-event" +
          selected +
          "\" role=\"button\" tabindex=\"0\" data-event-id=\"" +
          escapeAttr(item.id) +
          "\">" +
          "<span class=\"dot\" aria-hidden=\"true\"></span>" +
          "<div>" +
          "<div class=\"event-name\">" +
          escapeHtml(eventTitle(item)) +
          "</div>" +
          "<div class=\"event-meta\">" +
          escapeHtml(eventSubtitle(item)) +
          "</div>" +
          "</div>" +
          statusBadge(item.status) +
          "<button class=\"replay\" type=\"button\" data-replay-id=\"" +
          escapeAttr(item.id) +
          "\">Replay</button>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderDetail() {
    if (!state.detail || !state.detail.event) {
      detailEmpty.hidden = false;
      detailBody.hidden = true;
      detailBody.innerHTML = "";
      return;
    }

    var event = state.detail.event;
    var attempts = state.detail.replay_attempts || [];
    var canReplay = event.status !== "pending_replay";
    var replayLabel = state.replayBusy ? "Replaying…" : "Replay";

    detailEmpty.hidden = true;
    detailBody.hidden = false;
    detailBody.innerHTML =
      "<div class=\"detail-head\">" +
      "<div>" +
      "<p class=\"section-kicker\">Event</p>" +
      "<div class=\"detail-id\">" +
      escapeHtml(event.id) +
      "</div>" +
      "</div>" +
      "<div class=\"detail-actions\">" +
      statusBadge(event.status) +
      "<button class=\"replay\" type=\"button\" id=\"replay-btn\"" +
      (canReplay && !state.replayBusy ? "" : " disabled") +
      ">" +
      replayLabel +
      "</button>" +
      "</div>" +
      "</div>" +
      "<dl class=\"detail-meta\">" +
      meta("Source", event.source || "—") +
      meta("Reason", event.reason || "—") +
      meta("Endpoint", event.endpoint_id || "—") +
      meta("Created", formatTime(event.created_at)) +
      meta("Updated", formatTime(event.updated_at)) +
      meta("Content type", event.content_type || "—") +
      "</dl>" +
      "<p class=\"detail-note\" id=\"replay-note\"" +
      (state.replayNoteState ? " data-state=\"" + escapeAttr(state.replayNoteState) + "\"" : "") +
      ">" +
      escapeHtml(state.replayNote) +
      "</p>" +
      "<section class=\"payload\"><h3>Payload</h3><pre>" +
      escapeHtml(pretty(event.payload)) +
      "</pre></section>" +
      "<section class=\"payload\"><h3>Headers</h3><pre>" +
      escapeHtml(pretty(event.headers)) +
      "</pre></section>" +
      "<section class=\"attempts\"><h3>Replay attempts</h3>" +
      (attempts.length
        ? attempts
            .map(function (attempt) {
              return (
                "<div class=\"attempt\">" +
                "<div>" +
                (attempt.success ? "Delivered" : "Failed") +
                (attempt.status_code != null ? " · " + attempt.status_code : "") +
                " · " +
                escapeHtml(formatTime(attempt.attempted_at)) +
                "</div>" +
                (attempt.error
                  ? "<div>" + escapeHtml(attempt.error) + "</div>"
                  : "") +
                (attempt.response_body
                  ? "<pre>" + escapeHtml(clip(attempt.response_body, 2000)) + "</pre>"
                  : "") +
                "</div>"
              );
            })
            .join("")
        : "<p class=\"empty\">No replay attempts yet.</p>") +
      "</section>";

    var replayBtn = document.getElementById("replay-btn");
    if (replayBtn) {
      replayBtn.addEventListener("click", function () {
        replayEvent(event.id);
      });
    }
  }

  function visibleEvents() {
    if (state.filter === "all") return state.events;
    return state.events.filter(function (item) {
      return INBOX_STATUSES[item.status];
    });
  }

  async function request(creds, path, options) {
    var url = creds.baseUrl + path;
    var headers = { Accept: "application/json" };
    if (options.auth) {
      headers.Authorization = "Bearer " + creds.apiKey;
    }
    if (options.method === "POST") {
      headers["Content-Type"] = "application/json";
    }

    var response;
    try {
      response = await fetch(url, {
        method: options.method || "GET",
        headers: headers,
        body: options.method === "POST" ? "{}" : undefined,
      });
    } catch (error) {
      throw apiError(
        "network_error",
        error instanceof Error ? error.message : "Network error"
      );
    }

    var body = await readBody(response);
    if (!response.ok) {
      var envelope = body && body.error ? body.error : {};
      throw apiError(
        envelope.code || "http_error",
        envelope.message || "Request failed with status " + response.status,
        response.status
      );
    }
    return body;
  }

  async function readBody(response) {
    var text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      return { raw: text };
    }
  }

  function eventTitle(item) {
    return item.source || item.reason || item.id;
  }

  function eventSubtitle(item) {
    var bits = [item.id];
    if (item.reason && item.source) bits.push(item.reason);
    bits.push(relativeTime(item.created_at));
    return bits.join(" · ");
  }

  function statusBadge(status) {
    var kind = "status-fail";
    if (status === "pending_replay") kind = "status-pending";
    if (status === "replayed") kind = "status-ok";
    return (
      "<span class=\"status " +
      kind +
      "\">" +
      escapeHtml(status || "unknown") +
      "</span>"
    );
  }

  function meta(label, value) {
    return (
      "<div class=\"meta-item\"><dt>" +
      escapeHtml(label) +
      "</dt><dd>" +
      escapeHtml(value) +
      "</dd></div>"
    );
  }

  function pretty(value) {
    if (value == null || value === "") return "—";
    if (typeof value === "string") {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch (error) {
        return value;
      }
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  }

  function replaySummary(result) {
    var attempt = result.attempt;
    if (!attempt) return "Replay finished.";
    if (attempt.success) {
      return "Replayed · HTTP " + (attempt.status_code == null ? "ok" : attempt.status_code);
    }
    return (
      "Replay failed" +
      (attempt.status_code != null ? " · HTTP " + attempt.status_code : "") +
      (attempt.error ? " · " + attempt.error : "")
    );
  }

  function warnMixedContent(baseUrl) {
    if (window.location.protocol === "https:" && /^http:\/\//i.test(baseUrl)) {
      setStatus(
        "This page is HTTPS. Browsers block HTTP APIs (including local Wrangler). Serve the dashboard over HTTP locally, or use a hosted HTTPS worker URL.",
        "warn"
      );
    }
  }

  function explainError(error, baseUrl) {
    var message = error && error.message ? error.message : "Request failed";
    var code = error && error.code;
    if (code === "network_error" || /failed to fetch|networkerror|load failed/i.test(message)) {
      return (
        "Could not reach " +
        baseUrl +
        ". Confirm the core API is running, CORS is enabled, and you are not mixing HTTPS Pages with HTTP localhost. " +
        message
      );
    }
    if (error && error.status === 401) {
      return "Unauthorized — check the API key. " + message;
    }
    return message;
  }

  function apiError(code, message, status) {
    var error = new Error(message);
    error.code = code;
    error.status = status || 0;
    return error;
  }

  function normalizeBase(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function setStatus(message, stateName) {
    connectStatus.textContent = message;
    if (stateName) {
      connectStatus.dataset.state = stateName;
    } else {
      delete connectStatus.dataset.state;
    }
  }

  function readStore(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function formatTime(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function relativeTime(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    var delta = Date.now() - date.getTime();
    var minutes = Math.round(delta / 60000);
    if (Math.abs(minutes) < 1) return "just now";
    if (Math.abs(minutes) < 60) return minutes + "m ago";
    var hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return hours + "h ago";
    return Math.round(hours / 24) + "d ago";
  }

  function clip(value, max) {
    var text = String(value);
    return text.length > max ? text.slice(0, max) + "…" : text;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
