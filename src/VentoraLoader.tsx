import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

export type VentoraLoaderVariant = 'blueprint' | 'pulse' | 'convergence' | 'auto';
type Props = { active?: boolean; variant?: VentoraLoaderVariant; status?: string; className?: string };

const copy: Record<Exclude<VentoraLoaderVariant,'auto'>,string> = {
  blueprint: 'VERIFYING DEAL ROOM...',
  pulse: 'CONNECTING VENTURES...',
  convergence: 'SYNCING INVESTOR PIPELINE...'
};

function Wordmark(){
  const letters: ReactNode[] = ['V', <span className="vc-loader-e" aria-label="E"><i/><i/><i/></span>, 'N','T','O','R','A'];
  return <div className="vc-loader-wordmark" aria-label="VENTORA CONNECT">
    <div className="vc-loader-ventora">{letters.map((letter,index)=><span className="vc-loader-letter" key={index}>{letter}</span>)}</div>
    <div className="vc-loader-connect">CONNECT</div>
  </div>;
}

function BlueprintArt(){return <svg className="vc-loader-art vc-blueprint-art" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <defs><pattern id="vc-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#93c5fd" strokeWidth=".65" opacity=".48"/></pattern><linearGradient id="vc-draw" x1="0" x2="1"><stop stopColor="#93c5fd" stopOpacity="0"/><stop offset=".5" stopColor="#2563eb" stopOpacity=".8"/><stop offset="1" stopColor="#93c5fd" stopOpacity="0"/></linearGradient></defs>
  <rect x="35" y="20" width="570" height="320" fill="url(#vc-grid)" opacity=".65"/><path className="vc-draft-line" d="M60 180H580M320 34V326M90 80H550V280H90Z" fill="none" stroke="#60a5fa" strokeWidth="1" strokeDasharray="5 8"/><path className="vc-draft-dimension" d="M90 60V45M550 60V45M90 52H550M70 80H55M70 280H55M62 80V280" fill="none" stroke="#3b82f6" strokeWidth="1"/><path className="vc-draft-sweep" d="M90 52H550" stroke="url(#vc-draw)" strokeWidth="2"/><path d="M90 80h18M90 80v18M550 80h-18M550 80v18M90 280h18M90 280v-18M550 280h-18M550 280v-18" stroke="#2563eb" strokeWidth="1.5" fill="none"/>
</svg>}
function PulseArt(){return <svg className="vc-loader-art vc-pulse-art" viewBox="0 0 640 360" aria-hidden="true">
  <g className="vc-mesh" fill="none" stroke="#93c5fd" strokeWidth="1"><path d="M90 80L210 125 320 180 440 100 550 80M80 260L210 215 320 180 445 245 560 270M210 125L210 215M440 100L445 245M90 80L80 260M550 80L560 270M90 80L320 180 550 80M80 260L320 180 560 270"/></g>
  <g className="vc-pulse-rings" fill="none" stroke="#2563eb"><circle cx="320" cy="180" r="38"/><circle cx="320" cy="180" r="38"/><circle cx="320" cy="180" r="38"/></g>
  <g fill="#2563eb"><circle className="vc-node" cx="90" cy="80" r="3"/><circle className="vc-node" cx="550" cy="80" r="3"/><circle className="vc-node" cx="80" cy="260" r="3"/><circle className="vc-node" cx="560" cy="270" r="3"/><circle className="vc-node" cx="210" cy="125" r="3"/><circle className="vc-node" cx="445" cy="245" r="3"/></g>
</svg>}
function ConvergenceArt(){return <svg className="vc-loader-art vc-convergence-art" viewBox="0 0 640 360" aria-hidden="true">
  <g fill="none" stroke="#60a5fa" strokeWidth="1"><path className="vc-trail vc-trail-a" d="M24 90L180 150 320 180"/><path className="vc-trail vc-trail-b" d="M616 90L460 150 320 180"/><path className="vc-trail vc-trail-c" d="M24 270L180 210 320 180"/><path className="vc-trail vc-trail-d" d="M616 270L460 210 320 180"/><path d="M320 28V95M320 265V332M42 180H110M530 180H598" strokeDasharray="3 7"/><path d="M305 180h30M320 165v30" stroke="#2563eb" strokeWidth="1.5"/></g>
  <g className="vc-crosshairs" stroke="#2563eb" strokeWidth="1"><path d="M70 70h16M78 62v16M554 70h16M562 62v16M70 290h16M78 282v16M554 290h16M562 282v16"/></g>
</svg>}

export default function VentoraLoader({active=true,variant='convergence',status,className=''}:Props){
 const reduceMotion=useReducedMotion();
 const chosen=variant==='auto'?'pulse':variant;
 const message=status||copy[chosen];
 const art=chosen==='blueprint'?<BlueprintArt/>:chosen==='pulse'?<PulseArt/>:<ConvergenceArt/>;
 return <AnimatePresence>
  {active&&<motion.div className={'vc-loader vc-loader-'+chosen+' '+className} role="status" aria-live="polite" aria-label={message}
    initial={reduceMotion?{opacity:1}:{opacity:0,scale:1.025}}
    animate={{opacity:1,scale:1}}
    exit={reduceMotion?{opacity:0}:{opacity:0,scale:.965,filter:'blur(2px)'}}
    transition={{duration:reduceMotion?.12:1.55,ease:[.22,.72,.22,1]}}>
    <div className="vc-loader-canvas">{art}<div className="vc-loader-lockup"><Wordmark/><span className="vc-loader-sweep"/></div></div>
    <div className="vc-loader-footer"><div className="vc-loader-progress"><i/></div><div className="vc-loader-status"><span className="vc-loader-live-dot"/>{message}</div><span className="vc-loader-index">VENTORA CONNECT <b>·</b> PRIVATE NETWORK</span></div>
  </motion.div>}
 </AnimatePresence>;
}
