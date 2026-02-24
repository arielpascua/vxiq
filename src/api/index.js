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

// TTS Function — robust implementation with Chrome bug workarounds
let cachedVoice = null;
let ttsQueue = [];
let ttsActive = false;

const loadVoice = () => {
  const voices = window.speechSynthesis?.getVoices() || [];
  cachedVoice = voices.find(v =>
    v.name.includes('Google') ||
    v.name.includes('Microsoft') ||
    v.name.includes('Samantha') ||
    v.lang.startsWith('en')
  ) || voices[0] || null;
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoice();
  window.speechSynthesis.addEventListener('voiceschanged', loadVoice);

  // Fix #1: Chrome 15-second bug — speechSynthesis silently stops after inactivity.
  // Resume every 5 seconds to keep the engine alive.
  setInterval(() => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    // Also re-cache voices periodically in case they went stale
    if (!cachedVoice) loadVoice();
  }, 5000);
}

const processQueue = () => {
  if (ttsActive || ttsQueue.length === 0) return;
  ttsActive = true;
  const { text, rate } = ttsQueue.shift();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  if (cachedVoice) utterance.voice = cachedVoice;

  utterance.onend = () => {
    ttsActive = false;
    processQueue();
  };
  utterance.onerror = () => {
    ttsActive = false;
    processQueue();
  };

  // Fix #2: Resume before speaking to recover from Chrome hang state
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(utterance);
};

export const speak = (text, rate = 0.85) => {
  if (!('speechSynthesis' in window)) return;
  // Clear any pending queue and cancel current — new call takes priority
  ttsQueue = [{ text, rate }];
  ttsActive = false;
  window.speechSynthesis.cancel();
  // Small delay to let cancel() settle before speaking
  setTimeout(processQueue, 150);
};
