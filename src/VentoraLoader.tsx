import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export type VentoraLoaderVariant = 'blueprint' | 'pulse' | 'convergence' | 'auto';
type Props = { active?: boolean; variant?: VentoraLoaderVariant; status?: string; intro?: boolean };

let variantCursor = 0;
const variants: Exclude<VentoraLoaderVariant, 'auto'>[] = ['blueprint', 'pulse', 'convergence'];
const statusCopy: Record<Exclude<VentoraLoaderVariant, 'auto'>, string[]> = {
  blueprint: ['VERIFYING DEAL ROOM...', 'ALIGNING SECURE ACCESS...', 'PREPARING YOUR WORKSPACE...'],
  pulse: ['CONNECTING VENTURES...', 'ESTABLISHING PRIVATE LINK...', 'BRINGING YOUR NETWORK ONLINE...'],
  convergence: ['SYNCING INVESTOR PIPELINE...', 'ALIGNING OPPORTUNITIES...', 'FINALISING YOUR VIEW...']
};

function BrandOrbit() {
  return <div className="ventora-brand-loader" aria-hidden="true">
    <span className="brand-loader-orbit orbit-one"/><span className="brand-loader-orbit orbit-two"/><span className="brand-loader-orbit orbit-three"/>
    <span className="brand-loader-particle particle-one"/><span className="brand-loader-particle particle-two"/>
    <img src={import.meta.env.BASE_URL + 'ventora-icon.svg'} alt=""/><i className="brand-loader-flare"/>
  </div>;
}
function BlueprintArt() {
  return <div className="vc-loader-art vc-blueprint-art" aria-hidden="true">
    <span className="vc-blueprint-frame"/><span className="vc-blueprint-axis vc-axis-x"/><span className="vc-blueprint-axis vc-axis-y"/>
    <span className="vc-blueprint-corner corner-a"/><span className="vc-blueprint-corner corner-b"/>
    <span className="vc-blueprint-corner corner-c"/><span className="vc-blueprint-corner corner-d"/><span className="vc-blueprint-sweep"/>
  </div>;
}
function PulseArt() {
  return <div className="vc-loader-art vc-pulse-art" aria-hidden="true">
    <span className="vc-pulse-ring ring-a"/><span className="vc-pulse-ring ring-b"/><span className="vc-pulse-ring ring-c"/>
    <span className="vc-pulse-node node-a"/><span className="vc-pulse-node node-b"/><span className="vc-pulse-node node-c"/><span className="vc-pulse-node node-d"/>
  </div>;
}
function ConvergenceArt() {
  return <div className="vc-loader-art vc-convergence-art" aria-hidden="true">
    <span className="vc-converge-line line-left"/><span className="vc-converge-line line-right"/>
    <span className="vc-converge-trail trail-left"/><span className="vc-converge-trail trail-right"/>
    <span className="vc-converge-guide guide-top"/><span className="vc-converge-guide guide-bottom"/>
  </div>;
}

export default function VentoraLoader({ active = true, variant = 'auto', status, intro = false }: Props) {
  const reduceMotion = useReducedMotion();
  const chosen = useMemo(() => {
    if (variant !== 'auto') return variant;
    const next = variants[variantCursor % variants.length];
    variantCursor += 1;
    return next;
  }, [variant]);
  const [copyIndex, setCopyIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    if (active) { startedAt.current = Date.now(); setVisible(true); return; }
    if (startedAt.current === null) { setVisible(false); return; }
    const remaining = Math.max(0, (intro ? 2750 : 850) - (Date.now() - startedAt.current));
    const timer = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(timer);
  }, [active, intro]);
  useEffect(() => {
    if (!visible || reduceMotion || status || intro) return;
    const id = window.setInterval(() => setCopyIndex(index => (index + 1) % 3), 620);
    return () => window.clearInterval(id);
  }, [visible, reduceMotion, status, intro]);
  const messages = statusCopy[chosen];
  const copy = status || (intro ? 'WHERE AMBITION MEETS OPPORTUNITY' : messages[copyIndex]);
  return <AnimatePresence>
    {visible && <motion.div className={'vc-loader vc-loader-' + chosen + (intro ? ' vc-loader-intro' : '')} role="status" aria-live="polite" aria-label={copy}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: .985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.018, filter: 'blur(3px)' }}
      transition={{ duration: reduceMotion ? .12 : .34, ease: [ .22, .72, .22, 1 ] }}>
      <div className="vc-loader-canvas">
        {chosen === 'blueprint' ? <BlueprintArt/> : chosen === 'pulse' ? <PulseArt/> : <ConvergenceArt/>}
        <div className="vc-loader-lockup">
          <BrandOrbit/>
          <div className="vc-loader-wordmark" aria-label="Ventora Connect">
            <span className="vc-loader-ventora">{'VENTORA'.split('').map((letter, index) => <motion.span key={index} initial={reduceMotion ? false : { opacity: 0, y: 24, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: .12 + index * .075, duration: .46, ease: [.16,1,.3,1] }}>{letter}</motion.span>)}</span>
            <motion.span className="vc-loader-connect" initial={reduceMotion ? false : { opacity: 0, letterSpacing: '.7em' }} animate={{ opacity: 1, letterSpacing: '.38em' }} transition={{ delay: .72, duration: .65 }}>CONNECT</motion.span>
          </div>
          {intro && <motion.span className="vc-loader-tagline" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:1.35,duration:.45}}>WHERE AMBITION MEETS OPPORTUNITY</motion.span>}
        </div>
      </div>
      <div className="vc-loader-footer">
        {!intro && <div className="vc-loader-status"><span className="vc-loader-live-dot"/><span key={copy} className="vc-loader-copy">{copy}</span></div>}
        <div className="vc-loader-progress" aria-hidden="true"><i/></div>
        <span className="vc-loader-index">{intro ? 'VENTORA CONNECT' : 'PRIVATE DEAL ROOM'} <b>·</b> {intro ? 'BUILT FOR AMBITION' : 'SECURE NETWORK'}</span>
      </div>
    </motion.div>}
  </AnimatePresence>;
}
