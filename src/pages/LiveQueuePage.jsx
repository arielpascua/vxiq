import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Settings, Bell, ChevronRight } from 'lucide-react';
import { sitesAPI, queueAPI } from '../api';

export default function LiveQueuePage() {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [queue, setQueue] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [flashId, setFlashId] = useState(null);
  const [lastCalledIds, setLastCalledIds] = useState(new Set());

  // Load sites
  useEffect(() => {
    const loadSites = async () => {
      try {
        const sitesData = await sitesAPI.getAll();
        setSites(sitesData);
        if (sitesData.length > 0 && !selectedSite) {
          setSelectedSite(sitesData[0].id.toString());
        }
      } catch (err) {
        console.error('Failed to load sites:', err);
      }
    };
    loadSites();
  }, []);

  // Load queue
  useEffect(() => {
    const loadQueue = async () => {
      if (!selectedSite) return;
      try {
        const queueData = await queueAPI.getAll(selectedSite);

        // Check for newly called candidates
        const currentCalledIds = new Set(
          queueData.filter(q => q.status === 'called').map(q => q.id)
        );

        // Find new calls (in current but not in last)
        currentCalledIds.forEach(id => {
          if (!lastCalledIds.has(id)) {
            setFlashId(id);
            setTimeout(() => setFlashId(null), 5000);
          }
        });

        setLastCalledIds(currentCalledIds);
        setQueue(queueData);
      } catch (err) {
        console.error('Failed to load queue:', err);
      }
    };

    loadQueue();
    const interval = setInterval(loadQueue, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [selectedSite, lastCalledIds]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const calledQueue = queue.filter(q => q.status === 'called');
  const waitingQueue = queue.filter(q => q.status === 'waiting');

  return (
    <div className="min-h-screen bg-gradient-to-br from-vxi-black-300 via-vxi-black-200 to-vxi-black-300 text-vxi-white">
      {/* Header */}
      <header className="bg-vxi-black-100/80 backdrop-blur-md border-b border-vxi-orange-500/30 px-8 py-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="bg-gradient-to-br from-vxi-orange-500 to-vxi-orange-600 p-4 rounded-2xl shadow-xl">
              <Users className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-vxi-white">Applicant Queue</h1>
              <p className="text-vxi-white-300 text-lg">VXI Talent Acquisition</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <select
              value={selectedSite}
              onChange={e => setSelectedSite(e.target.value)}
              className="bg-vxi-black-50 border-2 border-vxi-orange-500/50 rounded-2xl px-5 py-3 text-xl font-semibold focus:ring-4 focus:ring-vxi-orange-500/50 outline-none text-vxi-white hover:bg-vxi-black-400 transition-all"
            >
              {sites.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>

            <div className="text-right bg-vxi-black-50 px-6 py-3 rounded-2xl border border-vxi-orange-500/30">
              <p className="text-5xl font-mono font-bold text-vxi-orange-500">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-vxi-white-300 font-medium">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <Link
              to="/admin"
              className="bg-vxi-black-50 hover:bg-vxi-orange-500 border border-vxi-white-300/20 hover:border-vxi-orange-500 p-4 rounded-2xl transition-all hover:scale-110 shadow-lg"
              title="Admin Panel"
            >
              <Settings className="w-7 h-7 text-vxi-white-200 hover:text-white" />
            </Link>
          </div>
        </div>
      </header>

      <div className="p-8 pb-24">
        {/* Now Calling Section */}
        {calledQueue.length > 0 && (
          <div className="mb-10">
            <h2 className="text-3xl font-bold text-vxi-orange-500 mb-6 flex items-center gap-3 animate-pulse">
              <Bell className="w-8 h-8 animate-bounce" />
              NOW CALLING
            </h2>
            <div className="grid gap-5">
              {calledQueue.slice(0, 4).map(item => (
                <div
                  key={item.id}
                  className={`bg-gradient-to-r from-vxi-orange-500/20 to-vxi-orange-600/5 border-4 border-vxi-orange-500 rounded-3xl p-8 transition-all duration-500 shadow-2xl ${
                    flashId === item.id ? 'animate-pulse ring-8 ring-vxi-orange-400/50 scale-105' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                      <div className="bg-gradient-to-br from-vxi-orange-500 to-vxi-orange-700 text-white font-black text-5xl w-32 h-32 rounded-2xl flex items-center justify-center shadow-2xl border-4 border-white/20">
                        {item.room_number}
                      </div>
                      <div>
                        <p className="text-5xl font-black mb-2 text-vxi-white tracking-tight">{item.candidate_name}</p>
                        <p className="text-2xl text-vxi-orange-400 font-semibold">{item.step_name}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-16 h-16 text-vxi-orange-500 animate-pulse" strokeWidth={3} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Waiting Queue */}
        <div>
          <h2 className="text-3xl font-bold text-vxi-white-200 mb-6 flex items-center gap-3">
            <Users className="w-8 h-8 text-vxi-orange-500" />
            WAITING
            <span className="bg-vxi-orange-500 text-white text-xl px-4 py-1 rounded-full font-bold ml-2">
              {waitingQueue.length}
            </span>
          </h2>

          {waitingQueue.length === 0 ? (
            <div className="bg-vxi-black-100/50 backdrop-blur-sm rounded-3xl p-16 text-center border-2 border-vxi-white-300/20">
              <Users className="w-24 h-24 mx-auto text-vxi-white-400/30 mb-5" />
              <p className="text-3xl text-vxi-white-400 font-semibold">No applicants waiting</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {waitingQueue.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-vxi-black-100/70 backdrop-blur-sm border-2 border-vxi-white-300/20 rounded-2xl p-6 flex items-center gap-5 hover:bg-vxi-black-50 hover:border-vxi-orange-500/50 transition-all shadow-lg hover:shadow-2xl hover:scale-105"
                >
                  <div className="bg-gradient-to-br from-vxi-orange-500 to-vxi-orange-600 text-white font-bold text-2xl w-16 h-16 rounded-xl flex items-center justify-center shadow-lg">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold truncate text-vxi-white">{item.candidate_name}</p>
                    <div className="flex items-center gap-3 text-vxi-white-300 mt-2">
                      <span className="bg-vxi-black-50 border border-vxi-orange-500/30 px-4 py-1.5 rounded-xl text-sm font-semibold">
                        Room {item.room_number}
                      </span>
                      <span className="text-vxi-orange-400 text-sm font-medium truncate">{item.step_name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-vxi-black-100/90 backdrop-blur-md border-t-2 border-vxi-orange-500/30 px-8 py-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-xl text-vxi-white-200 flex items-center gap-3">
            <Bell className="w-6 h-6 text-vxi-orange-500 animate-bounce-slow" />
            Please listen for your name announcement
          </p>
          <p className="font-bold text-vxi-orange-500 text-2xl">
            {sites.find(s => s.id.toString() === selectedSite)?.name || ''} Site
          </p>
        </div>
      </footer>
    </div>
  );
}
