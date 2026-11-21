import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export type VentoraLoaderVariant = 'blueprint' | 'pulse' | 'convergence' | 'auto';
type Props = { active?: boolean; variant?: VentoraLoaderVariant; status?: string; };

let variantCursor = 0;
const variants: Exclude<VentoraLoaderVariant,'auto'>[] = ['blueprint','pulse','convergence'];
const statusCopy: Record<Exclude<VentoraLoaderVariant,'auto'>, string[]> = {
  blueprint: ['VERIFYING DEAL ROOM...', 'ALIGNING SECURE ACCESS...', 'PREPARING YOUR WORKSPACE...'],
  pulse: ['CONNECTING VENTURES...', 'ESTABLISHING PRIVATE LINK...', 'BRINGING YOUR NETWORK ONLINE...'],
  convergence: ['SYNCING INVESTOR PIPELINE...', 'ALIGNING OPPORTUNITIES...', 'FINALISING YOUR VIEW...']
};

function BrandWordmark() {
  return <div className="vc-loader-wordmark" aria-label="Ventora Connect">
    <span className="vc-loader-ventora">V<span className="vc-loader-e"><i/><i/><i/></span>NTORA</span>
    <span className="vc-loader-connect">CONNECT</span>
  </div>;
}

function BlueprintArt() {
  return <div className="vc-loader-art vc-blueprint-art" aria-hidden="true">
    <span className="vc-blueprint-frame"/><span className="vc-blueprint-axis vc-axis-x"/><span className="vc-blueprint-axis vc-axis-y"/>
    <span className="vc-blueprint-corner corner-a"/><span className="vc-blueprint-corner corner-b"/>
    <span className="vc-blueprint-corner corner-c"/><span className="vc-blueprint-corner corner-d"/>
    <span className="vc-blueprint-sweep"/>
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

export default function VentoraLoader({ active = true, variant = 'auto', status }: Props) {
  const reduceMotion = useReducedMotion();
  const chosen = useMemo(() => {
    if (variant !== 'auto') return variant;
    const next = variants[variantCursor % variants.length];
    variantCursor += 1;
    return next;
  }, [variant]);
  const [copyIndex, setCopyIndex] = useState(0);
  useEffect(() => {
    if (!active || reduceMotion) return;
    const id = window.setInterval(() => setCopyIndex(index => (index + 1) % 3), 620);
    return () => window.clearInterval(id);
  }, [active, reduceMotion]);
  const messages = statusCopy[chosen];
  const copy = status || messages[copyIndex];
  return <AnimatePresence>
    {active && <motion.div className={`vc-loader vc-loader-${chosen}`} role="status" aria-live="polite" aria-label={copy}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: .985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.018, filter: 'blur(3px)' }}
      transition={{ duration: reduceMotion ? .12 : .34, ease: [ .22, .72, .22, 1 ] }}>
      <div className="vc-loader-canvas">
        {chosen === 'blueprint' ? <BlueprintArt/> : chosen === 'pulse' ? <PulseArt/> : <ConvergenceArt/>}
        <div className="vc-loader-lockup"><BrandWordmark/><span className="vc-loader-tagline">PRIVATE DEAL ROOM</span></div>
      </div>
      <div className="vc-loader-footer"><div className="vc-loader-status"><span className="vc-loader-live-dot"/><span key={copy} className="vc-loader-copy">{copy}</span></div><div className="vc-loader-progress" aria-hidden="true"><i/></div><span className="vc-loader-index">VENTORA CONNECT <b>·</b> SECURE NETWORK</span></div>
    </motion.div>}
  </AnimatePresence>;
}
