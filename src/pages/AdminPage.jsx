import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Volume2, Plus, Trash2, Monitor, Settings, Users, MapPin,
  RefreshCw, Clock, ArrowRight, X, Menu, Search
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
      alert('Please fill all fields');
      return;
    }
    try {
      await queueAPI.add(form);
      setForm(f => ({ ...f, candidate_name: '' }));
      loadQueue();
    } catch (err) {
      console.error('Failed to add to queue:', err);
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

  const removeFromQueue = async (id) => {
    if (!confirm('Remove this candidate from queue?')) return;
    try {
      await queueAPI.remove(id);
      loadQueue();
    } catch (err) {
      console.error('Failed to remove:', err);
    }
  };

  const handleBulkMove = async () => {
    if (selectedCandidates.length === 0) {
      alert('Please select at least one candidate');
      return;
    }

    if (!bulkStepId) {
      alert('Please select a step');
      return;
    }

    if (!bulkRoomId) {
      alert('Please select a room');
      return;
    }

    const count = selectedCandidates.length;
    if (!confirm(`Move ${count} selected candidate(s) to the selected step and room?`)) {
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

      setShowBulkModal(false);
      setBulkRoomId('');
      setBulkStepId('');
      setBulkStatus('called');
      setSelectedCandidates([]);
      loadQueue();
    } catch (err) {
      console.error('Failed to bulk move:', err);
      alert('Failed to move candidates. Please try again.');
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
              className="flex items-center gap-2 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 px-4 py-2.5 rounded-xl transition-all duration-200 hover:scale-105"
            >
              <Settings className="w-5 h-5 text-vxi-white-200" />
              <span className="text-vxi-white-200">Settings</span>
            </Link>
            <Link
              to="/live"
              className="flex items-center gap-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-4 py-2.5 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
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
          <div className="md:hidden mt-3 pt-3 border-t border-vxi-white-300/10 flex gap-2">
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
        <div className="bg-vxi-black-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 border border-vxi-orange-500/30 shadow-xl">
          <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-5 flex items-center gap-2 text-vxi-white">
            <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-vxi-orange-500" />
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
                  <option key={room.id} value={room.id}>Room {room.room_number}</option>
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
            className="mt-4 sm:mt-5 w-full sm:w-auto bg-vxi-orange-500 hover:bg-vxi-orange-600 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 hover:scale-105 shadow-lg text-white"
          >
            <Plus className="w-5 h-5" />
            Add to Queue
          </button>
        </div>

        {/* Queue List */}
        <div className="bg-vxi-black-100 rounded-xl sm:rounded-2xl border border-vxi-orange-500/30 shadow-xl overflow-hidden">
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
                    className="flex items-center gap-1.5 sm:gap-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all hover:scale-105 shadow-lg text-white font-medium text-xs sm:text-sm"
                    title="Move selected candidates"
                  >
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden xs:inline">Move</span> ({selectedCandidates.length})
                  </button>
                )}
                {filteredQueue.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 px-3 py-2 rounded-lg sm:rounded-xl transition-all hover:scale-105 text-vxi-white-200 text-xs sm:text-sm"
                    title={selectedCandidates.length === filteredQueue.length ? "Deselect all" : "Select all"}
                  >
                    {selectedCandidates.length === filteredQueue.length ? 'Deselect' : 'Select All'}
                  </button>
                )}
                <button
                  onClick={loadQueue}
                  className="p-2 sm:p-2.5 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 rounded-lg sm:rounded-xl transition-all hover:scale-105"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-vxi-white-200" />
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-vxi-white-300/10 max-h-[60vh] sm:max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-8 sm:p-12 text-center text-vxi-white-400">Loading...</div>
            ) : filteredQueue.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <Users className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-vxi-white-400 mb-3 opacity-50" />
                <p className="text-vxi-white-400 text-base sm:text-lg">No candidates in queue</p>
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
                          <p className="font-bold text-base sm:text-xl text-vxi-white truncate">{item.candidate_name}</p>
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
                            Room {item.room_number}
                          </span>
                          <span className="text-vxi-orange-400 font-medium truncate">{item.step_name}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-8 sm:ml-0">
                      {(item.status === 'waiting' || item.status === 'ongoing') && (
                        <button
                          onClick={() => callCandidate(item)}
                          className="flex items-center gap-1.5 sm:gap-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all font-semibold hover:scale-105 shadow-lg text-white text-sm"
                        >
                          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                          Call
                        </button>
                      )}
                      {item.status === 'called' && (
                        <button
                          onClick={() => callCandidate(item)}
                          className="flex items-center gap-1.5 sm:gap-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all font-semibold hover:scale-105 shadow-lg text-white text-sm"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-vxi-black-100 rounded-xl sm:rounded-2xl border-2 border-vxi-orange-500 shadow-2xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
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
                      Room {room.room_number} - {room.description || 'Interview Room'}
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
                className="flex-1 bg-vxi-orange-500 hover:bg-vxi-orange-600 disabled:bg-vxi-black-50 disabled:text-vxi-white-400 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-lg text-white flex items-center justify-center gap-2 text-sm sm:text-base"
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
    </div>
  );
}
