import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export type VentoraLoaderVariant = 'blueprint' | 'pulse' | 'convergence' | 'auto';
export type VentoraMotionVariant = 'slime-stamp' | 'box-bounce-paint';
type Props = {
  active?: boolean;
  variant?: VentoraLoaderVariant;
  motionVariant?: VentoraMotionVariant;
  status?: string;
  className?: string;
  replayKey?: string | number;
};

const copy: Record<Exclude<VentoraLoaderVariant,'auto'>,string> = {
  blueprint: 'VERIFYING DEAL ROOM...',
  pulse: 'CONNECTING VENTURES...',
  convergence: 'SYNCING INVESTOR PIPELINE...'
};

function Wordmark() {
  const letters = ['V','E','N','T','O','R','A'];
  return <div className="vc-loader-wordmark" aria-label="VENTORA CONNECT">
    <div className="vc-loader-ventora">
      {letters.map((letter,index) => letter === 'E'
        ? <span className="vc-loader-letter vc-loader-e-slot" key={letter} aria-label="E"><i/><i/><i/></span>
        : <span className="vc-loader-letter" key={letter} style={{'--letter-index':index} as React.CSSProperties}>{letter}</span>)}
    </div>
    <div className="vc-loader-connect"><span>CONNECT</span></div>
  </div>;
}

function SlimeCharacter() {
  return <svg className="vc-slime-character" viewBox="0 0 100 96" role="img" aria-label="Happy blue slime mascot">
    <defs>
      <linearGradient id="vc-slime-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#dff5ff"/><stop offset=".48" stopColor="#8bdcff"/><stop offset="1" stopColor="#3b82f6"/></linearGradient>
      <linearGradient id="vc-slime-shine" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".9"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
      <filter id="vc-slime-shadow" x="-40%" y="-40%" width="180%" height="190%"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <ellipse className="vc-slime-shadow" cx="50" cy="84" rx="27" ry="5" fill="#1d4ed8" opacity=".16" filter="url(#vc-slime-shadow)"/>
    <path className="vc-slime-foot vc-slime-foot-left" d="M31 73q-9 8-3 12 8 3 15-5" fill="#60a5fa"/>
    <path className="vc-slime-foot vc-slime-foot-right" d="M58 78q8 9 15 4 4-5-5-10" fill="#60a5fa"/>
    <path className="vc-slime-body" d="M17 68C14 48 19 22 34 16c7-3 13 1 17 7 7-10 18-11 27-3 11 10 12 30 8 49-2 10-12 14-32 14S20 80 17 68Z" fill="url(#vc-slime-fill)" stroke="#2563eb" strokeOpacity=".22" strokeWidth="1.5"/>
    <path d="M26 38c2-10 8-17 17-18" fill="none" stroke="url(#vc-slime-shine)" strokeWidth="5" strokeLinecap="round" opacity=".8"/>
    <ellipse cx="36" cy="51" rx="3.8" ry="5.2" fill="#0b132b"/><ellipse cx="64" cy="51" rx="3.8" ry="5.2" fill="#0b132b"/>
    <circle cx="37" cy="49" r="1.3" fill="#fff"/><circle cx="65" cy="49" r="1.3" fill="#fff"/>
    <path d="M43 62q7 8 14 0" fill="none" stroke="#0b132b" strokeWidth="2.8" strokeLinecap="round"/>
    <ellipse cx="27" cy="61" rx="5" ry="2.8" fill="#fb91b8" opacity=".58"/><ellipse cx="73" cy="61" rx="5" ry="2.8" fill="#fb91b8" opacity=".58"/>
    <path d="M70 26q5 3 7 9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".65"/>
  </svg>;
}

function PaintSplash() {
  return <svg className="vc-slime-splash" viewBox="0 0 180 110" aria-hidden="true">
    <g fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round">
      <path className="vc-splash-ring" d="M22 65c20-25 116-25 136 0"/><path className="vc-splash-ring vc-splash-ring-two" d="M40 70c17-15 83-15 100 0"/>
    </g>
    <g fill="#38bdf8"><circle className="vc-splash-drop vc-drop-a" cx="25" cy="35" r="4"/><circle className="vc-splash-drop vc-drop-b" cx="150" cy="32" r="3.5"/><circle className="vc-splash-drop vc-drop-c" cx="90" cy="12" r="3"/><circle className="vc-splash-drop vc-drop-d" cx="55" cy="20" r="2.5"/></g>
  </svg>;
}

export default function VentoraLoader({
  active=true,
  variant='convergence',
  motionVariant='slime-stamp',
  status,
  className='',
  replayKey=0
}:Props) {
  const reduceMotion=useReducedMotion();
  const chosen=variant==='auto'?'pulse':variant;
  const message=status||copy[chosen];
  const [visible,setVisible]=useState(active);
  const startedAt=useRef(Date.now());
  const exitTimer=useRef<number|undefined>(undefined);

  useEffect(()=>{
    if(exitTimer.current!==undefined) window.clearTimeout(exitTimer.current);
    if(active){
      startedAt.current=Date.now();
      setVisible(true);
    } else {
      const minimum=reduceMotion?120:2380;
      const remaining=Math.max(0,minimum-(Date.now()-startedAt.current));
      exitTimer.current=window.setTimeout(()=>setVisible(false),remaining);
    }
    return ()=>{if(exitTimer.current!==undefined)window.clearTimeout(exitTimer.current);};
  },[active,chosen,motionVariant,replayKey,reduceMotion]);

  return <AnimatePresence>
    {visible&&<motion.div
      key={String(replayKey)+'-'+chosen+'-'+motionVariant}
      className={'vc-loader vc-loader-slime vc-loader-'+chosen+' vc-motion-'+motionVariant+' '+className}
      role="status" aria-live="polite" aria-label={message}
      initial={reduceMotion?{opacity:1,scale:1}:{opacity:0,scale:1.025}}
      animate={{opacity:1,scale:1}}
      exit={reduceMotion?{opacity:0}:{opacity:0,scale:.965,filter:'blur(2px)'}}
      transition={{duration:reduceMotion?.16:0.42,ease:[.22,.72,.22,1]}}>
      <div className="vc-loader-canvas">
        <div className="vc-loader-lockup">
          <Wordmark/>
          <span className="vc-loader-sweep"/>
        </div>
        <div className="vc-slime-stage"><SlimeCharacter/><PaintSplash/></div>
        <span className="vc-slime-impact-glow" aria-hidden="true"/>
      </div>
      <div className="vc-loader-footer">
        <div className="vc-loader-progress"><i/></div>
        <div className="vc-loader-status"><span className="vc-loader-live-dot"/>{message}</div>
        <span className="vc-loader-index">VENTORA CONNECT <b>·</b> PRIVATE NETWORK</span>
      </div>
    </motion.div>}
  </AnimatePresence>;
}
