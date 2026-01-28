import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Settings, Bell, ChevronRight, ChevronLeft } from 'lucide-react';
import { sitesAPI, queueAPI } from '../api';

export default function LiveQueuePage() {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(() => {
    return localStorage.getItem('vxi-site-filter') || '';
  });
  const [queue, setQueue] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [flashId, setFlashId] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(16); // Optimized for 32-40" TV at 15ft viewing distance
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isConnected, setIsConnected] = useState(true);

  // Use refs to track state without causing re-renders
  const lastCalledIdsRef = useRef(new Set());
  const calledTimestampsRef = useRef({});
  const applicantGridRef = useRef(null);

  // Load sites and listen for filter changes from admin page
  useEffect(() => {
    const loadSites = async () => {
      try {
        const sitesData = await sitesAPI.getAll();
        setSites(sitesData);
        const storedFilter = localStorage.getItem('vxi-site-filter');
        if (sitesData.length > 0 && !storedFilter) {
          setSelectedSite(sitesData[0].id.toString());
        }
      } catch (err) {
        console.error('Failed to load sites:', err);
      }
    };
    loadSites();

    const handleStorageChange = (e) => {
      if (e.key === 'vxi-site-filter') {
        setSelectedSite(e.newValue || '');
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const checkFilter = setInterval(() => {
      const currentFilter = localStorage.getItem('vxi-site-filter') || '';
      setSelectedSite(prev => prev !== currentFilter ? currentFilter : prev);
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkFilter);
    };
  }, []);

  // Load queue - stable polling with refs to avoid dependency issues
  const loadQueue = useCallback(async () => {
    if (!selectedSite) return;
    try {
      const queueData = await queueAPI.getAll(selectedSite);

      const currentCalledIds = new Set(
        queueData.filter(q => q.status === 'called').map(q => q.id)
      );

      // Track new calls with timestamps
      const now = Date.now();
      const newTimestamps = { ...calledTimestampsRef.current };

      currentCalledIds.forEach(id => {
        if (!lastCalledIdsRef.current.has(id)) {
          setFlashId(id);
          setTimeout(() => setFlashId(null), 5000);
          newTimestamps[id] = now; // Record when this was called
        }
      });

      // Clean up old timestamps for items no longer called
      Object.keys(newTimestamps).forEach(id => {
        if (!currentCalledIds.has(parseInt(id))) {
          delete newTimestamps[id];
        }
      });

      calledTimestampsRef.current = newTimestamps;
      lastCalledIdsRef.current = currentCalledIds;
      setQueue(queueData);
      setLastUpdate(new Date());
      setIsConnected(true);
    } catch (err) {
      console.error('Failed to load queue:', err);
      setIsConnected(false);
    }
  }, [selectedSite]);

  // Auto-refresh polling - runs every 2 seconds
  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [loadQueue]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-carousel for applicants
  useEffect(() => {
    const applicantQueue = queue.filter(q => q.status === 'waiting' || q.status === 'ongoing');
    const totalPages = Math.ceil(applicantQueue.length / itemsPerPage);

    if (totalPages <= 1) {
      setCurrentPage(0);
      return;
    }

    const carouselInterval = setInterval(() => {
      setCurrentPage(prev => (prev + 1) % totalPages);
    }, 8000); // Change page every 8 seconds

    return () => clearInterval(carouselInterval);
  }, [queue, itemsPerPage]);

  // Filter called items that should still be visible (within 30 seconds)
  const visibleCalledQueue = queue.filter(q => {
    if (q.status !== 'called') return false;
    const calledAt = calledTimestampsRef.current[q.id];
    if (!calledAt) return true; // Show if no timestamp (just loaded)
    const elapsed = Date.now() - calledAt;
    return elapsed < 30000; // Show for 30 seconds
  });

  // Calculate opacity for fading effect
  const getCalledItemOpacity = (id) => {
    const calledAt = calledTimestampsRef.current[id];
    if (!calledAt) return 1;
    const elapsed = Date.now() - calledAt;
    if (elapsed < 25000) return 1; // Full opacity for first 25 seconds
    if (elapsed >= 30000) return 0; // Hidden after 30 seconds
    // Fade out during last 5 seconds
    return 1 - ((elapsed - 25000) / 5000);
  };

  // Force re-render for opacity updates
  useEffect(() => {
    const fadeInterval = setInterval(() => {
      setCurrentTime(new Date()); // Triggers re-render
    }, 500);
    return () => clearInterval(fadeInterval);
  }, []);

  const applicantQueue = queue.filter(q => q.status === 'waiting' || q.status === 'ongoing');
  const totalPages = Math.ceil(applicantQueue.length / itemsPerPage);
  const paginatedApplicants = applicantQueue.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-vxi-black-300 via-vxi-black-200 to-vxi-black-300 text-vxi-white flex flex-col">
      {/* Header - Optimized for TV visibility */}
      <header className="bg-vxi-black-100/90 backdrop-blur-md border-b-2 border-vxi-orange-500/30 px-6 py-3 shadow-xl flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-vxi-orange-500 to-vxi-orange-600 p-3 rounded-xl shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-vxi-white">Applicant Queue</h1>
              <p className="text-vxi-white-300 text-sm">VXI Talent Acquisition</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* Live indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isConnected ? 'bg-green-500/20 border border-green-500' : 'bg-red-500/20 border border-red-500'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={`text-sm font-bold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                {isConnected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>

            <div className="bg-vxi-orange-500/20 border-2 border-vxi-orange-500 rounded-xl px-5 py-2">
              <p className="text-2xl font-bold text-vxi-orange-500">
                {sites.find(s => s.id.toString() === selectedSite)?.name || 'All Sites'}
              </p>
            </div>

            <div className="text-right bg-vxi-black-50 px-5 py-2 rounded-xl border border-vxi-orange-500/30">
              <p className="text-4xl font-mono font-bold text-vxi-orange-500">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-vxi-white-300 text-sm font-medium">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>

            <Link
              to="/admin"
              className="bg-vxi-black-50 hover:bg-vxi-orange-500 border border-vxi-white-300/20 hover:border-vxi-orange-500 p-3 rounded-xl transition-all hover:scale-110 shadow-lg"
              title="Admin Panel"
            >
              <Settings className="w-6 h-6 text-vxi-white-200 hover:text-white" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content - Fixed height, no scroll */}
      <div className="flex-1 p-3 flex flex-col overflow-hidden">
        {/* Now Calling Section - Fades after 30 seconds */}
        {visibleCalledQueue.length > 0 && (
          <div className="mb-4 flex-shrink-0">
            <h2 className="text-2xl font-bold text-vxi-orange-500 mb-3 flex items-center gap-3 animate-pulse">
              <Bell className="w-6 h-6 animate-bounce" />
              NOW CALLING
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {visibleCalledQueue.slice(0, 4).map(item => (
                <div
                  key={item.id}
                  style={{ opacity: getCalledItemOpacity(item.id), transition: 'opacity 0.5s ease-out' }}
                  className={`bg-gradient-to-r from-vxi-orange-500/20 to-vxi-orange-600/5 border-3 border-vxi-orange-500 rounded-2xl p-4 shadow-xl ${
                    flashId === item.id ? 'animate-pulse ring-4 ring-vxi-orange-400/50 scale-[1.02]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="bg-gradient-to-br from-vxi-orange-500 to-vxi-orange-700 text-white font-black text-3xl w-16 h-16 rounded-xl flex items-center justify-center shadow-xl border-2 border-white/20">
                        {item.room_number}
                      </div>
                      <div>
                        <p className="text-3xl font-black text-vxi-white tracking-tight">{item.candidate_name}</p>
                        <p className="text-lg text-vxi-orange-400 font-semibold">{item.step_name}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-10 h-10 text-vxi-orange-500 animate-pulse" strokeWidth={3} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Applicants Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-2xl font-bold text-vxi-white-200 flex items-center gap-3">
              <Users className="w-6 h-6 text-vxi-orange-500" />
              APPLICANTS
              <span className="bg-vxi-orange-500 text-white text-lg px-4 py-1 rounded-full font-bold ml-2">
                {applicantQueue.length}
              </span>
            </h2>

            {/* Page indicator - Larger for TV */}
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentPage(p => (p - 1 + totalPages) % totalPages)}
                  className="p-2 bg-vxi-black-50 rounded-lg border border-vxi-white-300/20 hover:bg-vxi-orange-500/20"
                >
                  <ChevronLeft className="w-5 h-5 text-vxi-white-300" />
                </button>
                <div className="flex gap-2">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        i === currentPage ? 'bg-vxi-orange-500 w-6' : 'bg-vxi-white-400/30'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => (p + 1) % totalPages)}
                  className="p-2 bg-vxi-black-50 rounded-lg border border-vxi-white-300/20 hover:bg-vxi-orange-500/20"
                >
                  <ChevronRight className="w-5 h-5 text-vxi-white-300" />
                </button>
                <span className="text-base text-vxi-white-400 font-medium ml-2">
                  Page {currentPage + 1} of {totalPages}
                </span>
              </div>
            )}
          </div>

          {applicantQueue.length === 0 ? (
            <div className="flex-1 flex items-center justify-center bg-vxi-black-100/50 backdrop-blur-sm rounded-xl border border-vxi-white-300/20">
              <div className="text-center">
                <Users className="w-16 h-16 mx-auto text-vxi-white-400/30 mb-2" />
                <p className="text-xl text-vxi-white-400 font-semibold">No applicants in queue</p>
              </div>
            </div>
          ) : (
            <div
              ref={applicantGridRef}
              className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 auto-rows-min content-start overflow-hidden"
            >
              {paginatedApplicants.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-vxi-black-100/80 backdrop-blur-sm border-2 border-vxi-white-300/20 rounded-xl p-3 hover:bg-vxi-black-50 hover:border-vxi-orange-500/50 transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {/* Status dot: red for waiting, green for ongoing */}
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      item.status === 'ongoing'
                        ? 'bg-green-500 shadow-md shadow-green-500/50'
                        : 'bg-red-500 shadow-md shadow-red-500/50'
                    }`} />
                    <span className="text-base text-vxi-orange-500 font-bold">
                      #{(currentPage * itemsPerPage) + index + 1}
                    </span>
                  </div>
                  <p className="text-xl font-bold truncate text-vxi-white leading-tight" title={item.candidate_name}>
                    {item.candidate_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-vxi-white-400 bg-vxi-black-50 px-2 py-1 rounded-lg font-medium">
                      {item.room_number}
                    </span>
                    <span className="text-sm text-vxi-orange-400 truncate font-medium" title={item.step_name}>
                      {item.step_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer - Larger text for TV visibility */}
      <footer className="flex-shrink-0 bg-vxi-black-100/90 backdrop-blur-md border-t-2 border-vxi-orange-500/30 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <p className="text-lg text-vxi-white-200 flex items-center gap-2 font-medium">
              <Bell className="w-5 h-5 text-vxi-orange-500" />
              Please listen for your name announcement
            </p>
            {/* Legend */}
            <div className="flex items-center gap-4 text-base text-vxi-white-400">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span> Waiting
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span> Ongoing
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-vxi-white-400">
              Updated: {lastUpdate.toLocaleTimeString()}
            </span>
            <p className="font-bold text-vxi-orange-500 text-xl">
              {sites.find(s => s.id.toString() === selectedSite)?.name || 'All Sites'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
