import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Volume2, Plus, Trash2, Monitor, Settings, Users, MapPin,
  RefreshCw, Clock, ArrowRight, X
} from 'lucide-react';
import { sitesAPI, roomsAPI, stepsAPI, queueAPI, speak } from '../api';

export default function AdminPage() {
  const [sites, setSites] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [steps, setSteps] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRoomId, setBulkRoomId] = useState('');
  const [bulkStepId, setBulkStepId] = useState('');
  const [allRooms, setAllRooms] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState([]);

  const [form, setForm] = useState({
    candidate_name: '',
    site_id: '',
    room_id: '',
    step_id: ''
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

      if (sitesData.length > 0 && !form.site_id) {
        setForm(f => ({ ...f, site_id: sitesData[0].id }));
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
    if (form.site_id) {
      loadRooms(form.site_id);
    }
  }, [form.site_id]);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
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
    const announcement = `${item.candidate_name}, please proceed to Room ${item.room_number} for your ${item.step_name}.`;
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
      const result = await queueAPI.bulkMove(selectedCandidates, bulkStepId, bulkRoomId);
      alert(result.message || `Successfully moved ${result.updated} candidate(s)`);
      setShowBulkModal(false);
      setBulkRoomId('');
      setBulkStepId('');
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

  const filteredQueue = filter
    ? queue.filter(q => q.site_id === parseInt(filter))
    : queue;

  return (
    <div className="min-h-screen bg-vxi-black-300 text-vxi-white">
      {/* Header */}
      <header className="bg-vxi-black-100 border-b border-vxi-black-50 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-vxi-orange-500 p-2.5 rounded-xl shadow-lg">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-vxi-white">Queue Admin</h1>
              <p className="text-vxi-white-300 text-sm">VXI Talent Acquisition</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Add to Queue Form */}
        <div className="bg-vxi-black-100 rounded-2xl p-6 mb-6 border border-vxi-orange-500/30 shadow-xl">
          <h2 className="text-xl font-semibold mb-5 flex items-center gap-2 text-vxi-white">
            <Plus className="w-6 h-6 text-vxi-orange-500" />
            Add Candidate to Queue
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-vxi-white-300 mb-2 font-medium">Site</label>
              <select
                value={form.site_id}
                onChange={e => setForm(f => ({ ...f, site_id: e.target.value, room_id: '' }))}
                className="w-full bg-vxi-black-50 border border-vxi-white-300/20 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-vxi-orange-500 focus:border-vxi-orange-500 outline-none transition-all text-vxi-white"
              >
                <option value="">Select Site</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-vxi-white-300 mb-2 font-medium">Candidate Name</label>
              <input
                type="text"
                value={form.candidate_name}
                onChange={e => setForm(f => ({ ...f, candidate_name: e.target.value }))}
                onKeyPress={e => e.key === 'Enter' && addToQueue()}
                placeholder="Enter full name"
                className="w-full bg-vxi-black-50 border border-vxi-white-300/20 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-vxi-orange-500 focus:border-vxi-orange-500 outline-none transition-all text-vxi-white placeholder-vxi-white-400"
              />
            </div>
            <div>
              <label className="block text-sm text-vxi-white-300 mb-2 font-medium">Room</label>
              <select
                value={form.room_id}
                onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))}
                className="w-full bg-vxi-black-50 border border-vxi-white-300/20 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-vxi-orange-500 focus:border-vxi-orange-500 outline-none transition-all text-vxi-white"
              >
                <option value="">Select Room</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>Room {room.room_number}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-vxi-white-300 mb-2 font-medium">Step</label>
              <select
                value={form.step_id}
                onChange={e => setForm(f => ({ ...f, step_id: e.target.value }))}
                className="w-full bg-vxi-black-50 border border-vxi-white-300/20 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-vxi-orange-500 focus:border-vxi-orange-500 outline-none transition-all text-vxi-white"
              >
                <option value="">Select Step</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={addToQueue}
            className="mt-5 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 hover:scale-105 shadow-lg text-white"
          >
            <Plus className="w-5 h-5" />
            Add to Queue
          </button>
        </div>

        {/* Queue List */}
        <div className="bg-vxi-black-100 rounded-2xl border border-vxi-orange-500/30 shadow-xl overflow-hidden">
          <div className="p-5 border-b border-vxi-white-300/10 flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-vxi-white">
              <Clock className="w-6 h-6 text-vxi-orange-500" />
              Current Queue
              <span className="ml-2 bg-vxi-orange-500 text-white text-sm px-3 py-1 rounded-full font-bold">
                {filteredQueue.length}
              </span>
            </h2>
            <div className="flex items-center gap-3">
              {selectedCandidates.length > 0 && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="flex items-center gap-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-4 py-2 rounded-xl transition-all hover:scale-105 shadow-lg text-white font-medium"
                  title="Move selected candidates"
                >
                  <ArrowRight className="w-5 h-5" />
                  Move Selected ({selectedCandidates.length})
                </button>
              )}
              {filteredQueue.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 px-4 py-2 rounded-xl transition-all hover:scale-105 text-vxi-white-200"
                  title={selectedCandidates.length === filteredQueue.length ? "Deselect all" : "Select all"}
                >
                  {selectedCandidates.length === filteredQueue.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
              <button
                onClick={loadQueue}
                className="p-2.5 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 rounded-xl transition-all hover:scale-105"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5 text-vxi-white-200" />
              </button>
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="bg-vxi-black-50 border border-vxi-white-300/20 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-vxi-orange-500 outline-none text-vxi-white"
              >
                <option value="">All Sites</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="divide-y divide-vxi-white-300/10 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-12 text-center text-vxi-white-400">Loading...</div>
            ) : filteredQueue.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 mx-auto text-vxi-white-400 mb-3 opacity-50" />
                <p className="text-vxi-white-400 text-lg">No candidates in queue</p>
              </div>
            ) : (
              filteredQueue.map(item => (
                <div
                  key={item.id}
                  className={`p-5 flex items-center justify-between hover:bg-vxi-black-50 transition-all ${
                    item.status === 'called' ? 'bg-vxi-orange-500/10 border-l-4 border-vxi-orange-500' : ''
                  } ${selectedCandidates.includes(item.id) ? 'bg-vxi-orange-500/5 border-l-4 border-vxi-orange-400' : ''}`}
                >
                  <div className="flex items-center gap-5">
                    <input
                      type="checkbox"
                      checked={selectedCandidates.includes(item.id)}
                      onChange={() => toggleCandidateSelection(item.id)}
                      className="w-5 h-5 rounded border-2 border-vxi-orange-500 bg-vxi-black-50 text-vxi-orange-500 focus:ring-2 focus:ring-vxi-orange-500 cursor-pointer"
                    />
                    <div className={`w-4 h-4 rounded-full ${
                      item.status === 'called' ? 'bg-vxi-orange-500 animate-pulse shadow-lg shadow-vxi-orange-500/50' : 'bg-vxi-white-200'
                    }`} />
                    <div>
                      <p className="font-bold text-xl text-vxi-white mb-1">{item.candidate_name}</p>
                      <div className="flex items-center gap-4 text-sm text-vxi-white-300">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-vxi-orange-500" />
                          {item.site_name}
                        </span>
                        <span className="bg-vxi-black-50 px-3 py-1 rounded-lg border border-vxi-white-300/20">
                          Room {item.room_number}
                        </span>
                        <span className="text-vxi-orange-400 font-medium">{item.step_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'waiting' && (
                      <button
                        onClick={() => callCandidate(item)}
                        className="flex items-center gap-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-5 py-2.5 rounded-xl transition-all font-semibold hover:scale-105 shadow-lg text-white"
                      >
                        <Volume2 className="w-5 h-5" />
                        Call
                      </button>
                    )}
                    {item.status === 'called' && (
                      <button
                        onClick={() => callCandidate(item)}
                        className="flex items-center gap-2 bg-vxi-orange-500 hover:bg-vxi-orange-600 px-5 py-2.5 rounded-xl transition-all font-semibold hover:scale-105 shadow-lg text-white"
                      >
                        <Volume2 className="w-5 h-5" />
                        Call Again
                      </button>
                    )}
                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="flex items-center gap-2 bg-vxi-black-50/50 hover:bg-red-600 text-vxi-white-300 hover:text-white px-4 py-2.5 rounded-xl transition-all border border-vxi-white-300/20 hover:border-red-600"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bulk Move Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-vxi-black-100 rounded-2xl border-2 border-vxi-orange-500 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-2xl font-bold text-vxi-white flex items-center gap-2">
                <ArrowRight className="w-7 h-7 text-vxi-orange-500" />
                Move Selected Candidates
              </h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-2 hover:bg-vxi-black-50 rounded-lg transition-all"
              >
                <X className="w-6 h-6 text-vxi-white-300" />
              </button>
            </div>

            <p className="text-vxi-white-200 mb-6">
              Moving <span className="text-vxi-orange-500 font-bold">{selectedCandidates.length}</span> selected candidate(s) to a new step and room.
            </p>

            <div className="mb-4">
              <label className="block text-sm text-vxi-white-300 mb-2 font-medium">
                Select Target Step
              </label>
              <select
                value={bulkStepId}
                onChange={e => setBulkStepId(e.target.value)}
                className="w-full bg-vxi-black-50 border-2 border-vxi-orange-500/50 rounded-xl px-4 py-3 text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
              >
                <option value="">Choose a step...</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>
                    {step.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-vxi-white-300 mb-2 font-medium">
                Select Target Room
              </label>
              <select
                value={bulkRoomId}
                onChange={e => setBulkRoomId(e.target.value)}
                className="w-full bg-vxi-black-50 border-2 border-vxi-orange-500/50 rounded-xl px-4 py-3 text-vxi-white focus:ring-2 focus:ring-vxi-orange-500 outline-none"
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
                <p className="text-vxi-orange-400 text-sm mt-2">
                  {queue.filter(q => selectedCandidates.includes(q.id)).map(q => q.site_id).filter((v, i, a) => a.indexOf(v) === i).length > 1
                    ? 'Please select candidates from the same site only.'
                    : 'No rooms available for this site.'}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleBulkMove}
                disabled={!bulkRoomId || !bulkStepId}
                className="flex-1 bg-vxi-orange-500 hover:bg-vxi-orange-600 disabled:bg-vxi-black-50 disabled:text-vxi-white-400 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-lg text-white flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-5 h-5" />
                Confirm Move
              </button>
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkRoomId('');
                  setBulkStepId('');
                }}
                className="px-6 py-3 bg-vxi-black-50 hover:bg-vxi-black-400 border border-vxi-white-300/20 rounded-xl transition-all text-vxi-white-200"
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
