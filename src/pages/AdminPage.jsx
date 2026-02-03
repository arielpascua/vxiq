import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Volume2, Plus, Trash2, Monitor, Settings, Users, MapPin,
  RefreshCw, Clock, ArrowRight, X, Menu, Search, Timer, CheckCircle, AlertCircle, Info, Pencil, Check
} from 'lucide-react';
import { sitesAPI, roomsAPI, stepsAPI, queueAPI, speak } from '../api';

export default function AdminPage() {
  const [sites, setSites] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [steps, setSteps] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(() => {
    const saved = localStorage.getItem('vxi-site-filter');
    return saved || '';
  });
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRoomId, setBulkRoomId] = useState('');
  const [bulkStepId, setBulkStepId] = useState('');
  const [bulkStatus, setBulkStatus] = useState('called');
  const [allRooms, setAllRooms] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null); // { message, type: 'success'|'error'|'info' }
  const [showConfirm, setShowConfirm] = useState(null); // { message, onConfirm }
  const [editingName, setEditingName] = useState(null); // { id, name }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [form, setForm] = useState({
    candidate_name: '',
    site_id: '',
    room_id: '',
    step_id: '',
    status: 'waiting'
  });

  // Load all data
  const loadData = async () => {
    try {
      const [sitesData, stepsData] = await Promise.all([
        sitesAPI.getAll(),
        stepsAPI.getAll()
      ]);
      setSites(sitesData);
      setSteps(stepsData);

      // Set default filter to first site if not set
      if (sitesData.length > 0 && !filter) {
        const firstSiteId = sitesData[0].id.toString();
        setFilter(firstSiteId);
        setForm(f => ({ ...f, site_id: firstSiteId }));
      }
      if (stepsData.length > 0 && !form.step_id) {
        setForm(f => ({ ...f, step_id: stepsData[0].id }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const loadRooms = async (siteId) => {
    if (!siteId) return;
    try {
      const roomsData = await roomsAPI.getAll(siteId);
      setRooms(roomsData);
      if (roomsData.length > 0) {
        setForm(f => ({ ...f, room_id: roomsData[0].id }));
      }
    } catch (err) {
      console.error('Failed to load rooms:', err);
    }
  };

  const loadQueue = async () => {
    try {
      const queueData = await queueAPI.getAll(filter || null);
      setQueue(queueData);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Load voices for TTS
    window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    if (filter) {
      loadRooms(filter);
    }
  }, [filter]);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [filter]);

  // Tick every second for elapsed timers
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getElapsedSeconds = (timestamp) => {
    if (!timestamp) return 0;
    return Math.floor((now - new Date(timestamp + 'Z').getTime()) / 1000);
  };

  const getElapsedTime = (createdAt) => {
    const elapsed = getElapsedSeconds(createdAt);
    if (!createdAt) return '--:--';
    if (elapsed < 0) return '00:00';
    const hrs = Math.floor(elapsed / 3600);
    const mins = Math.floor((elapsed % 3600) / 60);
    const secs = elapsed % 60;
    const pad = (n) => n.toString().padStart(2, '0');
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  };

  const getWaitColor = (createdAt) => {
    const elapsed = getElapsedSeconds(createdAt);
    if (elapsed >= 3600) return 'text-red-400 border-red-500/50'; // 60+ min
    if (elapsed >= 1800) return 'text-amber-400 border-amber-500/50'; // 30+ min
    return 'text-vxi-white-400 border-vxi-white-300/20';
  };

  // Save filter to localStorage for cross-page persistence and sync with form
  useEffect(() => {
    localStorage.setItem('vxi-site-filter', filter);
    if (filter) {
      setForm(f => ({ ...f, site_id: filter, room_id: '' }));
    }
  }, [filter]);

  useEffect(() => {
    // Load rooms based on selected candidates' sites
    const loadRoomsForSelected = async () => {
      if (selectedCandidates.length > 0) {
        // Get unique site IDs from selected candidates
        const selectedItems = queue.filter(q => selectedCandidates.includes(q.id));
        const siteIds = [...new Set(selectedItems.map(item => item.site_id))];

        if (siteIds.length === 1) {
          // If all selected candidates are from the same site, load rooms for that site
          try {
            const roomsData = await roomsAPI.getAll(siteIds[0]);
            setAllRooms(roomsData);
          } catch (err) {
            console.error('Failed to load rooms:', err);
          }
        } else {
          // Multiple sites selected
          setAllRooms([]);
        }
      } else {
        setAllRooms([]);
      }
    };
    loadRoomsForSelected();
  }, [selectedCandidates, queue]);

  const addToQueue = async () => {
    if (!form.candidate_name.trim() || !form.site_id || !form.room_id || !form.step_id) {
      showToast('Please fill all fields', 'error');
      return;
    }
    try {
      await queueAPI.add(form);
      showToast(`${form.candidate_name} added to queue`, 'success');
      setForm(f => ({ ...f, candidate_name: '' }));
      loadQueue();
    } catch (err) {
      console.error('Failed to add to queue:', err);
      showToast('Failed to add candidate', 'error');
    }
  };

  const callCandidate = async (item) => {
    const announcement = `${item.candidate_name}, please proceed to ${item.room_number} for your ${item.step_name}.`;
    speak(announcement);
    try {
      await queueAPI.call(item.id);
      loadQueue();
    } catch (err) {
      console.error('Failed to call candidate:', err);
    }
  };

  const saveEditName = async () => {
    if (!editingName || !editingName.name.trim()) return;
    try {
      await queueAPI.updateName(editingName.id, editingName.name.trim());
      showToast('Name updated');
      setEditingName(null);
      loadQueue();
    } catch (err) {
      showToast('Failed to update name', 'error');
    }
  };

  const removeFromQueue = async (id) => {
    setShowConfirm({
      message: 'Remove this candidate from queue?',
      onConfirm: async () => {
        try {
          await queueAPI.remove(id);
          showToast('Candidate removed', 'info');
          loadQueue();
        } catch (err) {
          console.error('Failed to remove:', err);
          showToast('Failed to remove candidate', 'error');
        }
        setShowConfirm(null);
      }
    });
  };

  const handleBulkMove = async () => {
    if (selectedCandidates.length === 0) {
      showToast('Please select at least one candidate', 'error');
      return;
    }

    if (!bulkStepId) {
      showToast('Please select a step', 'error');
      return;
    }

    if (!bulkRoomId) {
      showToast('Please select a room', 'error');
      return;
    }

    try {
      const result = await queueAPI.bulkMove(selectedCandidates, bulkStepId, bulkRoomId, bulkStatus);

      // Announce all moved candidates together (only if status is not 'waiting')
      if (bulkStatus !== 'waiting' && result.candidates && result.candidates.length > 0) {
        const names = result.candidates.map(c => c.candidate_name).join(', ');
        const { room_number, step_name } = result.candidates[0];
        const announcement = `${names}, please proceed to ${room_number} for your ${step_name}.`;
        speak(announcement);
      }

      showToast(`${selectedCandidates.length} candidate(s) moved successfully`, 'success');
      setShowBulkModal(false);
      setBulkRoomId('');
      setBulkStepId('');
      setBulkStatus('called');
      setSelectedCandidates([]);
      loadQueue();
    } catch (err) {
      console.error('Failed to bulk move:', err);
      showToast('Failed to move candidates. Please try again.', 'error');
    }
  };

  const toggleCandidateSelection = (candidateId) => {
    setSelectedCandidates(prev =>
      prev.includes(candidateId)
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCandidates.length === filteredQueue.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(filteredQueue.map(item => item.id));
    }
  };

  const filteredQueue = queue
    .filter(q => !filter || q.site_id === parseInt(filter))
    .filter(q => !searchQuery || q.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-vxi-black-300 text-vxi-white">
      {/* Header */}
      <header className="bg-vxi-black-100 border-b border-vxi-black-50 px-4 sm:px-6 py-3 sm:py-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-vxi-orange-500 p-2 sm:p-2.5 rounded-xl shadow-lg">
              <Users className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-vxi-white">Queue Admin</h1>
              <p className="text-vxi-white-300 text-xs sm:text-sm hidden sm:block">VXI Talent Acquisition</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-3">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-vxi-black-50 border border-vxi-orange-500/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-vxi-orange-500 outline-none text-vxi-white font-medium"
            >
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
            <Link
              to="/settings"
              className="flex items-center gap-2 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 px-4 py-2.5 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95"
            >
              <Settings className="w-5 h-5 text-vxi-white-200" />
              <span className="text-vxi-white-200">Settings</span>
            </Link>
            <Link
              to="/live"
              className="flex items-center gap-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-4 py-2.5 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 shadow-lg"
            >
              <Monitor className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Live Queue</span>
            </Link>
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-vxi-black-50 border border-vxi-orange-500/50 rounded-lg px-2 py-2 text-xs focus:ring-2 focus:ring-vxi-orange-500 outline-none text-vxi-white font-medium"
            >
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 bg-vxi-black-50 rounded-lg border border-vxi-white-300/20"
            >
              <Menu className="w-5 h-5 text-vxi-white-200" />
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="md:hidden mt-3 pt-3 border-t border-vxi-white-300/10 flex gap-2 animate-slide-down">
            <Link
              to="/settings"
              className="flex-1 flex items-center justify-center gap-2 bg-vxi-black-50 border border-vxi-white-300/20 px-3 py-2.5 rounded-xl text-sm"
              onClick={() => setShowMobileMenu(false)}
            >
              <Settings className="w-4 h-4 text-vxi-white-200" />
              <span className="text-vxi-white-200">Settings</span>
            </Link>
            <Link
              to="/live"
              className="flex-1 flex items-center justify-center gap-2 bg-vxi-orange-500 px-3 py-2.5 rounded-xl text-sm"
              onClick={() => setShowMobileMenu(false)}
            >
              <Monitor className="w-4 h-4 text-white" />
              <span className="text-white font-medium">Live Queue</span>
            </Link>
          </div>
        )}
      </header>

      <div className="p-3 sm:p-6 max-w-7xl mx-auto">
        {/* Add to Queue Form */}
        <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-vxi-orange-500/20 shadow-xl">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-5 flex items-center gap-2 text-vxi-white">
            <div className="bg-vxi-orange-500/20 p-1.5 rounded-lg">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-vxi-orange-500" />
            </div>
            Add Candidate
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-xs sm:text-sm text-vxi-white-300 mb-1.5 sm:mb-2 font-medium">Candidate Name</label>
              <input
                type="text"
                value={form.candidate_name}
                onChange={e => setForm(f => ({ ...f, candidate_name: e.target.value }))}
                onKeyPress={e => e.key === 'Enter' && addToQueue()}
                placeholder="Enter full name"
                className="w-full bg-vxi-black-50 border border-vxi-white-300/20 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:ring-2 focus:ring-vxi-orange-500 focus:border-vxi-orange-500 outline-none transition-all text-vxi-white placeholder-vxi-white-400"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm text-vxi-white-300 mb-1.5 sm:mb-2 font-medium">Room</label>
              <select
                value={form.room_id}
                onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))}
                className="w-full bg-vxi-black-50 border border-vxi-white-300/20 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:ring-2 focus:ring-vxi-orange-500 focus:border-vxi-orange-500 outline-none transition-all text-vxi-white"
              >
                <option value="">Select Room</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>{room.room_number}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm text-vxi-white-300 mb-1.5 sm:mb-2 font-medium">Step</label>
              <select
                value={form.step_id}
                onChange={e => setForm(f => ({ ...f, step_id: e.target.value }))}
                className="w-full bg-vxi-black-50 border border-vxi-white-300/20 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:ring-2 focus:ring-vxi-orange-500 focus:border-vxi-orange-500 outline-none transition-all text-vxi-white"
              >
                <option value="">Select Step</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm text-vxi-white-300 mb-1.5 sm:mb-2 font-medium">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full bg-vxi-black-50 border border-vxi-white-300/20 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 text-sm focus:ring-2 focus:ring-vxi-orange-500 focus:border-vxi-orange-500 outline-none transition-all text-vxi-white"
              >
                <option value="waiting">Waiting</option>
                <option value="ongoing">Ongoing</option>
              </select>
            </div>
          </div>
          <button
            onClick={addToQueue}
            className="mt-4 sm:mt-5 w-full sm:w-auto bg-gradient-to-r from-vxi-orange-500 to-vxi-orange-600 hover:from-vxi-orange-600 hover:to-vxi-orange-700 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 shadow-lg shadow-vxi-orange-500/20 text-white"
          >
            <Plus className="w-5 h-5" />
            Add to Queue
          </button>
        </div>

        {/* Queue List */}
        <div className="glass-card rounded-xl sm:rounded-2xl border border-vxi-orange-500/20 shadow-xl overflow-hidden">
          <div className="p-3 sm:p-5 border-b border-vxi-white-300/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 text-vxi-white">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-vxi-orange-500" />
                Current Queue
                <span className="ml-2 bg-vxi-orange-500 text-white text-xs sm:text-sm px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-bold">
                  {filteredQueue.length}
                </span>
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-vxi-white-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="bg-vxi-black-50 border border-vxi-white-300/20 rounded-lg sm:rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-vxi-orange-500 focus:border-vxi-orange-500 outline-none text-vxi-white placeholder-vxi-white-400 w-32 sm:w-40"
                  />
                </div>
                {selectedCandidates.length > 0 && (
                  <button
                    onClick={() => {
                      // If 1 candidate selected, pre-fill with their current values
                      if (selectedCandidates.length === 1) {
                        const candidate = queue.find(q => q.id === selectedCandidates[0]);
                        if (candidate) {
                          setBulkStepId(candidate.step_id?.toString() || '');
                          setBulkRoomId(candidate.room_id?.toString() || '');
                          setBulkStatus(candidate.status || 'waiting');
                        }
                      } else {
                        setBulkStepId('');
                        setBulkRoomId('');
                        setBulkStatus('called');
                      }
                      setShowBulkModal(true);
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg text-white font-medium text-xs sm:text-sm"
                    title="Move selected candidates"
                  >
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden xs:inline">Move</span> ({selectedCandidates.length})
                  </button>
                )}
                {filteredQueue.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 px-3 py-2 rounded-lg sm:rounded-xl transition-all hover:scale-[1.02] active:scale-95 text-vxi-white-200 text-xs sm:text-sm"
                    title={selectedCandidates.length === filteredQueue.length ? "Deselect all" : "Select all"}
                  >
                    {selectedCandidates.length === filteredQueue.length ? 'Deselect' : 'Select All'}
                  </button>
                )}
                <button
                  onClick={loadQueue}
                  className="p-2 sm:p-2.5 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 rounded-lg sm:rounded-xl transition-all hover:scale-[1.02] active:scale-95"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-vxi-white-200" />
                </button>
              </div>
            </div>
          </div>

          {/* Step summary counts */}
          {filteredQueue.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 py-2 bg-vxi-black-200/50 border-b border-vxi-white-300/10">
              {steps.filter(s => s.is_active).map(step => {
                const count = filteredQueue.filter(q => q.step_id === step.id).length;
                if (count === 0) return null;
                return (
                  <span key={step.id} className="inline-flex items-center gap-1.5 text-xs bg-vxi-black-50 px-2.5 py-1 rounded-full border border-vxi-white-300/10">
                    <span className="text-vxi-orange-400 font-semibold">{count}</span>
                    <span className="text-vxi-white-300">{step.name}</span>
                  </span>
                );
              })}
            </div>
          )}

          <div className="divide-y divide-vxi-white-300/10 max-h-[60vh] sm:max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-8 sm:p-12 text-center text-vxi-white-400">
                <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-vxi-orange-500/50" />
                <p>Loading queue...</p>
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="p-8 sm:p-12 text-center animate-fade-in">
                <div className="bg-vxi-orange-500/10 w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full flex items-center justify-center mb-4">
                  <Users className="w-10 h-10 sm:w-12 sm:h-12 text-vxi-orange-500/40" />
                </div>
                <p className="text-vxi-white-400 text-base sm:text-lg font-medium">No candidates in queue</p>
                <p className="text-vxi-white-400/60 text-xs sm:text-sm mt-1">Add a candidate above to get started</p>
              </div>
            ) : (
              filteredQueue.map(item => (
                <div
                  key={item.id}
                  className={`p-3 sm:p-5 hover:bg-vxi-black-50 transition-all ${
                    item.status === 'called'
                      ? 'bg-green-500/10 border-l-4 border-green-500'
                      : item.status === 'ongoing'
                      ? 'bg-blue-500/10 border-l-4 border-blue-500'
                      : ''
                  } ${selectedCandidates.includes(item.id) ? 'bg-vxi-orange-500/5 border-l-4 border-vxi-orange-400' : ''}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-5">
                      <input
                        type="checkbox"
                        checked={selectedCandidates.includes(item.id)}
                        onChange={() => toggleCandidateSelection(item.id)}
                        className="w-5 h-5 mt-1 sm:mt-0 rounded border-2 border-vxi-orange-500 bg-vxi-black-50 text-vxi-orange-500 focus:ring-2 focus:ring-vxi-orange-500 cursor-pointer flex-shrink-0"
                      />
                      <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full mt-1.5 sm:mt-0 flex-shrink-0 ${
                        item.status === 'called'
                          ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50'
                          : item.status === 'ongoing'
                          ? 'bg-blue-500 shadow-lg shadow-blue-500/50'
                          : 'bg-yellow-500'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {editingName?.id === item.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                value={editingName.name}
                                onChange={e => setEditingName({ ...editingName, name: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') saveEditName(); if (e.key === 'Escape') setEditingName(null); }}
                                className="bg-vxi-black-50 border border-vxi-orange-500 rounded px-2 py-0.5 text-base sm:text-xl text-vxi-white font-bold focus:outline-none focus:ring-1 focus:ring-vxi-orange-500 w-48"
                              />
                              <button onClick={saveEditName} className="text-green-400 hover:text-green-300 p-1"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingName(null)} className="text-vxi-white-400 hover:text-red-400 p-1"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <p className="font-bold text-base sm:text-xl text-vxi-white truncate">{item.candidate_name}</p>
                              <button onClick={() => setEditingName({ id: item.id, name: item.candidate_name })} className="opacity-0 group-hover:opacity-100 text-vxi-white-400 hover:text-vxi-orange-500 p-1 transition-opacity"><Pencil className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            item.status === 'called'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                              : item.status === 'ongoing'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                              : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                          }`}>
                            {item.status === 'called' ? 'Called' : item.status === 'ongoing' ? 'Ongoing' : 'Waiting'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-vxi-white-300">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-vxi-orange-500" />
                            {item.site_name}
                          </span>
                          <span className="bg-vxi-black-50 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg border border-vxi-white-300/20 text-xs">
                            {item.room_number}
                          </span>
                          <span className="text-vxi-orange-400 font-medium truncate">{item.step_name}</span>
                          <span className={`flex items-center gap-1 font-mono text-xs bg-vxi-black-50 px-2 py-0.5 rounded-lg border ${getWaitColor(item.created_at)}`} title="Overall time">
                            <Timer className="w-3 h-3" />
                            {getElapsedTime(item.created_at)}
                          </span>
                          <span className="flex items-center gap-1 font-mono text-xs bg-vxi-black-50 px-2 py-0.5 rounded-lg border border-vxi-orange-500/30" title="Current step time">
                            <Timer className="w-3 h-3 text-vxi-orange-500" />
                            {getElapsedTime(item.status_changed_at || item.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-8 sm:ml-0">
                      {(item.status === 'waiting' || item.status === 'ongoing') && (
                        <button
                          onClick={() => callCandidate(item)}
                          className="flex items-center gap-1.5 sm:gap-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all font-semibold hover:scale-[1.02] active:scale-95 shadow-lg text-white text-sm"
                        >
                          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          Call
                        </button>
                      )}
                      {item.status === 'called' && (
                        <button
                          onClick={() => callCandidate(item)}
                          className="flex items-center gap-1.5 sm:gap-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all font-semibold hover:scale-[1.02] active:scale-95 shadow-lg text-white text-sm"
                        >
                          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span className="hidden xs:inline">Call Again</span>
                          <span className="xs:hidden">Again</span>
                          {item.call_count > 0 && ` (${item.call_count}x)`}
                        </button>
                      )}
                      <button
                        onClick={() => removeFromQueue(item.id)}
                        className="flex items-center gap-2 bg-vxi-black-50/50 hover:bg-red-600 text-vxi-white-300 hover:text-white p-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl transition-all border border-vxi-white-300/20 hover:border-red-600"
                      >
                        <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bulk Move Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
          <div className="bg-vxi-black-100 rounded-xl sm:rounded-2xl border-2 border-vxi-orange-500 shadow-2xl shadow-vxi-orange-500/10 max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <h3 className="text-xl sm:text-2xl font-bold text-vxi-white flex items-center gap-2">
                <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7 text-vxi-orange-500" />
                Move Candidates
              </h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-2 hover:bg-vxi-black-50 rounded-lg transition-all"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-vxi-white-300" />
              </button>
            </div>

            <p className="text-vxi-white-200 mb-4 sm:mb-6 text-sm sm:text-base">
              Moving <span className="text-vxi-orange-500 font-bold">{selectedCandidates.length}</span> candidate(s) to a new step and room.
            </p>

            <div className="mb-4">
              <label className="block text-xs sm:text-sm text-vxi-white-300 mb-2 font-medium">
                Select Target Step
              </label>
              <select
                value={bulkStepId}
                onChange={e => setBulkStepId(e.target.value)}
                className="w-full bg-vxi-black-50 border-2 border-vxi-orange-500/50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
              >
                <option value="">Choose a step...</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>
                    {step.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs sm:text-sm text-vxi-white-300 mb-2 font-medium">
                Select Target Room
              </label>
              <select
                value={bulkRoomId}
                onChange={e => setBulkRoomId(e.target.value)}
                className="w-full bg-vxi-black-50 border-2 border-vxi-orange-500/50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
              >
                <option value="">Choose a room...</option>
                {allRooms.length > 0 ? (
                  allRooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.room_number} - {room.description || 'Interview Room'}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    {selectedCandidates.length === 0
                      ? 'Select candidates first'
                      : queue.filter(q => selectedCandidates.includes(q.id)).map(q => q.site_id).filter((v, i, a) => a.indexOf(v) === i).length > 1
                      ? 'Selected candidates are from different sites'
                      : 'No rooms available'}
                  </option>
                )}
              </select>
              {selectedCandidates.length > 0 && allRooms.length === 0 && (
                <p className="text-vxi-orange-400 text-xs sm:text-sm mt-2">
                  {queue.filter(q => selectedCandidates.includes(q.id)).map(q => q.site_id).filter((v, i, a) => a.indexOf(v) === i).length > 1
                    ? 'Please select candidates from the same site only.'
                    : 'No rooms available for this site.'}
                </p>
              )}
            </div>

            <div className="mb-4 sm:mb-6">
              <label className="block text-xs sm:text-sm text-vxi-white-300 mb-2 font-medium">
                Select Status
              </label>
              <select
                value={bulkStatus}
                onChange={e => setBulkStatus(e.target.value)}
                className="w-full bg-vxi-black-50 border-2 border-vxi-orange-500/50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
              >
                <option value="waiting">Waiting</option>
                <option value="ongoing">Ongoing</option>
                <option value="called">Called</option>
              </select>
              {bulkStatus === 'waiting' && (
                <p className="text-vxi-white-400 text-xs sm:text-sm mt-2">
                  TTS announcement will be skipped for waiting status.
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={handleBulkMove}
                disabled={!bulkRoomId || !bulkStepId}
                className="flex-1 bg-gradient-to-r from-vxi-orange-500 to-vxi-orange-600 hover:from-vxi-orange-600 hover:to-vxi-orange-700 disabled:from-vxi-black-50 disabled:to-vxi-black-50 disabled:text-vxi-white-400 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-vxi-orange-500/20 text-white flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <ArrowRight className="w-5 h-5" />
                Confirm Move
              </button>
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkRoomId('');
                  setBulkStepId('');
                  setBulkStatus('called');
                }}
                className="px-6 py-3 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 rounded-xl transition-all text-vxi-white-200 text-sm sm:text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in">
          <div className="bg-vxi-black-100 rounded-2xl border-2 border-vxi-white-300/20 shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-vxi-orange-500/20 p-2 rounded-full">
                <AlertCircle className="w-6 h-6 text-vxi-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-vxi-white">Confirm Action</h3>
            </div>
            <p className="text-vxi-white-300 mb-6">{showConfirm.message}</p>
            <div className="flex gap-3">
              <button
                onClick={showConfirm.onConfirm}
                className="flex-1 bg-gradient-to-r from-vxi-orange-500 to-vxi-orange-600 hover:from-vxi-orange-600 hover:to-vxi-orange-700 px-4 py-2.5 rounded-xl font-semibold text-white transition-all active:scale-95"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 px-4 py-2.5 rounded-xl text-vxi-white-200 transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[70] toast-enter">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-md ${
            toast.type === 'success'
              ? 'bg-green-500/20 border-green-500/50 text-green-400'
              : toast.type === 'error'
              ? 'bg-red-500/20 border-red-500/50 text-red-400'
              : 'bg-blue-500/20 border-blue-500/50 text-blue-400'
          }`}>
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> :
             toast.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> :
             <Info className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
