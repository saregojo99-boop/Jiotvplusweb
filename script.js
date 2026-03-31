document.addEventListener("DOMContentLoaded", () => {
  let channels = [];
  let shakaPlayer = null;

  async function fetchChannels() {
    try {
      const res = await fetch("channels.json");
      const data = await res.json();
      // Skip the first info object
      channels = data.filter(ch => ch.id);
      renderFilters();
      renderChannels(channels);
    } catch (err) {
      console.error("Error loading channels:", err);
    }
  }

  function renderFilters() {
    const catSet = new Set();
    channels.forEach(ch => { if (ch.category) catSet.add(ch.category); });
    fillSelect("categoryFilter", catSet);
  }

  function fillSelect(id, values) {
    const sel = document.getElementById(id);
    values.forEach(val => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      sel.appendChild(opt);
    });
  }

  function renderChannels(list) {
    const grid = document.getElementById("channelGrid");
    grid.innerHTML = "";
    list.forEach(channel => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <img src="${channel.logo}" alt="${channel.name}" onerror="this.src='https://placehold.co/200x120?text=TV'">
        <h3>${channel.name}</h3>
        <span>${channel.category || 'Uncategorized'}</span>
      `;
      card.onclick = () => playChannel(channel);
      grid.appendChild(card);
    });
  }

  function applyFilters() {
    const q = document.getElementById("search").value.toLowerCase();
    const cat = document.getElementById("categoryFilter").value;
    const filtered = channels.filter(ch =>
      (!q || ch.name.toLowerCase().includes(q)) &&
      (!cat || ch.category === cat)
    );
    renderChannels(filtered);
  }

  async function playChannel(channel) {
    const wrapper = document.getElementById("playerWrapper");
    wrapper.classList.add("show");

    const videoEl = document.getElementById("videoPlayer");

    // Destroy previous player instance
    if (shakaPlayer) {
      await shakaPlayer.destroy();
      shakaPlayer = null;
    }

    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
      alert("Your browser does not support DRM playback.");
      return;
    }

    shakaPlayer = new shaka.Player(videoEl);

    // Build DRM clearKeys config
    const drmConfig = {};
    if (channel.drm && channel.drm["null"] !== "null") {
      drmConfig.clearKeys = channel.drm;
    }

    shakaPlayer.configure({
      drm: drmConfig,
      streaming: {
        bufferingGoal: 30,
        rebufferingGoal: 5,
      }
    });

    // Inject required headers
    shakaPlayer.getNetworkingEngine().registerRequestFilter((type, request) => {
      if (channel.token) {
        const sep = request.uris[0].includes('?') ? '&' : '?';
        request.uris[0] += sep + channel.token;
      }
      if (channel.referer) request.headers['Referer'] = channel.referer;
      if (channel.userAgent) request.headers['User-Agent'] = channel.userAgent;
    });

    try {
      await shakaPlayer.load(channel.mpd);
      await videoEl.play();
    } catch (err) {
      console.error("Playback error:", err);
      alert("Failed to play this channel. It may require a server-side proxy for headers/DRM.");
    }
  }

  window.closePlayer = async () => {
    const wrapper = document.getElementById("playerWrapper");
    wrapper.classList.remove("show");
    if (shakaPlayer) {
      await shakaPlayer.destroy();
      shakaPlayer = null;
    }
  };

  document.getElementById("search").addEventListener("input", applyFilters);
  document.getElementById("categoryFilter").addEventListener("change", applyFilters);
  document.getElementById("refresh").addEventListener("click", () => {
    fetchChannels();
    document.getElementById("search").value = "";
    document.getElementById("categoryFilter").value = "";
  });

  fetchChannels();
});
