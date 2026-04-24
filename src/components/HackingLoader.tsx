import { motion } from 'motion/react';
import { useEffect, useState, useMemo } from 'react';

const MatrixRain = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&*()_+-=[]{}|;:,.<>?/\\πΩ∞∑√∫∆≈";
  return (
    <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
      <div className="flex justify-around w-full h-full">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: -100 }}
            animate={{ y: '100vh' }}
            transition={{
              duration: Math.random() * 5 + 5,
              repeat: Infinity,
              ease: "linear",
              delay: Math.random() * 5
            }}
            className="text-[#00FF00] text-[10px] whitespace-pre flex flex-col leading-none"
            style={{ opacity: Math.random() * 0.5 + 0.2 }}
          >
            {[...Array(50)].map((_, j) => (
              <span key={j}>{characters[Math.floor(Math.random() * characters.length)]}</span>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const GlitchText = ({ text }: { text: string }) => {
  return (
    <div className="relative inline-block group">
      <span className="relative z-10">{text}</span>
      <motion.span
        animate={{ 
          x: [-2, 2, -1, 3, -3],
          opacity: [0, 0.5, 0, 0.3, 0]
        }}
        transition={{ duration: 0.2, repeat: Infinity, repeatType: 'mirror' }}
        className="absolute top-0 left-0 -z-10 text-red-500 w-full"
      >
        {text}
      </motion.span>
      <motion.span
        animate={{ 
          x: [2, -2, 3, -1, 1],
          opacity: [0, 0.3, 0, 0.5, 0]
        }}
        transition={{ duration: 0.25, repeat: Infinity, repeatType: 'mirror' }}
        className="absolute top-0 left-0 -z-10 text-blue-500 w-full"
      >
        {text}
      </motion.span>
    </div>
  );
};

export const HackingLoader = ({ progress, step }: { progress: number; step: string }) => {
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  
  useEffect(() => {
    if (step) {
      setTerminalLogs(prev => [...prev.slice(-8), `> EXECUTING: ${step}...`]);
    }
  }, [step]);

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center font-mono overflow-hidden select-none">
      {/* Background Layers */}
      <MatrixRain />
      <div className="absolute inset-0 bg-[#00FF00]/5 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)]" />
      
      {/* CRT Overlay */}
      <div className="absolute inset-0 pointer-events-none z-50">
        <div className="w-full h-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%]" />
      </div>

      <div className="relative w-full max-w-lg px-6 py-8 flex flex-col items-center">
        {/* Top Scanner HUD */}
        <div className="w-full flex justify-between items-center mb-12 text-[10px] text-[#00FF00]/60 border-b border-[#00FF00]/20 pb-2">
            <div className="flex items-center gap-2">
                <span className="animate-pulse">●</span>
                <span>ENC_LEVEL: STAGE_4_AES_256</span>
            </div>
            <div className="flex items-center gap-1">
                <span className="opacity-40">SRV:</span>
                <span className="text-[#00FF00]">MASTER_GATE_7</span>
            </div>
        </div>

        {/* Main Center UI */}
        <div className="relative w-48 h-48 sm:w-64 sm:h-64 mb-12 flex items-center justify-center">
          {/* Animated Circles */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-dashed border-[#00FF00]/10"
          />
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute inset-4 rounded-full border border-dotted border-[#00FF00]/20"
          />
          
          <div className="text-center space-y-2 z-10">
            <motion.div 
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-[#00FF00] text-5xl sm:text-7xl font-black tracking-tighter"
            >
              {progress}%
            </motion.div>
            <div className="text-[10px] text-[#00FF00]/80 font-bold tracking-widest px-2 py-1 bg-[#00FF00]/10 inline-block">
              <GlitchText text="BYPASSING_CORE" />
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full space-y-4">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#00FF00]">
            <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#00FF00] scale-x-[-1] animate-[pulse_0.5s_infinite]" />
                {step || 'INITIALIZING'}
            </span>
            <span className="opacity-50">SYNC_STAT: {progress < 100 ? 'PARTIAL' : 'LOCKED'}</span>
          </div>

          <div className="h-6 w-full bg-black border-2 border-[#00FF00]/30 p-1 relative">
            <motion.div 
              className="h-full bg-[#00FF00] relative overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            >
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.1)_10px,rgba(0,0,0,0.1)_20px)]" />
            </motion.div>
            
            {/* Background Percentage Marks */}
            <div className="absolute inset-0 flex justify-around items-center pointer-events-none opacity-20 text-[8px] text-[#00FF00]">
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
            </div>
          </div>
        </div>

        {/* Terminal Logs (Mobile Friendly) */}
        <div className="w-full mt-12 bg-black/60 border border-[#00FF00]/20 p-4 font-mono text-[9px] h-32 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-2 opacity-20 text-[#00FF00]">LOG_STREAMS</div>
          <div className="space-y-1">
            {terminalLogs.map((log, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[#00FF00]/80 whitespace-nowrap overflow-hidden text-ellipsis"
              >
                {log}
              </motion.div>
            ))}
            <motion.div 
              animate={{ opacity: [0, 1, 0] }} 
              transition={{ duration: 0.8, repeat: Infinity }}
              className="inline-block w-2 h-3 bg-[#00FF00]/80"
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          from { transform: translateY(0); }
          to { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
};

