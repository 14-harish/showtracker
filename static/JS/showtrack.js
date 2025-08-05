// === CONFIG ===
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";
const DEBUG_MODE = true;

let currentUser = null;
let currentMedia = null;
let currentMediaToAdd = null;

// === INIT ===
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkLoggedInStatus();
});

function logDebug(message, data) {
  if (DEBUG_MODE) {
    console.log(`[DEBUG] ${message}`, data || "");
  }
}

// === EVENT LISTENERS ===
function setupEventListeners() {
  document.getElementById("login-tab").onclick = () => switchAuthTab("login");
  document.getElementById("register-tab").onclick = () => switchAuthTab("register");
  document.getElementById("login-btn").onclick = handleLogin;
  document.getElementById("register-btn").onclick = handleRegister;
  document.getElementById("logout-btn").onclick = handleLogout;

  document.querySelectorAll(".nav-item").forEach(item => {
    if (item.id !== "logout-btn") {
      item.onclick = () => navigateTo(item.dataset.section);
    }
  });

  document.getElementById("search-btn").onclick = handleSearch;
  document.getElementById("search-input").addEventListener("keypress", e => {
    if (e.key === "Enter") handleSearch();
  });

  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.onclick = () => {
      const parent = btn.closest(".filter-tabs");
      parent.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const sectionId = btn.closest("section").id;
      if (sectionId === "tv-shows-section") loadTVShows(btn.dataset.filter);
      else if (sectionId === "movies-section") loadMovies(btn.dataset.filter);
    };
  });

  document.querySelectorAll(".close-modal").forEach(btn => btn.onclick = closeAllModals);
  document.getElementById("cancel-media-btn").onclick = closeAllModals;
  document.getElementById("save-media-btn").onclick = saveMediaDetails;
  document.getElementById("remove-media-btn").onclick = removeMedia;
  document.getElementById("modal-status").onchange = handleStatusChange;
  document.getElementById("movie-progress").oninput = updateProgressPercentage;
  document.getElementById("confirm-image-btn").onclick = confirmImage;

  window.onclick = e => {
    if (e.target.classList.contains("modal")) closeAllModals();
  };

  document.querySelectorAll(".stat-card").forEach(card => {
    card.onclick = () => navigateTo(card.dataset.section);
  });
}

// === AUTH ===
function switchAuthTab(tab) {
  document.getElementById("login-tab").classList.toggle("active", tab === "login");
  document.getElementById("register-tab").classList.toggle("active", tab === "register");
  document.getElementById("login-form").style.display = tab === "login" ? "block" : "none";
  document.getElementById("register-form").style.display = tab === "register" ? "block" : "none";
}

async function handleRegister() {
  const username = document.getElementById("register-username").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value.trim();

  if (!username || !email || !password) {
    showNotification("Fill all registration fields", "error");
    return;
  }

  try {
    const res = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotification("Registration successful! Please log in.", "success");
      switchAuthTab("login");
    } else {
      showNotification(data.error || "Registration failed", "error");
    }
  } catch {
    showNotification("Network error during registration", "error");
  }
}

async function handleLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!username || !password) {
    showNotification("Enter username and password", "error");
    return;
  }

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      currentUser = data.user;
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      showDashboard();
      await loadDashboardData();
      showNotification("Login successful!", "success");
    } else {
      showNotification(data.error || "Login failed", "error");
    }
  } catch {
    showNotification("Network error during login", "error");
  }
}

function handleLogout() {
  localStorage.removeItem("currentUser");
  currentUser = null;
  document.getElementById("auth-container").style.display = "flex";
  document.getElementById("dashboard-container").style.display = "none";
  showNotification("Logged out successfully", "success");
  ["login-username", "login-password", "register-username", "register-email", "register-password"].forEach(id => {
    document.getElementById(id).value = "";
  });
}

async function checkLoggedInStatus() {
  const stored = localStorage.getItem("currentUser");
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      showDashboard();
      await loadDashboardData();
    } catch {
      localStorage.removeItem("currentUser");
    }
  }
}

function showDashboard() {
  document.getElementById("auth-container").style.display = "none";
  document.getElementById("dashboard-container").style.display = "flex";
  navigateTo("dashboard");
}

// === NAVIGATION ===
function navigateTo(section) {
  document.querySelectorAll(".nav-item").forEach(item =>
    item.classList.toggle("active", item.dataset.section === section)
  );
  document.querySelectorAll(".content-section").forEach(sec => sec.style.display = "none");

  const selected = document.getElementById(`${section}-section`);
  if (selected) selected.style.display = "block";

  switch (section) {
    case "dashboard": loadDashboardData(); break;
    case "tv-shows": loadTVShows(getActiveFilter("tv-shows-section")); break;
    case "movies": loadMovies(getActiveFilter("movies-section")); break;
    case "continue-watching": loadContinueWatching(); break;
  }
}

function getActiveFilter(sectionId) {
  return document.querySelector(`#${sectionId} .filter-btn.active`)?.dataset.filter || "watching";
}

// === DASHBOARD ===
async function loadDashboardData() {
  if (!currentUser) return;
  document.getElementById("user-display-name").textContent = currentUser.username;
  try {
    const res = await fetch(`/media/${currentUser.username}`);
    const data = await res.json();
    if (res.ok) {
      const tvShows = data.media.filter(m => m.type === "tv");
      const movies = data.media.filter(m => m.type === "movie");
      const continueWatching = data.media.filter(m =>
        m.status === "watching" || (m.type === "movie" && m.progress > 0 && m.progress < 100)
      );
      document.getElementById("tv-show-count").textContent = tvShows.length;
      document.getElementById("movie-count").textContent = movies.length;
      document.getElementById("continue-count").textContent = continueWatching.length;
      await loadRecentActivity();
    } else {
      showNotification(data.error || "Failed to load media", "error");
    }
  } catch {
    showNotification("Network error loading dashboard", "error");
  }
}

async function loadRecentActivity() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/activities/${currentUser.username}?limit=5`);
    const data = await res.json();
    const container = document.getElementById("activity-list");
    container.innerHTML = "";
    if (res.ok && data.activities.length > 0) {
      data.activities.forEach(act => {
        const div = document.createElement("div");
        div.className = "activity-item";
        let iconClass = "fas fa-clock";
        if (act.action === "add") iconClass = act.media_type === "tv" ? "fas fa-tv" : "fas fa-film";
        else if (act.action === "update") iconClass = "fas fa-edit";
        else if (act.action === "remove") iconClass = "fas fa-trash";
        const date = new Date(act.timestamp).toLocaleString();
        div.innerHTML = `<i class="${iconClass}"></i><div><div>${act.message}</div><small>${date}</small></div>`;
        container.appendChild(div);
      });
    } else {
      container.textContent = "No recent activity";
    }
  } catch {
    showNotification("Network error loading activities", "error");
  }
}

// === MEDIA LOADERS ===
async function loadTVShows(status = "watching") {
  if (!currentUser) return;
  try {
    const res = await fetch(`/media/${currentUser.username}`);
    const data = await res.json();
    if (res.ok) {
      renderMediaGrid(data.media.filter(m => m.type === "tv" && m.status === status), "tv-shows-grid");
    } else {
      showNotification(data.error || "Failed to load TV shows", "error");
    }
  } catch {
    showNotification("Network error loading TV shows", "error");
  }
}

async function loadMovies(status = "to-watch") {
  if (!currentUser) return;
  try {
    const res = await fetch(`/media/${currentUser.username}`);
    const data = await res.json();
    if (res.ok) {
      renderMediaGrid(data.media.filter(m => m.type === "movie" && m.status === status), "movies-grid");
    } else {
      showNotification(data.error || "Failed to load movies", "error");
    }
  } catch {
    showNotification("Network error loading movies", "error");
  }
}

async function loadContinueWatching() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/media/${currentUser.username}`);
    const data = await res.json();
    if (res.ok) {
      renderMediaGrid(data.media.filter(m =>
        m.status === "watching" || (m.type === "movie" && m.progress > 0 && m.progress < 100)
      ), "continue-watching-grid");
    } else {
      showNotification(data.error || "Failed to load continue watching", "error");
    }
  } catch {
    showNotification("Network error loading continue watching", "error");
  }
}

function renderMediaGrid(items, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (items.length === 0) {
    container.innerHTML = `<div class="empty-message">No items found.</div>`;
    return;
  }
  items.forEach(item => container.appendChild(createMediaCard(item)));
}

function createMediaCard(media) {
  const card = document.createElement("div");
  card.className = "media-card";
  card.dataset.id = media.id;

  let progressHtml = "";
  if (media.type === "tv" && media.status === "watching") {
    const total = media.total_episodes || 0;
    const watched = media.watched_episodes || 0;
    const percent = total ? Math.round((watched / total) * 100) : 0;
    progressHtml = `
      <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
      <div class="episode-count">${watched} / ${total || "?"}</div>
      <div>Season ${media.season || "-"}, Ep ${media.episode || "-"}</div>
    `;
  } else if (media.type === "movie" && media.status === "watching") {
    const percent = media.progress || 0;
    progressHtml = `
      <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>
      <div class="progress-percentage">${percent}%</div>
    `;
  }

  card.innerHTML = `
    <div class="media-poster">
      <img src="${media.poster_path || '/static/images/placeholder.jpg'}" alt="${media.title}" />
    </div>
    <div class="media-info">
      <div class="media-title">${media.title}</div>
      <div class="media-year">${media.year || "Unknown"}</div>
      <div class="media-status">${formatStatus(media.status)}</div>
      ${progressHtml}
    </div>
  `;

  card.onclick = () => openEditMediaModal(media);
  return card;
}

function formatStatus(status) {
  const map = {
    "to-watch": "Plan to Watch",
    "watching": "Watching",
    "completed": "Completed",
    "dropped": "Dropped"
  };
  return map[status] || status;
}

// === SEARCH ===
async function handleSearch() {
  const query = document.getElementById("search-input").value.trim();
  const type = document.getElementById("search-type").value;
  const year = document.getElementById("search-year").value.trim();

  if (!query) {
    showNotification("Please enter a search term", "error");
    return;
  }

  const resultsContainer = document.getElementById("search-results");
  resultsContainer.innerHTML = `<div class="loading">Searching...</div>`;

  try {
    let combinedResults = [];
    const searchTypes = type === "all" ? ["tv", "movie"] : [type];

    for (let mediaType of searchTypes) {
      const url = `/api/tmdb/search?media_type=${mediaType}&query=${encodeURIComponent(query)}${year ? `&year=${year}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.results) {
        const mapped = data.results.map(item => ({
          id: `${mediaType}-${item.id}`,
          tmdbId: item.id,
          type: mediaType,
          title: mediaType === "tv" ? item.name : item.title,
          year: mediaType === "tv"
            ? (item.first_air_date ? item.first_air_date.substring(0, 4) : "Unknown")
            : (item.release_date ? item.release_date.substring(0, 4) : "Unknown"),
          overview: item.overview,
          posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null
        }));
        combinedResults = combinedResults.concat(mapped);
      }
    }

    if (combinedResults.length === 0) {
      resultsContainer.innerHTML = `<div class="empty-message">No results found for "${query}"</div>`;
      return;
    }

    combinedResults.sort((a, b) => Number(b.year) - Number(a.year));

    const grid = document.createElement("div");
    grid.className = "media-grid";
    combinedResults.forEach(item => grid.appendChild(createSearchResultCard(item)));
    resultsContainer.innerHTML = "";
    resultsContainer.appendChild(grid);

    navigateTo("search");
  } catch {
    resultsContainer.innerHTML = `<div class="error-message">Search failed. Please try again.</div>`;
  }
}
    
function createSearchResultCard(media) {
  const card = document.createElement("div");
  card.className = "media-card";
  card.innerHTML = `
    <div class="media-poster">
      <img src="${media.posterPath || '/static/images/placeholder.jpg'}" alt="${media.title}">
    </div>
    <div class="media-info">
      <div class="media-title">${media.title}</div>
      <div class="media-year">${media.year}</div>
      <div class="media-type">${media.type === "tv" ? "TV Show" : "Movie"}</div>
    </div>
  `;

  card.onclick = async () => {
    if (media.posterPath) {
      const isMatch = await verifyImageWithAI(media.title, media.posterPath);
      if (!isMatch) {
        media.posterPath = await verifyImage(media.title, media.posterPath);
      }
    }
    openAddMediaModal(media);
  };

  return card;
}

// === MODAL MANAGEMENT ===
function openAddMediaModal(media) {
    currentMediaToAdd = media;
    currentMedia = null;
  
    document.getElementById("modal-title").textContent = media.title;
    document.getElementById("modal-year").textContent = media.year;
    document.getElementById("modal-overview").textContent = media.overview || "No overview available";
    document.getElementById("modal-poster").src = media.posterPath || "/static/images/placeholder.jpg";
  
    // Show/hide controls based on media type
    if (media.type === "tv") {
      document.getElementById("episode-section").style.display = "block";
      document.getElementById("movie-progress-section").style.display = "none";
      document.getElementById("watched-episodes").value = 0;
      document.getElementById("total-episodes").textContent = media.total_episodes || "?";
      document.getElementById("current-season").value = 1;
      document.getElementById("current-episode").value = 1;
      updateStatusOptions(["to-watch", "watching", "completed", "dropped"]);
    } else {
      document.getElementById("episode-section").style.display = "none";
      document.getElementById("movie-progress-section").style.display = "block";
      document.getElementById("movie-progress").value = 0;
      document.getElementById("progress-percentage").textContent = "0%";
      updateStatusOptions(["to-watch", "watching", "completed"]);
    }
    document.getElementById("modal-status").value = "to-watch";
    document.getElementById("remove-media-btn").style.display = "none";
    document.getElementById("media-modal").style.display = "block";
  }
  
  function openEditMediaModal(media) {
    currentMedia = media;
    currentMediaToAdd = null;
  
    document.getElementById("modal-title").textContent = media.title;
    document.getElementById("modal-year").textContent = media.year;
    document.getElementById("modal-overview").textContent = media.overview || "No overview available";
    document.getElementById("modal-poster").src = media.poster_path || "/static/images/placeholder.jpg";
  
    if (media.type === "tv") {
      document.getElementById("episode-section").style.display = "block";
      document.getElementById("movie-progress-section").style.display = "none";
      document.getElementById("watched-episodes").value = media.watched_episodes || 0;
      document.getElementById("total-episodes").textContent = media.total_episodes || "?";
      document.getElementById("current-season").value = media.season || 1;
      document.getElementById("current-episode").value = media.episode || 1;
      updateStatusOptions(["to-watch", "watching", "completed", "dropped"]);
    } else {
      document.getElementById("episode-section").style.display = "none";
      document.getElementById("movie-progress-section").style.display = "block";
      document.getElementById("movie-progress").value = media.progress || 0;
      document.getElementById("progress-percentage").textContent = `${media.progress || 0}%`;
      document.getElementById("current-season").value = 1; // Clear season/episode for movies
      document.getElementById("current-episode").value = 1;
      updateStatusOptions(["to-watch", "watching", "completed"]);
    }
    document.getElementById("modal-status").value = media.status || "to-watch";
    document.getElementById("remove-media-btn").style.display = "inline-block";
    document.getElementById("media-modal").style.display = "block";
  }
  
  function closeAllModals() {
    document.querySelectorAll(".modal").forEach(modal => modal.style.display = "none");
    currentMedia = null;
    currentMediaToAdd = null;
  }
  
  // Update status options dynamically
  function updateStatusOptions(statuses) {
    const sel = document.getElementById("modal-status");
    sel.innerHTML = "";
    statuses.forEach(status => {
      const opt = document.createElement("option");
      opt.value = status;
      opt.textContent = formatStatus(status);
      sel.appendChild(opt);
    });
  }
  
  // Handle status change to show/hide episode or progress inputs
  function handleStatusChange() {
    const status = document.getElementById("modal-status").value;
    if ((currentMedia?.type === "tv") || (currentMediaToAdd?.type === "tv")) {
      if (status === "watching") {
        document.getElementById("episode-section").style.display = "block";
      } else {
        document.getElementById("episode-section").style.display = "none";
      }
      if (status === "completed") {
        const total = document.getElementById("total-episodes").textContent;
        if (total !== "?") {
          document.getElementById("watched-episodes").value = total;
        }
      }
    } else {
      document.getElementById("episode-section").style.display = "none";
      document.getElementById("movie-progress-section").style.display = "block";
      if (status === "completed") {
        document.getElementById("movie-progress").value = 100;
        document.getElementById("progress-percentage").textContent = "100%";
      }
    }
  }
  
  // Update the label next to progress slider
  function updateProgressPercentage() {
    const val = document.getElementById("movie-progress").value;
    document.getElementById("progress-percentage").textContent = `${val}%`;
  }
  
  // === Save media (add or update) ===
  async function saveMediaDetails() {
    if (!currentUser) return;
    let mediaObj = currentMedia || currentMediaToAdd;
    if (!mediaObj) return;
  
    const status = document.getElementById("modal-status").value;
    const watched_episodes = mediaObj.type === "tv" ? parseInt(document.getElementById("watched-episodes").value) || 0 : 0;
    const season = mediaObj.type === "tv" ? parseInt(document.getElementById("current-season").value) || 1 : null;
    const episode = mediaObj.type === "tv" ? parseInt(document.getElementById("current-episode").value) || 1 : null;
    const progress = mediaObj.type === "movie" ? parseInt(document.getElementById("movie-progress").value) || 0 : 0;
  
    let poster = mediaObj.posterPath || mediaObj.poster_path;
    try {
      const isValid = await verifyImageWithAI(mediaObj.title, poster);
      if (!isValid) poster = await verifyImage(mediaObj.title, poster);
    } catch {
      poster = await verifyImage(mediaObj.title, poster);
    }
  
    const payload = {
      id: mediaObj.id,
      username: currentUser.username,
      type: mediaObj.type,
      title: mediaObj.title,
      year: mediaObj.year || "",
      overview: mediaObj.overview || "",
      poster_path: poster,
      status,
      watched_episodes,
      total_episodes: mediaObj.total_episodes || 0,
      progress,
      season,
      episode
    };
  
    try {
      let url = "/media";
      let method = "POST";
      if (currentMedia) {
        url = `/media/${mediaObj.id}`;
        method = "PUT";
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(currentMedia ? "Media updated successfully" : "Media added successfully", "success");
        closeAllModals();
        const currentSection = document.querySelector(".nav-item.active").dataset.section;
        if (currentSection === "tv-shows") {
          const filter = document.querySelector("#tv-shows-section .filter-btn.active")?.dataset.filter || "watching";
          loadTVShows(filter);
        } else if (currentSection === "movies") {
          const filter = document.querySelector("#movies-section .filter-btn.active")?.dataset.filter || "to-watch";
          loadMovies(filter);
        } else {
          loadDashboardData();
        }
      } else {
        showNotification(data.error || "Failed to save media", "error");
      }
    } catch {
      showNotification("Network error saving media", "error");
    }
  }
  
  // === Remove media ===
  async function removeMedia() {
    if (!currentUser || !currentMedia) return;
    if (!confirm(`Are you sure you want to remove "${currentMedia.title}" from your list?`)) return;
    try {
      const res = await fetch(`/media/${currentMedia.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showNotification("Media removed successfully", "success");
        closeAllModals();
        const currentSection = document.querySelector(".nav-item.active").dataset.section;
        navigateTo(currentSection);
      } else {
        showNotification(data.error || "Failed to remove media", "error");
      }
    } catch {
      showNotification("Network error removing media", "error");
    }
  }
  
  // === AI IMAGE VERIFICATION ===
  async function verifyImageWithAI(title, imageUrl) {
    try {
      const res = await fetch("/verify-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, image_url: imageUrl })
      });
      const data = await res.json();
      return res.ok && data.is_match;
    } catch {
      return false; // On error, treat as not verified
    }
  }
  
  // Show verification modal, resolve after confirm
  function verifyImage(title, imageUrl) {
    return new Promise(resolve => {
      document.getElementById("verify-title").textContent = title;
      document.getElementById("verify-poster").src = imageUrl;
      document.getElementById("verification-modal").style.display = "block";
  
      window.confirmImagePromise = { resolve };
    });
  }
  
  // Confirm image
  function confirmImage() {
    if (window.confirmImagePromise) {
      window.confirmImagePromise.resolve(document.getElementById("verify-poster").src);
      closeAllModals();
    }
  }
  
  // === Utilities ===
  function showNotification(message, type = "info") {
    const notif = document.createElement("div");
    notif.className = `notification ${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }
  
