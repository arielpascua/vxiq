import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Settings, Bell, ChevronRight } from 'lucide-react';
import { sitesAPI, queueAPI } from '../api';

export default function LiveQueuePage() {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(() => {
    return localStorage.getItem('vxi-site-filter') || '';
  });
  const [queue, setQueue] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [flashId, setFlashId] = useState(null);
  const [lastCalledIds, setLastCalledIds] = useState(new Set());

  // Load sites and listen for filter changes from admin page
  useEffect(() => {
    const loadSites = async () => {
      try {
        const sitesData = await sitesAPI.getAll();
        setSites(sitesData);
        // If no filter is set, default to first site
        const storedFilter = localStorage.getItem('vxi-site-filter');
        if (sitesData.length > 0 && !storedFilter) {
          setSelectedSite(sitesData[0].id.toString());
        }
      } catch (err) {
        console.error('Failed to load sites:', err);
      }
    };
    loadSites();

    // Listen for localStorage changes from admin page
    const handleStorageChange = (e) => {
      if (e.key === 'vxi-site-filter') {
        setSelectedSite(e.newValue || '');
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Also poll localStorage for same-tab updates
    const checkFilter = setInterval(() => {
      const currentFilter = localStorage.getItem('vxi-site-filter') || '';
      setSelectedSite(prev => prev !== currentFilter ? currentFilter : prev);
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkFilter);
    };
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
      <header className="bg-vxi-black-100/80 backdrop-blur-md border-b border-vxi-orange-500/30 px-4 sm:px-8 py-3 sm:py-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="bg-gradient-to-br from-vxi-orange-500 to-vxi-orange-600 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl">
              <Users className="w-6 h-6 sm:w-10 sm:h-10 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-4xl font-bold text-vxi-white">Applicant Queue</h1>
              <p className="text-vxi-white-300 text-xs sm:text-lg hidden sm:block">VXI Talent Acquisition</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-6">
            <div className="bg-vxi-orange-500/20 border sm:border-2 border-vxi-orange-500 rounded-lg sm:rounded-2xl px-2 sm:px-6 py-1.5 sm:py-3">
              <p className="text-sm sm:text-2xl font-bold text-vxi-orange-500">
                {sites.find(s => s.id.toString() === selectedSite)?.name || 'All Sites'}
              </p>
            </div>

            <div className="hidden sm:block text-right bg-vxi-black-50 px-6 py-3 rounded-2xl border border-vxi-orange-500/30">
              <p className="text-5xl font-mono font-bold text-vxi-orange-500">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-vxi-white-300 font-medium">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Mobile time */}
            <div className="sm:hidden text-right bg-vxi-black-50 px-2 py-1.5 rounded-lg border border-vxi-orange-500/30">
              <p className="text-lg font-mono font-bold text-vxi-orange-500">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <Link
              to="/admin"
              className="bg-vxi-black-50 hover:bg-vxi-orange-500 border border-vxi-white-300/20 hover:border-vxi-orange-500 p-2 sm:p-4 rounded-lg sm:rounded-2xl transition-all hover:scale-110 shadow-lg"
              title="Admin Panel"
            >
              <Settings className="w-5 h-5 sm:w-7 sm:h-7 text-vxi-white-200 hover:text-white" />
            </Link>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-8 pb-24 sm:pb-24">
        {/* Now Calling Section */}
        {calledQueue.length > 0 && (
          <div className="mb-6 sm:mb-10">
            <h2 className="text-xl sm:text-3xl font-bold text-vxi-orange-500 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 animate-pulse">
              <Bell className="w-6 h-6 sm:w-8 sm:h-8 animate-bounce" />
              NOW CALLING
            </h2>
            <div className="grid gap-3 sm:gap-5">
              {calledQueue.slice(0, 4).map(item => (
                <div
                  key={item.id}
                  className={`bg-gradient-to-r from-vxi-orange-500/20 to-vxi-orange-600/5 border-2 sm:border-4 border-vxi-orange-500 rounded-xl sm:rounded-3xl p-4 sm:p-8 transition-all duration-500 shadow-2xl ${
                    flashId === item.id ? 'animate-pulse ring-4 sm:ring-8 ring-vxi-orange-400/50 scale-[1.02] sm:scale-105' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 sm:gap-8">
                      <div className="bg-gradient-to-br from-vxi-orange-500 to-vxi-orange-700 text-white font-black text-2xl sm:text-5xl w-16 h-16 sm:w-32 sm:h-32 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl border-2 sm:border-4 border-white/20">
                        {item.room_number}
                      </div>
                      <div>
                        <p className="text-xl sm:text-5xl font-black mb-1 sm:mb-2 text-vxi-white tracking-tight">{item.candidate_name}</p>
                        <p className="text-base sm:text-2xl text-vxi-orange-400 font-semibold">{item.step_name}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-8 h-8 sm:w-16 sm:h-16 text-vxi-orange-500 animate-pulse hidden sm:block" strokeWidth={3} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Waiting Queue */}
        <div>
          <h2 className="text-xl sm:text-3xl font-bold text-vxi-white-200 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-vxi-orange-500" />
            WAITING
            <span className="bg-vxi-orange-500 text-white text-base sm:text-xl px-3 sm:px-4 py-0.5 sm:py-1 rounded-full font-bold ml-2">
              {waitingQueue.length}
            </span>
          </h2>

          {waitingQueue.length === 0 ? (
            <div className="bg-vxi-black-100/50 backdrop-blur-sm rounded-xl sm:rounded-3xl p-8 sm:p-16 text-center border-2 border-vxi-white-300/20">
              <Users className="w-16 h-16 sm:w-24 sm:h-24 mx-auto text-vxi-white-400/30 mb-3 sm:mb-5" />
              <p className="text-xl sm:text-3xl text-vxi-white-400 font-semibold">No applicants waiting</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
              {waitingQueue.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-vxi-black-100/70 backdrop-blur-sm border-2 border-vxi-white-300/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex items-center gap-3 sm:gap-5 hover:bg-vxi-black-50 hover:border-vxi-orange-500/50 transition-all shadow-lg hover:shadow-2xl hover:scale-[1.02] sm:hover:scale-105"
                >
                  <div className="bg-gradient-to-br from-vxi-orange-500 to-vxi-orange-600 text-white font-bold text-lg sm:text-2xl w-12 h-12 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg sm:text-2xl font-bold truncate text-vxi-white">{item.candidate_name}</p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-vxi-white-300 mt-1 sm:mt-2">
                      <span className="bg-vxi-black-50 border border-vxi-orange-500/30 px-2 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold">
                        Room {item.room_number}
                      </span>
                      <span className="text-vxi-orange-400 text-xs sm:text-sm font-medium truncate">{item.step_name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-vxi-black-100/90 backdrop-blur-md border-t-2 border-vxi-orange-500/30 px-4 sm:px-8 py-3 sm:py-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-sm sm:text-xl text-vxi-white-200 flex items-center gap-2 sm:gap-3">
            <Bell className="w-4 h-4 sm:w-6 sm:h-6 text-vxi-orange-500 animate-bounce-slow" />
            <span className="hidden sm:inline">Please listen for your name announcement</span>
            <span className="sm:hidden">Listen for your name</span>
          </p>
          <p className="font-bold text-vxi-orange-500 text-base sm:text-2xl">
            {sites.find(s => s.id.toString() === selectedSite)?.name || 'All Sites'}
          </p>
        </div>
      </footer>
    </div>
  );
}
