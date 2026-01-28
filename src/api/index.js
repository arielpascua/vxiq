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
  remove: (id) => fetchAPI(`/queue/${id}`, { method: 'DELETE' }),
  cleanup: () => fetchAPI('/queue/cleanup', { method: 'POST' }),
  bulkMove: (candidateIds, stepId, roomId, status) => fetchAPI('/queue/bulk-move', {
    method: 'POST',
    body: JSON.stringify({ candidate_ids: candidateIds, step_id: stepId, room_id: roomId, status: status || 'called' })
  }),
};

// TTS Function
export const speak = (text, rate = 0.85) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to get a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.name.includes('Google') || 
      v.name.includes('Microsoft') || 
      v.name.includes('Samantha') ||
      v.lang.startsWith('en')
    );
    if (preferredVoice) utterance.voice = preferredVoice;
    
    window.speechSynthesis.speak(utterance);
  }
};
