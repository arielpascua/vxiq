import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Settings, Bell, ChevronRight, ChevronLeft, LayoutGrid } from 'lucide-react';
import { sitesAPI, queueAPI, speak } from '../api';

export default function LiveQueuePage() {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(() => {
    return localStorage.getItem('vxi-site-filter') || '';
  });
  const [queue, setQueue] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [flashId, setFlashId] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('vxi-items-per-page');
    return saved ? parseInt(saved) : 8;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isConnected, setIsConnected] = useState(true);

  // Use refs to track state without causing re-renders
  const lastCallCountsRef = useRef({}); // Track call_count per ID to detect re-calls
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

      // Track new calls AND re-calls by comparing call_count
      const now = Date.now();
      const newTimestamps = { ...calledTimestampsRef.current };
      const newCallCounts = {};

      queueData.filter(q => q.status === 'called').forEach(item => {
        const prevCallCount = lastCallCountsRef.current[item.id] || 0;
        const currentCallCount = item.call_count || 0;
        newCallCounts[item.id] = currentCallCount;

        // Trigger if this is a new call OR if call_count increased (re-call / "Again")
        if (currentCallCount > prevCallCount) {
          setFlashId(item.id);
          setTimeout(() => setFlashId(null), 5000);
          newTimestamps[item.id] = now; // Reset timestamp for NOW CALLING visibility
          // TTS announcement on TV
          speak(`${item.candidate_name}, please proceed to ${item.room_number} for your ${item.step_name}.`);
        }
      });

      // Clean up old timestamps for items no longer called
      Object.keys(newTimestamps).forEach(id => {
        const idNum = parseInt(id);
        const stillCalled = queueData.some(q => q.id === idNum && q.status === 'called');
        if (!stillCalled) {
          delete newTimestamps[id];
        }
      });

      calledTimestampsRef.current = newTimestamps;
      lastCallCountsRef.current = newCallCounts;
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

  // Prevent screensaver/screen lock using Wake Lock API
  useEffect(() => {
    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Wake Lock acquired - screen will stay on');
          wakeLock.addEventListener('release', () => {
            console.log('Wake Lock released');
          });
        } else {
          console.log('Wake Lock API not supported');
        }
      } catch (err) {
        console.error('Wake Lock request failed:', err);
      }
    };

    // Request wake lock on mount
    requestWakeLock();

    // Re-acquire wake lock when page becomes visible again (e.g., after tab switch)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup: release wake lock and remove listener
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release();
      }
    };
  }, []);

  // Auto-carousel for applicants
  const carouselRef = useRef(null);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const itemsPerPageRef = useRef(itemsPerPage);
  itemsPerPageRef.current = itemsPerPage;

  useEffect(() => {
    if (carouselRef.current) clearInterval(carouselRef.current);
    carouselRef.current = setInterval(() => {
      const applicantQueue = queueRef.current.filter(q => q.status === 'waiting' || q.status === 'ongoing' || q.status === 'called');
      const total = Math.ceil(applicantQueue.length / itemsPerPageRef.current);
      if (total > 1) {
        setCurrentPage(prev => (prev + 1) % total);
      }
    }, 12000);

    return () => clearInterval(carouselRef.current);
  }, []);

  // Filter called items that should still be visible (within 15 seconds)
  const [visibleCalledIds, setVisibleCalledIds] = useState(new Set());

  useEffect(() => {
    // Check every 2 seconds which called items should still be visible
    const checkInterval = setInterval(() => {
      const now = Date.now();
      const stillVisible = new Set();
      queue.filter(q => q.status === 'called').forEach(q => {
        const calledAt = calledTimestampsRef.current[q.id];
        if (!calledAt || now - calledAt < 15000) stillVisible.add(q.id);
      });
      setVisibleCalledIds(stillVisible);
    }, 2000);
    return () => clearInterval(checkInterval);
  }, [queue]);

  const visibleCalledQueue = queue.filter(q =>
    q.status === 'called' && visibleCalledIds.has(q.id)
  );

  const applicantQueue = queue.filter(q => q.status === 'waiting' || q.status === 'ongoing' || q.status === 'called');
  const totalPages = Math.ceil(applicantQueue.length / itemsPerPage);
  const paginatedApplicants = applicantQueue.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  // Dynamic sizing based on cards per page
  const cardSize = itemsPerPage <= 4 ? 'xl' : itemsPerPage <= 8 ? 'lg' : itemsPerPage <= 16 ? 'md' : 'sm';
  const sizeMap = {
    xl:  { dot: 'w-5 h-5', num: 'text-3xl', name: 'text-5xl', meta: 'text-2xl', metaPad: 'px-4 py-2', pad: 'p-6', gap: 'gap-4', round: 'rounded-lg' },
    lg:  { dot: 'w-4 h-4', num: 'text-xl', name: 'text-3xl', meta: 'text-lg', metaPad: 'px-3 py-1.5', pad: 'p-4', gap: 'gap-3', round: 'rounded-lg' },
    md:  { dot: 'w-3 h-3', num: 'text-base', name: 'text-xl', meta: 'text-sm', metaPad: 'px-2 py-1', pad: 'p-3', gap: 'gap-2', round: 'rounded-md' },
    sm:  { dot: 'w-2 h-2', num: 'text-sm', name: 'text-base', meta: 'text-xs', metaPad: 'px-1.5 py-0.5', pad: 'p-2', gap: 'gap-1.5', round: 'rounded-md' },
  };
  const sz = sizeMap[cardSize];

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

            {/* Display settings */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-3 rounded-xl border transition-all hover:scale-110 shadow-lg ${showSettings ? 'bg-vxi-orange-500 border-vxi-orange-500' : 'bg-vxi-black-50 border-vxi-white-300/20 hover:bg-vxi-orange-500 hover:border-vxi-orange-500'}`}
                title="Display Settings"
              >
                <LayoutGrid className="w-6 h-6 text-vxi-white-200 hover:text-white" />
              </button>
              {showSettings && (
                <div className="absolute right-0 top-full mt-2 bg-vxi-black-100 border-2 border-vxi-orange-500 rounded-xl p-4 shadow-2xl z-50 w-64 animate-slide-down">
                  <p className="text-sm text-vxi-white-300 font-medium mb-3">Cards per page</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const val = Math.max(4, itemsPerPage - 4);
                        setItemsPerPage(val);
                        localStorage.setItem('vxi-items-per-page', val.toString());
                        setCurrentPage(0);
                      }}
                      disabled={itemsPerPage <= 4}
                      className="w-10 h-10 flex items-center justify-center bg-vxi-black-50 border border-vxi-white-300/20 rounded-lg text-xl font-bold text-vxi-white hover:bg-vxi-orange-500 disabled:opacity-30 disabled:hover:bg-vxi-black-50 transition-all"
                    >
                      −
                    </button>
                    <span className="text-2xl font-bold text-vxi-orange-500 w-12 text-center">{itemsPerPage}</span>
                    <button
                      onClick={() => {
                        const val = Math.min(32, itemsPerPage + 4);
                        setItemsPerPage(val);
                        localStorage.setItem('vxi-items-per-page', val.toString());
                        setCurrentPage(0);
                      }}
                      disabled={itemsPerPage >= 32}
                      className="w-10 h-10 flex items-center justify-center bg-vxi-black-50 border border-vxi-white-300/20 rounded-lg text-xl font-bold text-vxi-white hover:bg-vxi-orange-500 disabled:opacity-30 disabled:hover:bg-vxi-black-50 transition-all"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-vxi-white-400 mt-2">Range: 4 – 32 (increments of 4)</p>
                </div>
              )}
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
        {/* Now Calling Section - Shows ALL called candidates, fades after 15 seconds */}
        {visibleCalledQueue.length > 0 && (
          <div className="mb-4 flex-shrink-0">
            <h2 className="text-2xl font-bold text-vxi-orange-500 mb-3 flex items-center gap-3 animate-pulse">
              <Bell className="w-6 h-6 animate-bounce" />
              NOW CALLING
              <span className="bg-vxi-orange-500 text-white text-lg px-3 py-0.5 rounded-full font-bold">
                {visibleCalledQueue.length}
              </span>
            </h2>
            <div className={`grid gap-3 ${
              visibleCalledQueue.length === 1 ? 'grid-cols-1' :
              visibleCalledQueue.length === 2 ? 'grid-cols-2' :
              visibleCalledQueue.length <= 4 ? 'grid-cols-2 lg:grid-cols-4' :
              'grid-cols-2 lg:grid-cols-4'
            }`}>
              {visibleCalledQueue.map(item => (
                <div
                  key={item.id}
                  style={{ animation: 'calledFade 15s ease-out forwards' }}
                  className={`bg-gradient-to-r from-vxi-orange-500/20 to-vxi-orange-600/5 border-3 border-vxi-orange-500 rounded-2xl p-4 shadow-xl animate-calling-glow ${
                    flashId === item.id ? 'ring-4 ring-vxi-orange-400/50 scale-[1.02]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="bg-gradient-to-br from-vxi-orange-500 to-vxi-orange-700 text-white font-bold text-sm min-w-16 px-3 py-2 rounded-xl flex items-center justify-center shadow-xl border-2 border-white/20 text-center leading-tight">
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
              className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 overflow-hidden carousel-page"
              style={{ gridAutoRows: '1fr' }}
              key={currentPage}
            >
              {paginatedApplicants.map((item, index) => {
                const statusColor = item.status === 'ongoing' ? '#22c55e' : item.status === 'called' ? '#FF6B35' : '#ef4444';
                return (
                <div
                  key={item.id}
                  className={`relative flex flex-col ${sz.round} overflow-hidden transition-all`}
                  style={{
                    background: `linear-gradient(160deg, rgba(26,26,26,0.95) 0%, rgba(15,15,15,0.9) 100%)`,
                    border: `1px solid rgba(255,255,255,0.06)`,
                    borderTop: `3px solid ${statusColor}`,
                    boxShadow: `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)`,
                  }}
                >
                  {/* Top section: Queue number badge */}
                  <div className={`flex items-center justify-center ${sz.pad} pb-0`}>
                    <div
                      className={`inline-flex items-center ${sz.gap} ${sz.metaPad} ${sz.round}`}
                      style={{ background: `${statusColor}15`, border: `1px solid ${statusColor}40` }}
                    >
                      <div className={`${sz.dot} rounded-full flex-shrink-0`} style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}80` }} />
                      <span className={`${sz.num} font-extrabold`} style={{ color: statusColor }}>
                        #{(currentPage * itemsPerPage) + index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Center: Candidate name — the hero */}
                  <div className={`flex-1 flex items-center justify-center ${sz.pad}`}>
                    <p className={`${sz.name} font-extrabold text-white leading-tight break-words text-center w-full`} style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                      {item.candidate_name}
                    </p>
                  </div>

                  {/* Bottom: Room & Step in a separated footer compartment */}
                  <div
                    className={`flex items-center justify-center ${sz.gap} ${sz.pad} pt-0`}
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <span className={`${sz.meta} text-vxi-white-300 font-medium`}>
                      {item.room_number}
                    </span>
                    <span className={`${sz.meta} opacity-30`}>•</span>
                    <span className={`${sz.meta} font-semibold`} style={{ color: '#FF6B35' }}>
                      {item.step_name}
                    </span>
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>

      {/* Footer - Larger text for TV visibility */}
      <footer className="flex-shrink-0 bg-vxi-black-100/90 backdrop-blur-md px-6 py-3" style={{ borderTop: '2px solid transparent', borderImage: 'linear-gradient(90deg, transparent, #FF6B35, transparent) 1' }}>
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
