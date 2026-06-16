
        // Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBOYmpK5yTAFT-IQgJv_WE8iUeAf4ydpVA",
    authDomain: "sawarid.firebaseapp.com",
    databaseURL: "https://sawarid-default-rtdb.firebaseio.com", 
    projectId: "sawarid",
    storageBucket: "sawarid.firebasestorage.app",
    messagingSenderId: "410572620208",
    appId: "1:410572620208:web:aca1810b69057d32f05675"
};

// 10 Dynamic Playlists (Sawarid Core Playlists)
const playlists = [
  { url: 'https://raw.githubusercontent.com/sawaridtv/sawaridtv.github.io/main/FIFA2026.m3u', name: "FIFA 26", displayName: "FIFA 26" },
  { url: 'https://raw.githubusercontent.com/sawaridtv/sawaridtv.github.io/heads/main/Sawarid.m3u', name: "Sawarid TV", displayName: "Sawarid TV" },
];

// Adsterra Links
const adsterraLinks = [
  "https://clenchinfer.com/d5yhbq8kg?key=a6e7f0b5411e29ddfc4ad4b07f0bd55e",
  "https://clenchinfer.com/wa4j1fs86d?key=8c109ea1fe3da680691b30448b3eb147",
  "https://clenchinfer.com/gq968gjnk?key=62e59ae53115a83f79c455d7f0529f0f"
];

let parsedChannels = [];
let filteredChannels = [];
let activeChannel = null;
let isPlaying = false;
let availableTracks = [];
let controlsTimeout = null;

// Dual Player Engine Instances
let shakaPlayerInstance = null;
let clapprInstance = null;

// Aspect Ratio State
const aspectRatios = ['contain', 'fill', 'cover']; // contain = FIT, fill = STRETCH, cover = ZOOM
let currentAspectIndex = 0;

// Ad & Counters State
let channelWatchCount = 0;
let adTimer = null;
let countdownInterval = null;

// TV Remote navigation variables
let currentFocusIndex = 0;
let currentMode = 'channels'; 
let playlistFocusIndex = 0;
let lastKeyTime = {};
let repeatInterval = null;
let activeKey = null;
let focusDebounceTimer = null;
const KEY_DEBOUNCE = 180;
const REPEAT_INTERVAL = 180;

// UI Bindings
const videoElement = document.getElementById('liveVideo');
const videoPoster = document.getElementById('videoPoster');
const shakaWatermark = document.getElementById('shakaWatermark');
const bufOverlay = document.getElementById('buffering-overlay');
const errOverlay = document.getElementById('error-overlay');
const errDetail = document.getElementById('error-detail');
const qualSelect = document.getElementById('qualitySelect');
const qualityBadge = document.getElementById('player-quality-badge');
const playIcon = document.getElementById('play-btn-icon');
const muteIcon = document.getElementById('mute-btn-icon');
const playerControls = document.getElementById('playerControls');
const chDisplay = document.getElementById('player-channel-display');

// Toasts completely silenced as requested
function showToast(message) {
  // Silent - No toasts displayed to the user
}

function handleUserInteraction() {
  playerControls.style.opacity = '1';
  document.getElementById('playerCard').style.cursor = 'default';
  
  if (controlsTimeout) clearTimeout(controlsTimeout);
  
  controlsTimeout = setTimeout(() => {
    if (isPlaying && (!videoElement.paused || (clapprInstance && clapprInstance.isPlaying()))) {
      playerControls.style.opacity = '0';
      document.getElementById('playerCard').style.cursor = 'none';
    }
  }, 2000);
}

function createRipple(event, button) {
  const circle = document.createElement("span");
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
  circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
  circle.classList.add("ripple-effect");

  const ripple = button.getElementsByClassName("ripple-effect")[0];
  if (ripple) ripple.remove();

  button.appendChild(circle);
}

// Shaka Native Video Elements Events Sync
videoElement.addEventListener('play', () => {
  isPlaying = true;
  playIcon.setAttribute('data-lucide', 'pause');
  lucide.createIcons();
  handleUserInteraction();
  videoPoster.classList.add('opacity-0');
  bufOverlay.classList.add('hidden');
});

videoElement.addEventListener('pause', () => {
  isPlaying = false;
  playIcon.setAttribute('data-lucide', 'play');
  lucide.createIcons();
  handleUserInteraction();
  videoPoster.classList.remove('opacity-0');
});

videoElement.addEventListener('volumechange', () => {
  if (videoElement.muted || videoElement.volume === 0) {
    muteIcon.setAttribute('data-lucide', 'volume-x');
    muteIcon.classList.add('text-red-500');
  } else {
    muteIcon.setAttribute('data-lucide', 'volume-2');
    muteIcon.classList.remove('text-red-500');
  }
  lucide.createIcons();
});

/* ========================================================================
   ১. ডুয়াল-প্লেয়ার মেমোরি রিলিজ
   ======================================================================== */
async function cleanUpPlayers() {
  if (shakaPlayerInstance) {
    try {
      await shakaPlayerInstance.destroy();
    } catch (e) {
      console.warn("Shaka destruction error", e);
    }
    shakaPlayerInstance = null;
  }
  if (clapprInstance) {
    try {
      clapprInstance.destroy();
    } catch (e) {
      console.warn("Clappr destruction error", e);
    }
    clapprInstance = null;
  }
  videoElement.removeAttribute('src');
  videoElement.load();
  document.getElementById('clapprContainer').innerHTML = '';
  shakaWatermark.classList.add('hidden');
}

/* ========================================================================
   ২. কাস্টম হেডার-লিঙ্ক পার্সার ইঞ্জিন
   ======================================================================== */
async function fetchPlaylistData(url) {
  try {
    const response = await fetch(url);
    if (response.ok) return await response.text();
  } catch (e) {
    console.warn("Direct CORS block. Trying proxy fallbacks...", e);
  }

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (response.ok) return await response.text();
  } catch (e) {
    console.error("CORS bypass failed:", e);
  }
  return "";
}

async function fetchAndParseM3U(url) {
  const text = await fetchPlaylistData(url);
  if (!text) return [];

  const lines = text.split('\n');
  const channels = [];
  
  let tempChannelMeta = null;
  let tempUrls = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      if (tempChannelMeta && tempUrls.length > 0) {
        pushCollectedChannels(channels, tempChannelMeta, tempUrls);
      }

      tempChannelMeta = {
        name: 'Unnamed Channel',
        logo: '',
        isDrm: false,
        drmKeys: {},
        userAgent: '',
        referrer: '',
        headers: {},
        cookies: ''
      };
      tempUrls = [];

      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      if (logoMatch) tempChannelMeta.logo = logoMatch[1];

      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        tempChannelMeta.name = line.substring(commaIndex + 1).trim().replace(/["']/g, '');
      }
    } else if (line.startsWith('#EXTVLCOPT:')) {
      if (!tempChannelMeta) continue;
      if (line.includes('http-user-agent=')) {
        tempChannelMeta.userAgent = line.split('http-user-agent=')[1].trim();
      }
      if (line.includes('http-referrer=')) {
        tempChannelMeta.referrer = line.split('http-referrer=')[1].trim();
      }
    } else if (line.startsWith('#EXTHTTP:')) {
      if (!tempChannelMeta) continue;
      try {
        const jsonStr = line.substring(9).trim();
        const httpMeta = JSON.parse(jsonStr);
        if (httpMeta.cookie) tempChannelMeta.cookies = httpMeta.cookie;
        if (httpMeta.headers) tempChannelMeta.headers = httpMeta.headers;
      } catch(e) {
        console.warn("EXTHTTP parse failed", e);
      }
    } else if (line.startsWith('#KODIPROP:')) {
      if (!tempChannelMeta) continue;
      const propLine = line.substring(10).trim(); 
      const eqIdx = propLine.indexOf('=');
      if (eqIdx !== -1) {
        const key = propLine.substring(0, eqIdx).trim();
        const val = propLine.substring(eqIdx + 1).trim();

        if (key.includes('license_type')) {
          if (val.toLowerCase().includes('clearkey') || val.toLowerCase().includes('org.w3.clearkey')) {
            tempChannelMeta.isDrm = true;
          }
        } else if (key.includes('license_key')) {
          tempChannelMeta.isDrm = true;
          try {
            if (val.startsWith('{')) {
              const parsedKeys = JSON.parse(val);
              for (let k in parsedKeys) {
                const cleanK = k.toLowerCase().replace(/[^a-f0-9]/gi, '');
                const cleanV = parsedKeys[k].toLowerCase().replace(/[^a-f0-9]/gi, '');
                tempChannelMeta.drmKeys[cleanK] = cleanV;
              }
            } else {
              const parts = val.split(':');
              if (parts.length === 2) {
                const cleanK = parts[0].toLowerCase().trim().replace(/[^a-f0-9]/gi, '');
                const cleanV = parts[1].toLowerCase().trim().replace(/[^a-f0-9]/gi, '');
                tempChannelMeta.drmKeys[cleanK] = cleanV;
              }
            }
          } catch (e) {
            console.error("DRM key parsing error:", e);
          }
        }
      }
    } else if (line.startsWith('http://') || line.startsWith('https://')) {
      if (tempChannelMeta) {
        tempUrls.push(line);
      }
    }
  }

  if (tempChannelMeta && tempUrls.length > 0) {
    pushCollectedChannels(channels, tempChannelMeta, tempUrls);
  }

  return channels;
}

function pushCollectedChannels(channelsList, meta, urls) {
  urls.forEach((rawUrl, idx) => {
    let cleanUrl = rawUrl.trim();
    let localMeta = { ...meta };

    if (cleanUrl.includes('|')) {
      const parts = cleanUrl.split('|');
      cleanUrl = parts[0].trim();
      const pipeParams = parts[1].trim();

      const pairs = pipeParams.split('&');
      pairs.forEach(pair => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx !== -1) {
          const k = pair.substring(0, eqIdx).trim();
          const v = pair.substring(eqIdx + 1).trim();
          const lowerK = k.toLowerCase();
          
          if (lowerK === 'user-agent') {
            localMeta.userAgent = v;
          } else if (lowerK === 'referrer') {
            localMeta.referrer = v;
          } else if (lowerK === 'drmlicense') {
            localMeta.isDrm = true;
            const keyParts = v.split(':');
            if (keyParts.length === 2) {
              localMeta.drmKeys[keyParts[0].trim().replace(/[^a-f0-9]/gi, '')] = keyParts[1].trim().replace(/[^a-f0-9]/gi, '');
            }
          } else {
            localMeta.headers[k] = v;
          }
        }
      });
    }

    if (cleanUrl.includes('drmScheme=clearkey')) {
      localMeta.isDrm = true;
      const keyMatch = cleanUrl.match(/drmLicense=([a-f0-9]{32}:[a-f0-9]{32})/i);
      if (keyMatch) {
        const parts = keyMatch[1].split(':');
        localMeta.drmKeys[parts[0].trim()] = parts[1].trim();
      }
    }

    const targetName = (urls.length === 1) ? localMeta.name : `${localMeta.name} ${idx + 1}`;
    channelsList.push({
      name: targetName,
      logo: localMeta.logo,
      url: cleanUrl,
      isDrm: localMeta.isDrm,
      drmKeys: localMeta.drmKeys,
      userAgent: localMeta.userAgent,
      referrer: localMeta.referrer,
      headers: localMeta.headers,
      cookies: localMeta.cookies
    });
  });
}

/* ========================================================================
   ৩. ডাইনামিক চ্যানেল গ্রিড রেন্ডারিং (স্ক্রিনশটের মতো প্রিমিয়াম লেআউট)
   ======================================================================== */
function renderChannelsGrid(targetChannels = parsedChannels) {
  const grid = document.getElementById('channels-grid');
  grid.innerHTML = '';

  if (targetChannels.length === 0) {
    grid.innerHTML = '<div class="col-span-full py-12 text-center text-xs font-bold text-gray-400">No Channels Found</div>';
    return;
  }

  targetChannels.forEach((ch, idx) => {
    const isActive = activeChannel && ch.url === activeChannel.url;
    const card = document.createElement('button');
    
    // আপনার স্ক্রিনশটের মতো করে লোগো বক্স এবং নিচে টেক্সট ব্যানার ডিজাইন
    card.className = `rounded-lg border flex flex-col w-full overflow-hidden transition-all duration-200 outline-none channel-item ${
      isActive 
        ? 'border-[#00d4ff] shadow-[0_0_12px_rgba(0,212,255,0.85)] scale-[1.02]' 
        : 'border-[#2e1256]/80 bg-[#0c051a] hover:border-white/40'
    }`;
    
    card.setAttribute('data-url', ch.url);
    card.setAttribute('data-index', idx);
    card.setAttribute('tabindex', '-1');

    card.addEventListener("click", function(e) {
      selectChannel(idx);
    });

    card.innerHTML = `
      <div class="bg-white p-1.5 flex-1 flex items-center justify-center w-full aspect-[1.35/1] overflow-hidden">
        <img src="${ch.logo}" alt="" class="max-h-full max-w-full object-contain" onerror="this.src='https://i.postimg.cc/htZPY1DX/Sawarid-logo.png';" />
      </div>
      <div class="w-full py-1 px-1 text-center text-[9px] sm:text-[10px] font-black truncate text-white uppercase ${
        isActive ? 'bg-[#0052cc]' : 'bg-[#5c134f]'
      }">
        ${ch.name}
      </div>
    `;
    grid.appendChild(card);
  });

  updateChannelItems();
}

/* ========================================================================
   ৪. ডুয়াল-প্লেয়ার সুইচিং ইঞ্জিন (DASH -> Shaka, HLS/TS -> Clappr)
   ======================================================================== */
async function loadChannelStream(channel) {
  bufOverlay.classList.remove('hidden');
  errOverlay.classList.add('hidden');
  chDisplay.innerText = channel.name;

  // পোস্টার রিসেট ও দৃশ্যমান করা (ফেড-ইন)
  videoPoster.classList.remove('opacity-0');

  qualSelect.innerHTML = '<option value="auto">Auto Quality</option>';
  qualSelect.value = 'auto';

  // পূর্ববর্তী প্লেয়ার ইনস্ট্যান্সগুলো নিরাপদের সাথে ডিসপোজ করা
  await cleanUpPlayers();

  const urlLower = channel.url.toLowerCase();
  const isDASH = urlLower.includes('.mpd') || channel.isDrm;

  if (isDASH) {
    // DASH DRM কন্টেন্ট -> Shaka Player Engine
    document.getElementById('liveVideo').classList.remove('hidden');
    document.getElementById('clapprContainer').classList.add('hidden');
    shakaWatermark.classList.remove('hidden'); // Shaka ওয়াটারমার্ক শো করা

    videoElement.muted = false;
    videoElement.volume = 1.0;

    try {
      const player = new shaka.Player();
      await player.attach(videoElement);
      shakaPlayerInstance = player;

      player.getNetworkingEngine().registerRequestFilter((type, request) => {
        if (channel.userAgent) request.headers['User-Agent'] = channel.userAgent;
        if (channel.referrer) request.headers['Referer'] = channel.referrer;
        if (channel.cookies) request.headers['Cookie'] = channel.cookies;
        if (channel.headers && Object.keys(channel.headers).length > 0) {
          for (let key in channel.headers) {
            request.headers[key] = channel.headers[key];
          }
        }
      });

      player.addEventListener('error', (e) => {
        if (!videoElement.paused) return;
        if (e.detail.severity === shaka.util.Error.Severity.RECOVERABLE) return;
        handleStreamFailure(e.detail);
      });

      // Shaka-তে রেজোলিউশন প্রোফাইল ডিক্লেয়ার ও আপডেট লুপ ইভেন্ট
      player.addEventListener('trackschanged', updateShakaQualities);
      player.addEventListener('variantchanged', updateShakaQualities);

      // আপনার বন্ধুর ফাইলের সুপার-ফাস্ট কনফিগারেশন সেটিংস
      player.configure({
        manifest: {
          defaultPresentationDelay: 5, // live edge presentation delay
          dash: {
            ignoreMinBufferTime: true, // ম্যানিফেস্টের বাফার ডিলে বাইপাস করে ইনস্ট্যান্ট প্লে করার জন্য
            autoCorrectDrift: true
          },
          retryParameters: {
            timeout: 4500,
            maxAttempts: 5,
            backoffFactor: 1.5
          }
        },
        streaming: {
          bufferingGoal: 15,      // বাফার সিকিউরড রাখতে ১৫ সেকেন্ড টার্গেট
          rebufferingGoal: 3,     // ড্রপ রিকভারির জন্য ৩ সেকেন্ড গোল
          bufferBehind: 45,
          stallEnabled: true,
          stallThreshold: 1,
          stallSkip: 0.1,
          lowLatencyMode: false,
          retryParameters: {
            timeout: 4500,
            maxAttempts: 5,
            backoffFactor: 1.5
          }
        },
        abr: {
          enabled: true, 
          defaultBandwidthEstimate: 500000, // কম ব্যান্ডউইথ দিয়ে শুরু হবে যাতে চোখের পলকে প্রথম ফ্রেম আসে
          switchInterval: 2,
          restrictToElementSize: false
        },
        drm: {
          delayLicenseRequestUntilPlayed: false
        }
      });

      if (channel.isDrm && channel.drmKeys && Object.keys(channel.drmKeys).length > 0) {
        player.configure({
          drm: { clearKeys: channel.drmKeys }
        });
      }

      // ব্রাউজারের নেটিভ ভিডিও ইভেন্টের মাধ্যমে দ্রুততম রেসপন্স লোডিং ট্রিগার
      videoElement.onwaiting = () => {
         bufOverlay.classList.remove('hidden');
      };

      videoElement.onplaying = () => {
         bufOverlay.classList.add('hidden');
         videoPoster.classList.add('opacity-0');
         isPlaying = true;
         playIcon.setAttribute('data-lucide', 'pause');
         lucide.createIcons();
      };

      videoElement.onloadedmetadata = () => {
         if (videoElement.videoHeight) {
           qualityBadge.innerText = `HD ${videoElement.videoHeight}p`;
         }
      };

      await player.load(channel.url);

      // কাস্টম এ্যাসপেক্ট রেশিও ডিফল্টলি পুনরায় প্রয়োগ করা
      applyAspectRatio();

      // দ্রুত অটো-প্লে নিশ্চিতকরণ
      videoElement.play().then(() => {
        isPlaying = true;
        videoPoster.classList.add('opacity-0');
        bufOverlay.classList.add('hidden');
      }).catch(e => {
        console.warn("Autoplay restricted. Retrying with mute fallback...", e);
        videoElement.muted = true;
        videoElement.play().then(() => {
          isPlaying = true;
          videoPoster.classList.add('opacity-0');
          bufOverlay.classList.add('hidden');
        });
      });

    } catch (err) {
      if (videoElement.paused) handleStreamFailure(err);
    }

  } else {
    // HLS (.m3u8) এবং TS (.ts) কন্টেন্ট -> Clappr Player Engine
    document.getElementById('liveVideo').classList.add('hidden');
    document.getElementById('clapprContainer').classList.remove('hidden');
    shakaWatermark.classList.add('hidden'); // Shaka ওয়াটারমার্ক অফ করা

    try {
      clapprInstance = new Clappr.Player({
        source: channel.url,
        parentId: "#clapprContainer",
        autoPlay: true,
        mute: false,
        width: "100%",
        height: "100%",
        watermark: "https://i.postimg.cc/htZPY1DX/Sawarid-logo.png",
        watermarkPosition: 'bottom-right',
        watermarkOpacity: 0.7,
        plugins: [
          HlsjsPlayback, 
          LevelSelector,
          window.ClapprPipMode ? window.ClapprPipMode.PipButton : null
        ].filter(Boolean),
        mediacontrol: { 
          seekbar: "#1748e8", 
          buttons: "white" 
        },
        poster: "https://i.pinimg.com/originals/5a/93/4e/5a934e84f67d2a61a118ec95b1d6cb74.gif"
      });

      clapprInstance.on(Clappr.Events.PLAYER_PLAY, () => {
        isPlaying = true;
        videoPoster.classList.add('opacity-0');
        bufOverlay.classList.add('hidden');
        errOverlay.classList.add('hidden');
        playIcon.setAttribute('data-lucide', 'pause');
        lucide.createIcons();
        applyAspectRatio(); // এ্যাসপেক্ট রেশিও রি-এপ্লাই করা
      });

      // ক্ল্যাপ্র-এর কোয়ালিটি লেভেল রিড করে আমাদের প্রিমিয়াম সিলেক্ট মেনুতে পুশ করা
      clapprInstance.on(Clappr.Events.PLAYBACK_LEVELS_AVAILABLE, (levels) => {
        updateClapprQualities(levels);
      });

      clapprInstance.on(Clappr.Events.PLAYER_PAUSE, () => {
        isPlaying = false;
        videoPoster.classList.remove('opacity-0');
        playIcon.setAttribute('data-lucide', 'play');
        lucide.createIcons();
      });

      clapprInstance.on(Clappr.Events.PLAYER_BUFFERING, () => {
        bufOverlay.classList.remove('hidden');
      });

      clapprInstance.on(Clappr.Events.PLAYER_BUFFER_FULL, () => {
        bufOverlay.classList.add('hidden');
        videoPoster.classList.add('opacity-0');
      });

      clapprInstance.on(Clappr.Events.PLAYER_ERROR, (err) => {
        handleStreamFailure(err);
      });

    } catch (err) {
      handleStreamFailure(err);
    }
  }
}

/* ========================================================================
   ৪.১. ডুয়াল-প্লেয়ার রেজোলিউশন ট্র্যাক রেন্ডারার
   ======================================================================== */
function updateShakaQualities() {
  if (!shakaPlayerInstance) return;
  qualSelect.innerHTML = '<option value="auto">Auto Quality</option>';
  
  const tracks = shakaPlayerInstance.getVariantTracks();
  if (tracks && tracks.length > 0) {
    availableTracks = tracks;
    const sortedTracks = [...tracks].sort((a, b) => (b.height || 0) - (a.height || 0));
    const seenHeights = new Set();
    
    sortedTracks.forEach(track => {
      if (track.height && !seenHeights.has(track.height)) {
        seenHeights.add(track.height);
        const opt = document.createElement('option');
        opt.value = `track:${track.id}`;
        opt.innerText = `${track.height}p`;
        qualSelect.appendChild(opt);
      }
    });
  }
}

function updateClapprQualities(levels) {
  if (!clapprInstance) return;
  qualSelect.innerHTML = '<option value="auto">Auto Quality</option>';
  
  const currentLevels = levels || clapprInstance.levels;
  if (currentLevels && currentLevels.length > 0) {
    currentLevels.forEach(level => {
      const opt = document.createElement('option');
      opt.value = `clappr:${level.id}`;
      const label = level.label || (level.height ? `${level.height}p` : `Level ${level.id}`);
      opt.innerText = label;
      qualSelect.appendChild(opt);
    });
  }
}

function handleQualitySelection(val) {
  if (shakaPlayerInstance) {
    if (val === 'auto') {
      shakaPlayerInstance.configure({ abr: { enabled: true } });
      qualityBadge.innerText = "AUTO";
    } else if (val.startsWith('track:')) {
      const trackId = parseInt(val.split(':')[1], 10);
      const track = availableTracks.find(t => t.id === trackId);
      if (track) {
        shakaPlayerInstance.configure({ abr: { enabled: false } });
        shakaPlayerInstance.selectVariantTrack(track, true);
        qualityBadge.innerText = `${track.height}p`;
      }
    }
  } else if (clapprInstance) {
    if (val === 'auto') {
      clapprInstance.currentLevel = -1; 
      qualityBadge.innerText = "AUTO";
    } else if (val.startsWith('clappr:')) {
      const levelId = parseInt(val.split(':')[1], 10);
      clapprInstance.currentLevel = levelId;
      
      const selectedLevel = clapprInstance.levels.find(l => l.id === levelId);
      const label = selectedLevel ? (selectedLevel.label || `${selectedLevel.height}p`) : 'HQ';
      qualityBadge.innerText = label.toUpperCase();
    }
  }
}

/* ========================================================================
   ৪.২. ভিডিও এ্যাসপেক্ট রেশিও কন্ট্রোল (FIT, STRETCH, ZOOM)
   ======================================================================== */
function toggleAspectRatio() {
  currentAspectIndex = (currentAspectIndex + 1) % aspectRatios.length;
  applyAspectRatio();
}

function applyAspectRatio() {
  const currentRatio = aspectRatios[currentAspectIndex];
  
  if (videoElement) {
    videoElement.style.objectFit = currentRatio;
  }
  
  const clapprVideo = document.querySelector('#clapprContainer video');
  if (clapprVideo) {
    clapprVideo.style.objectFit = currentRatio;
  }
}

function selectChannel(index) {
  const targetList = filteredChannels.length > 0 ? filteredChannels : parsedChannels;
  if (targetList[index]) {
    activeChannel = targetList[index];
    
    channelWatchCount++;
    if (channelWatchCount >= 4) {
      channelWatchCount = 0;
      showAdPopup();
    }

    renderChannelsGrid(targetList);
    loadChannelStream(activeChannel);
  }
}

function retryCurrentChannel() {
  if (activeChannel) loadChannelStream(activeChannel);
}

function togglePlay() {
  if (shakaPlayerInstance) {
    if (videoElement.paused) videoElement.play();
    else videoElement.pause();
  } else if (clapprInstance) {
    if (clapprInstance.isPlaying()) clapprInstance.pause();
    else clapprInstance.play();
  }
}

function toggleMute() {
  if (shakaPlayerInstance) {
    videoElement.muted = !videoElement.muted;
  } else if (clapprInstance) {
    if (clapprInstance.getVolume() === 0) {
      clapprInstance.setVolume(100);
      muteIcon.setAttribute('data-lucide', 'volume-2');
      muteIcon.classList.remove('text-red-500');
    } else {
      clapprInstance.setVolume(0);
      muteIcon.setAttribute('data-lucide', 'volume-x');
      muteIcon.classList.add('text-red-500');
    }
    lucide.createIcons();
  }
}

function updateTimelineBar() {
  const progress = document.getElementById('timelineProgress');
  if (!videoElement.duration || !isFinite(videoElement.duration)) {
    progress.style.width = '100%';
    progress.classList.remove('bg-[#dd2476]');
    progress.classList.add('bg-red-600', 'animate-pulse');
  } else {
    progress.classList.remove('bg-red-600', 'animate-pulse');
    progress.classList.add('bg-[#dd2476]');
    const pct = (videoElement.currentTime / videoElement.duration) * 100;
    progress.style.width = `${pct}%`;
  }
}

function seekVideo(event) {
  if (videoElement.duration && isFinite(videoElement.duration)) {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const width = rect.width;
    const pct = clickX / width;
    videoElement.currentTime = pct * videoElement.duration;
  }
}

// PiP Mode configuration
function togglePiP() {
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture();
  } else if (videoElement.requestPictureInPicture) {
    videoElement.requestPictureInPicture();
  }
}

async function toggleFullscreen() {
  const pcard = document.getElementById('playerCard');
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (pcard.requestFullscreen) {
      await pcard.requestFullscreen();
    } else if (videoElement.webkitEnterFullscreen) {
      videoElement.webkitEnterFullscreen();
    }
    
    // ফুলস্ক্রিনে ডিফল্টভাবে ভিডিও FORCE FILL (STRETCH) করা হবে
    currentAspectIndex = 1; // 1 = 'fill' (STRETCH)
    applyAspectRatio();

    if (screen.orientation && screen.orientation.lock) {
      try {
        await screen.orientation.lock('landscape');
      } catch (e) {
        console.warn("Screen orientation lock is not supported on this device/browser.", e);
      }
    }
  } else {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
    
    if (screen.orientation && screen.orientation.unlock) {
      try {
        screen.orientation.unlock();
      } catch (e) {
        console.warn("Screen orientation unlock failed:", e);
      }
    }
  }
}

// Fullscreen স্ট্যাটাস মনিটরিং এবং ডিফল্ট ফোর্স ফিল এপ্লাই
document.addEventListener('fullscreenchange', () => {
  const pcard = document.getElementById('playerCard');
  if (pcard) {
    if (document.fullscreenElement) {
      pcard.classList.add('fullscreen-mode');
      currentAspectIndex = 1; // ফোর্স ফিল সেট করা হলো
      applyAspectRatio();
    } else {
      pcard.classList.remove('fullscreen-mode');
      if (screen.orientation && screen.orientation.unlock) {
        try { screen.orientation.unlock(); } catch (e) {}
      }
    }
  }
});

/* ========================================================================
   ৫. ১০টি মাল্টি-প্লেলিস্ট সিলেক্টর ও ফায়ারবেস ট্র্যাকার
   ======================================================================== */
function setupPlaylistSelector() {
  const playlistSelector = document.getElementById('playlistSelector');
  let buttonsHtml = '';
  
  playlists.forEach((playlist, index) => {
    const activeClass = index === 0 ? 'bg-[#dd2476] border-white text-white shadow-lg' : 'bg-[#14082b] border-[#2e1256] text-gray-300';
    buttonsHtml += `
      <button 
        class="playlist-btn px-4 py-1.5 rounded-lg border text-xs font-extrabold cursor-pointer transition-all focus:outline-none ${activeClass}" 
        data-playlist-url="${playlist.url}" 
        data-playlist-name="${playlist.name}" 
        data-index="${index}"
        tabindex="${index === 0 ? '0' : '-1'}"
      >
        ${playlist.displayName}
      </button>`;
  });
  
  playlistSelector.innerHTML = buttonsHtml;
  setupPlaylistClickEvents();
  loadPlaylistByIndex(0); 
}

function setupPlaylistClickEvents() {
  const buttons = document.querySelectorAll('.playlist-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', function() {
      buttons.forEach(b => {
        b.classList.remove('bg-[#dd2476]', 'border-white', 'text-white', 'shadow-lg');
        b.classList.add('bg-[#14082b]', 'border-[#2e1256]', 'text-gray-300');
        b.setAttribute('tabindex', '-1');
      });

      this.classList.remove('bg-[#14082b]', 'border-[#2e1256]', 'text-gray-300');
      this.classList.add('bg-[#dd2476]', 'border-white', 'text-white', 'shadow-lg');
      this.setAttribute('tabindex', '0');

      const index = parseInt(this.getAttribute('data-index'));
      playlistFocusIndex = index;
      loadPlaylistByIndex(index);
    });
  });
}

async function loadPlaylistByIndex(index) {
  const playlist = playlists[index];
  const grid = document.getElementById('channels-grid');
  grid.innerHTML = `
    <div class="col-span-full py-12 flex flex-col items-center justify-center gap-3">
      <div class="w-8 h-8 rounded-full border-4 border-[#2e1256] border-t-[#dd2476] animate-spin"></div>
      <p class="text-[11px] text-gray-400 font-bold uppercase tracking-wider font-arabic">Syncing ${playlist.displayName}...</p>
    </div>`;

  parsedChannels = await fetchAndParseM3U(playlist.url);
  filteredChannels = [];
  
  document.getElementById('channelSearch').value = '';
  document.getElementById('clearSearch').classList.add('hidden');
  document.getElementById('searchResultsInfo').classList.add('hidden');

  if (parsedChannels.length > 0) {
    activeChannel = parsedChannels[0];
    renderChannelsGrid(parsedChannels);
    await loadChannelStream(activeChannel);
  } else {
    grid.innerHTML = '<div class="col-span-full py-12 text-center text-xs font-bold text-gray-400">Failed to load channels</div>';
  }
}

function initFirebaseCounters() {
  try {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const usersRef = db.ref("onlineUsers");
    const totalRef = db.ref("totalVisitors");
    const todayRef = db.ref("dailyVisitors/" + new Date().toISOString().slice(0, 10));
    const sessionId = "user_" + Math.random().toString(36).substring(2, 12);
    
    usersRef.child(sessionId).set({ lastSeen: Date.now() });
    totalRef.transaction(c => (c || 0) + 1);
    todayRef.transaction(c => (c || 0) + 1);
    
    window.addEventListener("beforeunload", () => usersRef.child(sessionId).remove());
    
    const onlineCounter = document.getElementById("online-counter");
    const ACTIVE_THRESHOLD = 5 * 1000;
    
    function updateOnlineCounter() {
      usersRef.once("value").then(snap => {
        const onlineUsers = snap.val() || {};
        const now = Date.now();
        const activeUsers = Object.values(onlineUsers).filter(u => (now - u.lastSeen) <= ACTIVE_THRESHOLD);
        const totalOnline = activeUsers.length;
        
        totalRef.once("value").then(snap2 => {
          const totalVisitors = snap2.val() || 0;
          todayRef.once("value").then(snap3 => {
            const todayVisitors = snap3.val() || 0;
            onlineCounter.innerHTML = `👥 Online: ${totalOnline} | 📅 Today: ${todayVisitors} | 🌍 Total: ${totalVisitors}`;
          });
        });
      });
    }
    
    updateOnlineCounter();
    usersRef.on("value", updateOnlineCounter);
    setInterval(() => usersRef.child(sessionId).update({ lastSeen: Date.now() }), 15000);
  } catch (e) {
    console.error("Firebase database reference lost", e);
  }
}

/* ========================================================================
   ৬. সার্চ ইঞ্জিন
   ======================================================================== */
function setupSearchEngine() {
  const searchInput = document.getElementById('channelSearch');
  const clearBtn = document.getElementById('clearSearch');
  const searchResultsInfo = document.getElementById('searchResultsInfo');

  searchInput.addEventListener('input', function() {
    const query = this.value.trim().toLowerCase();
    if (query.length > 0) {
      clearBtn.classList.remove('hidden');
      filteredChannels = parsedChannels.filter(ch => ch.name.toLowerCase().includes(query));
      renderChannelsGrid(filteredChannels);
      
      searchResultsInfo.classList.remove('hidden');
      searchResultsInfo.innerText = `Found ${filteredChannels.length} Channels`;
    } else {
      clearBtn.classList.add('hidden');
      resetSearchState();
    }
  });

  clearBtn.addEventListener('click', function() {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    resetSearchState();
  });
}

function resetSearchState() {
  filteredChannels = [];
  document.getElementById('searchResultsInfo').classList.add('hidden');
  renderChannelsGrid(parsedChannels);
  focusOnChannels();
}

/* ========================================================================
   ৭. ১৫ সেকেন্ড কাউন্টডাউন অ্যাড পপআপ ইন্টিগ্রেশন
   ======================================================================== */
function showAdPopup() {
  const overlay = document.getElementById('ad-popup-overlay');
  const iframe = document.getElementById('ad-popup-iframe');
  const timerText = document.getElementById('ad-popup-timer-text');

  const randomIndex = Math.floor(Math.random() * adsterraLinks.length);
  const selectedAdUrl = adsterraLinks[randomIndex];

  iframe.src = selectedAdUrl;
  overlay.classList.add('show');

  let timeLeft = 15;
  timerText.textContent = `Please wait... Ad closes automatically in ${timeLeft} seconds.`;

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      timerText.textContent = `Please wait... Ad closes automatically in ${timeLeft} seconds.`;
    } else {
      clearInterval(countdownInterval);
    }
  }, 1000);

  if (adTimer) clearTimeout(adTimer);
  adTimer = setTimeout(() => {
    closeAdPopup();
  }, 15000);
}

function closeAdPopup() {
  const overlay = document.getElementById('ad-popup-overlay');
  const iframe = document.getElementById('ad-popup-iframe');
  
  if (overlay) overlay.classList.remove('show');
  if (iframe) iframe.src = ''; 
  if (countdownInterval) clearInterval(countdownInterval);
}

/* ========================================================================
   ৭.১. ১৫ সেকেন্ড পর ৫ সেকেন্ডের Sawarid অ্যাপ প্রোমো পপ-আপ ট্রিগার
   ======================================================================== */
function initSawaridAppPromoPopup() {
  setTimeout(() => {
    const promoOverlay = document.getElementById('app-promo-overlay');
    if (promoOverlay) {
      promoOverlay.classList.remove('hidden');
      promoOverlay.classList.add('flex');
      
      // ৫ সেকেন্ড পর স্বয়ংক্রিয়ভাবে বন্ধ করার টাইমার
      setTimeout(() => {
        promoOverlay.classList.remove('flex');
        promoOverlay.classList.add('hidden');
      }, 5000);
    }
  }, 15000); // ১৫ সেকেন্ড ডিলে
}

/* ========================================================================
   ৮. টিভি রিমোট নেভিগেশন কন্ট্রোল (D-Pad Keyboard Control)
   ======================================================================== */
function updateChannelItems() {
  const items = document.querySelectorAll('.channel-item');
  if (items.length > 0 && currentMode === 'channels') {
    setFocus(currentFocusIndex);
  }
}

function setFocus(index) {
  if (focusDebounceTimer) clearTimeout(focusDebounceTimer);
  
  focusDebounceTimer = setTimeout(() => {
    const playlistButtons = document.querySelectorAll('.playlist-btn');
    const channelItems = document.querySelectorAll('.channel-item');

    if (currentMode === 'playlist') {
      playlistButtons.forEach(btn => btn.classList.remove('scale-105', 'border-white', 'shadow-md'));
      if (playlistButtons.length > 0 && index >= 0 && index < playlistButtons.length) {
        playlistFocusIndex = index;
        const activeBtn = playlistButtons[playlistFocusIndex];
        activeBtn.classList.add('scale-105', 'border-white', 'shadow-md');
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    } else if (currentMode === 'channels') {
      channelItems.forEach(item => {
        item.classList.remove('border-[#00d4ff]', 'scale-[1.03]', 'shadow-[0_0_10px_rgba(0,212,255,0.7)]');
      });
      if (channelItems.length > 0 && index >= 0 && index < channelItems.length) {
        currentFocusIndex = index;
        const activeItem = channelItems[currentFocusIndex];
        activeItem.classList.add('border-[#00d4ff]', 'scale-[1.03]', 'shadow-[0_0_10px_rgba(0,212,255,0.7)]');
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, 50);
}

function getGridColumns() {
  if (window.innerWidth <= 768) return 4;
  return 3; 
}

function navigateUp() {
  const channelItems = document.querySelectorAll('.channel-item');
  const playlistButtons = document.querySelectorAll('.playlist-btn');

  if (currentMode === 'playlist') {
    currentMode = 'channels';
    setFocus(currentFocusIndex);
  } else if (currentMode === 'channels') {
    if (channelItems.length === 0) return;
    const cols = getGridColumns();
    if (currentFocusIndex >= cols) {
      setFocus(currentFocusIndex - cols);
    } else {
      if (playlistButtons.length > 0) {
        currentMode = 'playlist';
        setFocus(playlistFocusIndex);
      }
    }
  }
}

function navigateDown() {
  const channelItems = document.querySelectorAll('.channel-item');
  if (currentMode === 'playlist') {
    currentMode = 'channels';
    setFocus(currentFocusIndex);
  } else if (currentMode === 'channels') {
    if (channelItems.length === 0) return;
    const cols = getGridColumns();
    if (currentFocusIndex + cols < channelItems.length) {
      setFocus(currentFocusIndex + cols);
    } else {
      setFocus(currentFocusIndex % cols);
    }
  }
}

function navigateLeft() {
  const channelItems = document.querySelectorAll('.channel-item');
  const playlistButtons = document.querySelectorAll('.playlist-btn');

  if (currentMode === 'playlist') {
    if (playlistButtons.length > 0) {
      const nextIdx = playlistFocusIndex > 0 ? playlistFocusIndex - 1 : playlistButtons.length - 1;
      setFocus(nextIdx);
    }
  } else if (currentMode === 'channels') {
    if (channelItems.length === 0) return;
    const nextIdx = currentFocusIndex > 0 ? currentFocusIndex - 1 : channelItems.length - 1;
    setFocus(nextIdx);
  }
}

function navigateRight() {
  const channelItems = document.querySelectorAll('.channel-item');
  const playlistButtons = document.querySelectorAll('.playlist-btn');

  if (currentMode === 'playlist') {
    if (playlistButtons.length > 0) {
      const nextIdx = playlistFocusIndex < playlistButtons.length - 1 ? playlistFocusIndex + 1 : 0;
      setFocus(nextIdx);
    }
  } else if (currentMode === 'channels') {
    if (channelItems.length === 0) return;
    const nextIdx = currentFocusIndex < channelItems.length - 1 ? currentFocusIndex + 1 : 0;
    setFocus(nextIdx);
  }
}

function handleEnterPress() {
  const playlistButtons = document.querySelectorAll('.playlist-btn');
  if (currentMode === 'playlist' && playlistButtons.length > 0) {
    playlistButtons[playlistFocusIndex].click();
  } else if (currentMode === 'channels') {
    selectChannel(currentFocusIndex);
  } else if (currentMode === 'player') {
    togglePlay();
  }
}

function handleTVRemoteKeyDown(e) {
  const key = e.key;
  const searchInput = document.getElementById('channelSearch');

  if (document.activeElement === searchInput) {
    if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(key)) {
      e.preventDefault();
      if (key === 'Escape') {
        searchInput.value = '';
        resetSearchState();
        searchInput.blur();
      } else {
        currentMode = 'channels';
        searchInput.blur();
        focusOnChannels();
      }
    }
    return;
  }

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Escape'].includes(key)) {
    e.preventDefault();
  }

  const now = Date.now();
  if (lastKeyTime[key] && now - lastKeyTime[key] < KEY_DEBOUNCE) return;
  lastKeyTime[key] = now;

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
    if (e.repeat) return;
    handleNavigationKey(key);
    startRepeatNavigation(key);
  } else if (key === 'Enter' || key === ' ') {
    handleEnterPress();
  } else if (key === 'Escape') {
    currentMode = 'channels';
    setFocus(currentFocusIndex);
  }
}

function startRepeatNavigation(key) {
  if (repeatInterval) clearInterval(repeatInterval);
  activeKey = key;
  repeatInterval = setInterval(() => {
    if (activeKey === key) handleNavigationKey(key);
  }, REPEAT_INTERVAL);
}

function stopRepeatNavigation() {
  if (repeatInterval) {
    clearInterval(repeatInterval);
    repeatInterval = null;
    activeKey = null;
  }
}

function handleNavigationKey(key) {
  if (key === 'ArrowUp') navigateUp();
  else if (key === 'ArrowDown') navigateDown();
  else if (key === 'ArrowLeft') navigateLeft();
  else if (key === 'ArrowRight') navigateRight();
}

function focusOnChannels() {
  currentMode = 'channels';
  const channelItems = document.querySelectorAll('.channel-item');
  if (channelItems.length > 0) setFocus(currentFocusIndex);
}

/* ========================================================================
   ৯. সিকিউরিটি প্রোটেকশন (Disable Inspect & Copying)
   ======================================================================== */
function initSecurityShield() {
  document.addEventListener('contextmenu', e => e.preventDefault(), true);
  document.addEventListener('keydown', e => {
    if (e.keyCode === 123 || e.key === 'F12') e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && ['U', 'S', 'C', 'V', 'X', 'A'].includes(e.key.toUpperCase())) e.preventDefault();
  }, true);

  const preventEvent = e => e.preventDefault();
  document.addEventListener('copy', preventEvent, true);
  document.addEventListener('cut', preventEvent, true);
  document.addEventListener('paste', preventEvent, true);
  document.addEventListener('selectstart', preventEvent, true);
  document.addEventListener('dragstart', preventEvent, true);
}

/* ========================================================================
   ১০. PWA ক্রোম ইনস্টলার ও সার্ভিস ওয়ার্কার স্ক্রিপ্ট
   ======================================================================== */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('pwaInstallBtn');
  if (installBtn) {
    installBtn.classList.remove('hidden');
  }
});

document.getElementById('pwaInstallBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`User Response to PWA prompt: ${outcome}`);
  deferredPrompt = null;
  document.getElementById('pwaInstallBtn').classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  document.getElementById('pwaInstallBtn').classList.add('hidden');
});

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
      console.log('Sawarid Service Worker registered.');
    } catch (e) {
      console.warn('Sawarid SW registration failed. To enable install prompt on Chrome, please ensure sw.js is hosted next to index.html on server.', e);
    }
  }
}

// App initialization
async function initApp() {
  shaka.polyfill.installAll();
  if (!shaka.Player.isBrowserSupported()) {
    console.error('Browser does not support secure DRM stream playback.');
  }

  initSecurityShield();
  initFirebaseCounters();
  setupPlaylistSelector();
  setupSearchEngine();
  registerServiceWorker();
  initSawaridAppPromoPopup(); // অ্যাপ প্রোমো পপআপ চালু করা হলো

  document.addEventListener('keydown', handleTVRemoteKeyDown);
  document.addEventListener('keyup', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) stopRepeatNavigation();
  });

  document.addEventListener('click', function(e) {
    const item = e.target.closest('.channel-item');
    if (item) {
      const idx = parseInt(item.getAttribute('data-index'));
      currentFocusIndex = idx;
      currentMode = 'channels';
      setFocus(currentFocusIndex);
    }
    const pBtn = e.target.closest('.playlist-btn');
    if (pBtn) {
      const idx = parseInt(pBtn.getAttribute('data-index'));
      playlistFocusIndex = idx;
      currentMode = 'playlist';
      setFocus(playlistFocusIndex);
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initApp();
  lucide.createIcons();
});
