import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const phases = [
  'ESTABLISHING SECURE GATEWAY...',
  'INITIALIZING VENTURE PIPELINE...',
  'CONNECTING FOUNDERS & INVESTORS...',
];

export default function SignInGateway({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(8);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) return;
    setProgress(8);
    setPhase(0);
    if (reduceMotion) {
      setProgress(100);
      return;
    }
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start;
      const next = Math.min(96, 8 + 88 * (1 - Math.exp(-elapsed / 1250)));
      setProgress(next);
      setPhase(Math.min(2, Math.floor(elapsed / 650)));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, reduceMotion]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="ventora-gateway"
          role="status"
          aria-live="polite"
          aria-label="Signing in to Ventora Connect"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.045, filter: 'blur(8px)' }}
          transition={{ duration: reduceMotion ? 0.12 : 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="gateway-grid" aria-hidden="true" />
          <div className="gateway-glow gateway-glow-a" aria-hidden="true" />
          <div className="gateway-glow gateway-glow-b" aria-hidden="true" />
          <div className="gateway-center">
            <div className="gateway-network" aria-hidden="true">
              <svg viewBox="0 0 520 360" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <radialGradient id="gatewayNode"><stop stopColor="#d9f0ff"/><stop offset=".35" stopColor="#5ba8ff"/><stop offset="1" stopColor="#2368ff" stopOpacity="0"/></radialGradient>
                  <linearGradient id="gatewayThread"><stop stopColor="#347cff" stopOpacity="0"/><stop offset=".52" stopColor="#8cc8ff" stopOpacity=".9"/><stop offset="1" stopColor="#347cff" stopOpacity="0"/></linearGradient>
                </defs>
                <g className="gateway-threads" fill="none" stroke="url(#gatewayThread)" strokeWidth="1.2">
                  <path d="M24 34 Q160 80 260 180 T496 326"/><path d="M4 280 Q160 230 260 180 T510 48"/>
                  <path d="M94 0 Q160 120 260 180 T420 360"/><path d="M430 0 Q340 110 260 180 T82 360"/>
                  <path d="M0 160 Q120 120 260 180 T520 205"/><path d="M260 0 Q220 100 260 180 T260 360"/>
                </g>
                <g className="gateway-points">
                  {[[24,34],[496,326],[4,280],[510,48],[94,0],[420,360],[430,0],[82,360],[0,160],[520,205],[260,0],[260,360]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="5" fill="url(#gatewayNode)"/>)}
                </g>
              </svg>
            </div>
            <div className="gateway-radar gateway-radar-one" aria-hidden="true"/>
            <div className="gateway-radar gateway-radar-two" aria-hidden="true"/>
            <div className="gateway-lockup">
              <div className="gateway-wordmark"><span>V</span><span className="gateway-e"><i/><i/><i/></span><span>NTORA</span></div>
              <div className="gateway-connect">CONNECT</div>
            </div>
            <div className="gateway-subline"><span/> PRIVATE DEAL ROOM <span/></div>
          </div>
          <div className="gateway-footer">
            <div className="gateway-status"><span className="gateway-live-dot"/><span>{phases[phase]}</span></div>
            <div className="gateway-progress-row"><div className="gateway-progress-track"><motion.i animate={{ width: reduceMotion ? '100%' : progress + '%' }} transition={{ duration: .18, ease: 'linear' }}/></div><strong>{Math.round(progress).toString().padStart(2,'0')}%</strong></div>
            <div className="gateway-footnote">ENCRYPTED SESSION <span>•</span> VENTORA CONNECT <b aria-hidden="true">✦</b></div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
