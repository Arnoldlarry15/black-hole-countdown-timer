import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { AlertOctagon, Orbit, Radio, Zap } from 'lucide-react';
import { AudioEngine } from './lib/audio';
import { BlackHoleWebGL, BlackHoleRef } from './components/BlackHoleWebGL';

type Status = 'idle' | 'descending' | 'crossed';

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [pointOfNoReturn, setPointOfNoReturn] = useState(false);
  const [telemetry, setTelemetry] = useState({
    distance: 10.0,
    dilation: 1.0,
    radiation: 0,
    velocity: 0,
  });

  const engineRef = useRef<AudioEngine | null>(null);
  const bhRef = useRef<BlackHoleRef>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  
  const progressVal = useRef(0);
  const pnrVal = useRef(0);
  const lastTickRef = useRef(-1);

  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    // We only clean up audio on absolute unmount
    return () => {
      engineRef.current?.silence();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const initiateDescent = async () => {
    // Initialize Audio Engine
    if (!engineRef.current) {
      engineRef.current = new AudioEngine();
    }
    await engineRef.current.init();

    setStatus('descending');
    setPointOfNoReturn(false);
    pnrVal.current = 0;
    const startTime = Date.now();
    const durationMs = 15000; // 15 seconds to horizon

    const loop = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = elapsed / durationMs;
      
      // Handle the exact moment of crossing
      if (progress >= 1.0 && progressVal.current < 1.0) {
          handleCrossing();
      }
      
      progressVal.current = progress;

      // Update Shader
      bhRef.current?.setProgress(progress);

      if (progress < 1.0) {
        // Point of No Return logic at T-5 seconds (or early, up to you, let's say when 8 seconds elapsed)
        const isPnr = elapsed >= 8000;
        if (isPnr && pnrVal.current === 0) {
            setPointOfNoReturn(true);
        }
        if (isPnr) {
            pnrVal.current = Math.min(pnrVal.current + 0.015, 1.0); 
        }

        if (bhRef.current?.setPnr) {
          bhRef.current.setPnr(pnrVal.current);
        }

        // Update Audio Rumble
        engineRef.current?.update(progress);

        // Calculate Countdown Number to perfectly align with hitting the event horizon
        const timeLeftMs = durationMs - elapsed;
        const currentSecond = Math.ceil(timeLeftMs / 1000);
        const isCountdownActive = currentSecond <= 10 && currentSecond >= 0;
        
        // Trigger tick audio and state update once per second
        if (isCountdownActive && currentSecond !== lastTickRef.current) {
          lastTickRef.current = currentSecond;
          setCountdown(currentSecond);
          engineRef.current?.playTick(progress);
        }

        // Update telemetry for HUD
        setTelemetry({
          distance: Math.max(0, 10 - Math.min(progress, 1.0) * 10),
          dilation: 1.0 + Math.pow(Math.min(progress, 1.0), 4) * 999.0,
          radiation: Math.floor(Math.min(progress, 1.0) * Math.pow(10, 6) * Math.random()),
          velocity: 0.1 + Math.pow(Math.min(progress, 1.0), 2) * 0.9, // approaching c
        });
      }
      
      // Continue loop to drive post-crossing effects
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  const handleCrossing = () => {
    if (bhRef.current?.setPnr) {
      bhRef.current.setPnr(0);
    }
    engineRef.current?.playCrossing();
    
    // Clear the UI
    if (uiRef.current) {
      uiRef.current.style.transform = 'none';
      uiRef.current.style.textShadow = 'none';
    }
    
    setCountdown(null);
    setStatus('crossed');
  };

  const handleReset = () => {
    cancelAnimationFrame(animFrameRef.current);
    engineRef.current?.silence();

    setStatus('idle');
    setPointOfNoReturn(false);
    setCountdown(null);
    progressVal.current = 0;
    pnrVal.current = 0;
    lastTickRef.current = -1;
    
    bhRef.current?.setProgress(0);
    if (bhRef.current?.setPnr) {
      bhRef.current.setPnr(0);
    }

    if (uiRef.current) {
        uiRef.current.style.transform = 'none';
        uiRef.current.style.textShadow = 'none';
    }

    setTelemetry({ distance: 10.0, dilation: 1.0, radiation: 0, velocity: 0 });
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-mono text-white">
      {/* Background WebGL Shader */}
      <BlackHoleWebGL ref={bhRef} />

      <AnimatePresence>
        {status === 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
            className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/40 backdrop-blur-sm z-20"
          >
            <AlertOctagon className="w-16 h-16 text-yellow-500 mb-6 animate-pulse" />
            <h1 className="text-4xl md:text-5xl font-bold tracking-widest text-center mb-2">EXTREME GRAVITY WELL</h1>
            <p className="text-red-400 mb-10 tracking-widest uppercase text-sm">Singularity proximity warning</p>
            
            <button 
              onClick={initiateDescent}
              className="px-8 py-4 bg-red-600/20 border border-red-500 text-red-500 hover:bg-red-600 hover:text-white transition-all duration-300 uppercase tracking-[0.2em] font-bold outline-none cursor-pointer"
            >
              Initiate Descent
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Descent UI Overlay */}
      <div ref={uiRef} className="absolute inset-0 pointer-events-none z-10 overflow-hidden font-mono text-white select-none">
        <AnimatePresence>
            {status === 'descending' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                  {/* Top HUD */}
                  <div className="absolute top-0 left-0 w-full p-10 flex justify-between items-start pointer-events-none">
                    <div className="space-y-4">
                      <div>
                        {pointOfNoReturn ? (
                          <div className="text-[10px] uppercase tracking-[0.3em] text-purple-500 mb-1 animate-pulse">Point of No Return Passed</div>
                        ) : (
                          <div className="text-[10px] uppercase tracking-[0.3em] text-orange-500 mb-1">Proximity Alert</div>
                        )}
                        <div className="text-2xl font-light">EVENT HORIZON INBOUND</div>
                      </div>
                      <div className="border-l border-white/20 pl-4">
                        <div className="text-[10px] text-white/50 uppercase tracking-widest">Relativistic Velocity</div>
                        <div className="text-xl">{(telemetry.velocity * 0.999999).toFixed(6)} c</div>
                      </div>
                    </div>

                    <div className="text-right space-y-4 hidden md:block">
                      <div>
                        <div className="text-[10px] text-white/50 uppercase tracking-widest">Coordinate System</div>
                        <div className="text-xl">SGR-A* SECTOR 01</div>
                      </div>
                      <div className="border-r border-white/20 pr-4">
                        <div className="text-[10px] text-white/50 uppercase tracking-widest">Hawking Flux</div>
                        <div className="text-xl">4.821 &times; 10<sup>-32</sup> K</div>
                      </div>
                    </div>
                  </div>

                  {/* Centered Big Countdown */}
                  <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center w-full">
                    <div className="text-[11px] md:text-sm uppercase tracking-[0.5em] text-white/40 mb-2 whitespace-nowrap">Temporal Dilatation Synchronized</div>
                    <div className="flex items-baseline space-x-4">
                      <AnimatePresence mode="popLayout">
                          {countdown && (
                            <motion.div
                              key={countdown}
                              initial={{ opacity: 0, scale: 0.5, y: 50 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 2, filter: 'blur(10px)', transition: { duration: 0.4 } }}
                              className="text-7xl md:text-9xl font-extralight tracking-tighter leading-none italic"
                            >
                              00:{(countdown < 10 ? '0' : '') + countdown}
                            </motion.div>
                          )}
                      </AnimatePresence>
                      <span className="text-3xl md:text-4xl font-light opacity-50">.{Math.floor((telemetry.distance % 1) * 100).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="mt-8 flex space-x-2">
                      <div className="w-8 md:w-12 h-1 bg-orange-600"></div>
                      <div className="w-8 md:w-12 h-1 bg-orange-600"></div>
                      <div className="w-8 md:w-12 h-1 bg-orange-600 shadow-[0_0_15px_#ea580c]"></div>
                      <div className="w-8 md:w-12 h-1 bg-white/10"></div>
                      <div className="w-8 md:w-12 h-1 bg-white/10"></div>
                      <div className="w-8 md:w-12 h-1 bg-white/10"></div>
                    </div>
                  </div>

                  {/* Bottom Status Bar */}
                  <div className="absolute bottom-0 left-0 w-full p-4 md:p-6 border-t border-white/5 bg-black/80 flex flex-col md:flex-row justify-between items-center gap-2 text-[10px] tracking-widest uppercase text-white/60">
                    <div className="flex items-center space-x-4 md:space-x-8 text-center md:text-left">
                      <span>Status: Spaghettification Imminent</span>
                      <span className="text-red-500 animate-pulse">Gravity Gradient: Extreme</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="opacity-30 italic">"Light cannot escape"</span>
                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    </div>
                  </div>
              </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* Post-Crossing absolute darkness and text */}
      <AnimatePresence>
         {status === 'crossed' && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1, transition: { delay: 3, duration: 4 } }}
             className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-auto"
           >
             <p className="text-white/80 tracking-[0.5em] text-sm md:text-xl uppercase drop-shadow-lg text-center leading-loose mb-12">
               You have crossed the Event Horizon.<br/>Welcome to a new continuity.
             </p>

             <motion.button
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0, transition: { delay: 8, duration: 2 } }}
               onClick={handleReset}
               className="px-6 py-3 border border-white/20 text-white/50 hover:bg-white/10 hover:text-white transition-all duration-500 tracking-widest uppercase text-xs cursor-pointer z-50"
             >
               Initialize New Sim
             </motion.button>
           </motion.div>
         )}
      </AnimatePresence>
    </div>
  );
}

