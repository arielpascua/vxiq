const API_BASE = '/api';

// Generic fetch wrapper
async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

// Sites API
export const sitesAPI = {
  getAll: () => fetchAPI('/sites'),
  getAllIncludeInactive: () => fetchAPI('/sites/all'),
  create: (name) => fetchAPI('/sites', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (id, data) => fetchAPI(`/sites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/sites/${id}`, { method: 'DELETE' }),
};

// Rooms API
export const roomsAPI = {
  getAll: (siteId) => fetchAPI(`/rooms${siteId ? `?site_id=${siteId}` : ''}`),
  getAllIncludeInactive: () => fetchAPI('/rooms/all'),
  create: (data) => fetchAPI('/rooms', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/rooms/${id}`, { method: 'DELETE' }),
};

// Steps API
export const stepsAPI = {
  getAll: () => fetchAPI('/steps'),
  getAllIncludeInactive: () => fetchAPI('/steps/all'),
  create: (data) => fetchAPI('/steps', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchAPI(`/steps/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => fetchAPI(`/steps/${id}`, { method: 'DELETE' }),
};

// Queue API
export const queueAPI = {
  getAll: (siteId, status) => {
    const params = new URLSearchParams();
    if (siteId) params.append('site_id', siteId);
    if (status) params.append('status', status);
    return fetchAPI(`/queue?${params.toString()}`);
  },
  add: (data) => fetchAPI('/queue', { method: 'POST', body: JSON.stringify(data) }),
  call: (id) => fetchAPI(`/queue/${id}/call`, { method: 'PUT' }),
  complete: (id) => fetchAPI(`/queue/${id}/complete`, { method: 'PUT' }),
  updateName: (id, candidate_name) => fetchAPI(`/queue/${id}/name`, { method: 'PUT', body: JSON.stringify({ candidate_name }) }),
  remove: (id) => fetchAPI(`/queue/${id}`, { method: 'DELETE' }),
  cleanup: () => fetchAPI('/queue/cleanup', { method: 'POST' }),
  bulkMove: (candidateIds, stepId, roomId, status) => fetchAPI('/queue/bulk-move', {
    method: 'POST',
    body: JSON.stringify({ candidate_ids: candidateIds, step_id: stepId, room_id: roomId, status: status || 'called' })
  }),
};

// TTS Function — preload voices to avoid race condition
let cachedVoice = null;
let voicesLoaded = false;
let voiceLoadPromise = null;

const loadVoice = () => {
  const voices = window.speechSynthesis?.getVoices() || [];
  if (voices.length > 0) {
    cachedVoice = voices.find(v =>
      v.name.includes('Google') ||
      v.name.includes('Microsoft') ||
      v.name.includes('Samantha') ||
      v.lang.startsWith('en')
    ) || voices[0]; // Fallback to first available voice
    voicesLoaded = true;
  }
  return voices.length > 0;
};

// Wait for voices to be available (with timeout)
const waitForVoices = () => {
  if (voicesLoaded) return Promise.resolve(true);
  if (voiceLoadPromise) return voiceLoadPromise;

  voiceLoadPromise = new Promise((resolve) => {
    // Try immediate load first
    if (loadVoice()) {
      resolve(true);
      return;
    }

    // Set up listener for voiceschanged
    const onVoicesChanged = () => {
      if (loadVoice()) {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(true);
      }
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

    // Also try polling as some browsers don't fire voiceschanged reliably
    let attempts = 0;
    const pollVoices = setInterval(() => {
      attempts++;
      if (loadVoice() || attempts >= 20) { // Max 2 seconds of polling
        clearInterval(pollVoices);
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(voicesLoaded);
      }
    }, 100);

    // Timeout after 3 seconds
    setTimeout(() => {
      clearInterval(pollVoices);
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(voicesLoaded);
    }, 3000);
  });

  return voiceLoadPromise;
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoice();
  window.speechSynthesis.addEventListener('voiceschanged', loadVoice);
  // Pre-warm TTS engine by loading voices
  waitForVoices();
}

export const speak = async (text, rate = 0.85) => {
  if (!('speechSynthesis' in window)) return;

  // Wait for voices to be loaded (with timeout)
  await waitForVoices();

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  if (cachedVoice) utterance.voice = cachedVoice;
  window.speechSynthesis.speak(utterance);
};

// Check if voices are ready (for components that want to know)
export const areVoicesReady = () => voicesLoaded;
