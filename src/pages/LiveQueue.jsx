import React, { useCallback, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiVolume2, FiVolumeX, FiMaximize, FiMinimize, FiInfo, FiClock, FiActivity } from 'react-icons/fi';
import api from '../api/axiosInstance';

const normalizeTicket = (ticket) => ({
  ref: ticket.ref,
  service: typeof ticket.service === 'object' ? ticket.service?.name : ticket.service,
  counter: String(ticket.counter || '--').replace(/^Counter\s*/i, '') || '--',
  status: ticket.status
});

const LiveQueue = () => {
  const [currentServed, setCurrentServed] = useState(null);
  const [nextList, setNextList] = useState([]);
  const [waitingList, setWaitingList] = useState([]);
  const [centerName, setCenterName] = useState('National Queue Monitor');
  const [voiceMuted, setVoiceMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const containerRef = useRef(null);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadLiveQueue = async () => {
    const centersRes = await api.get('/api/centers');
    const center = centersRes.data.data?.[0];
    if (!center) return;

    setCenterName(center.name);
    const queueRes = await api.get(`/api/queue/live/${center._id || center.id}`);
    const tickets = (queueRes.data.data || []).map(normalizeTicket);
    setCurrentServed(tickets.find((ticket) => ticket.status === 'Being Served') || tickets[0] || null);
    setNextList(tickets.filter((ticket) => ticket.status === 'Waiting').slice(0, 3));
    setWaitingList(tickets.filter((ticket) => ticket.status === 'Waiting').slice(3, 9));
  };

  useEffect(() => {
    loadLiveQueue().catch(() => {
      setCurrentServed(null);
      setNextList([]);
      setWaitingList([]);
    });
    const interval = setInterval(() => {
      loadLiveQueue().catch(() => {
        setCurrentServed(null);
        setNextList([]);
        setWaitingList([]);
      });
    }, 9000);
    return () => clearInterval(interval);
  }, []);

  // Voice synthesis announcer
  const announceTicket = useCallback((ticket) => {
    if (!ticket || voiceMuted || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Clear any pending speech
    const text = `Ticket number ${ticket.ref.split('-').join(' ')}, please proceed to Counter ${ticket.counter.replace(/^0+/, '')}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  }, [voiceMuted]);

  // Trigger speech when served ticket shifts
  useEffect(() => {
    announceTicket(currentServed);
  }, [announceTicket, currentServed]);

  // Full screen mode toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Monitor fullscreen change outside button (e.g. ESC key)
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white min-h-screen flex flex-col justify-between select-none p-6 md:p-8"
    >
      {/* Header bar */}
      <header className="flex flex-col md:flex-row justify-between items-center pb-6 border-b border-slate-800 gap-4">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 bg-[#4189DD] rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="text-white font-black text-2xl tracking-tighter">N</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-white font-black text-xl tracking-wider leading-none uppercase">
              National Queue Monitor
            </span>
            <span className="text-[#4189DD] font-bold text-[11px] tracking-widest uppercase leading-none mt-1">
              Public Display Screen
            </span>
          </div>
        </div>

        {/* Live Clock & Display Controls */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-slate-300 font-mono text-sm">
            <FiClock className="text-[#4189DD]" />
            <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setVoiceMuted(!voiceMuted)}
              className={`p-3 rounded-xl border transition-all duration-200 ${
                voiceMuted
                  ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-[#4189DD]'
                  : 'bg-[#F59E0B] border-[#F59E0B] text-white hover:bg-amber-600'
              }`}
              title={voiceMuted ? "Enable Voice Announcements" : "Mute Voice Announcements"}
            >
              {voiceMuted ? <FiVolumeX className="w-5 h-5" /> : <FiVolume2 className="w-5 h-5 animate-bounce" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-[#4189DD] rounded-xl transition duration-150"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? <FiMinimize className="w-5 h-5" /> : <FiMaximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Display Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 my-8 items-stretch">
        {/* Left Column: Massive serving card */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-slate-900 rounded-3xl border border-slate-800 p-8 shadow-xl shadow-black/10 relative overflow-hidden">
          {/* Top layout */}
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-2.5">
              <span className="h-3 w-3 rounded-full bg-green-500 animate-ping" />
              <span className="text-xs font-black uppercase text-green-500 tracking-widest">Active Call</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{centerName}</span>
          </div>

          {/* Central Served Information */}
          <div className="text-center py-12">
            <span className="text-[11px] font-extrabold text-[#4189DD] bg-blue-500/10 px-3.5 py-1.5 rounded-full uppercase tracking-widest mb-6 inline-block">
              Now Serving
            </span>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentServed?.ref || 'none'}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="text-8xl sm:text-9xl font-mono font-black text-white tracking-wider leading-none select-all"
              >
                {currentServed?.ref || '--'}
              </motion.div>
            </AnimatePresence>
            <p className="text-slate-300 text-base sm:text-lg uppercase tracking-widest mt-6 font-semibold">
              {currentServed?.service || 'No active ticket'}
            </p>
          </div>

          {/* Counter Destination Info */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 flex justify-between items-center">
            <div className="text-left">
              <span className="block text-[10px] text-[#4189DD] font-extrabold uppercase tracking-widest mb-1">Destination</span>
              <span className="text-2xl font-black text-white uppercase tracking-wider">Please Proceed To</span>
            </div>
            <div className="bg-[#F59E0B] text-white rounded-xl px-6 py-3 font-mono font-black text-3xl shadow-lg shadow-amber-500/15 leading-none">
              COUNTER {currentServed?.counter || '--'}
            </div>
          </div>
        </div>

        {/* Right Column: Next and Waiting Panels */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-6">
          {/* Top Panel: Upcoming Tickets */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 flex flex-col justify-between flex-1 shadow-xl shadow-black/10">
            <div className="flex items-center space-x-2 pb-3.5 border-b border-slate-800">
              <FiActivity className="text-[#4189DD]" />
              <span className="text-xs font-extrabold text-white uppercase tracking-wider">Next in Queue</span>
            </div>
            <div className="space-y-3 pt-4">
              <AnimatePresence initial={false}>
                {nextList.map((item) => (
                  <motion.div
                    key={item.ref}
                    layout
                    className="flex justify-between items-center p-3.5 bg-slate-950 rounded-2xl border border-slate-800"
                  >
                    <div className="flex items-center space-x-4">
                      <span className="font-mono text-base font-black text-[#4189DD]">
                        {item.ref}
                      </span>
                      <div className="flex flex-col text-left">
                        <span className="text-white text-xs font-bold uppercase">{item.service}</span>
                        <span className="text-slate-400 text-[10px] font-semibold">Ready for dispatch</span>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-1.5 font-mono text-xs font-black text-slate-300">
                      C-{item.counter}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Panel: Waiting Queue Ticker */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 flex flex-col justify-between flex-1 shadow-xl shadow-black/10">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <span className="text-xs font-extrabold text-white uppercase tracking-wider">Standby Pool</span>
              <span className="text-[10px] text-slate-400 font-mono">Waiting List</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4">
              {waitingList.map((item) => (
                <div
                  key={item.ref}
                  className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800"
                >
                  <span className="font-mono text-xs font-bold text-slate-300">{item.ref}</span>
                  <span className="text-[8px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                    Standby
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer bar */}
      <footer className="flex flex-col md:flex-row justify-between items-center pt-6 border-t border-slate-800 text-xs text-slate-400 gap-4">
        <div className="flex items-center space-x-2">
          <FiInfo className="text-[#4189DD]" />
          <span>National ID Queue Monitor - Official public display terminal.</span>
        </div>
        <div>
          <span>Muted by default. Tap the sound icon to hear live voice calls.</span>
        </div>
      </footer>
    </div>
  );
};

export default LiveQueue;
