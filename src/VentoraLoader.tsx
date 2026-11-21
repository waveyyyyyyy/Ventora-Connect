import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export type VentoraLoaderVariant = 'blueprint' | 'pulse' | 'convergence' | 'auto';
type Props = { active?: boolean; variant?: VentoraLoaderVariant; status?: string; };

const statusCopy = [
  'CONNECTING VENTORA NETWORK...',
  'ALIGNING OPPORTUNITIES...',
  'PREPARING YOUR WORKSPACE...'
];

function BrandOrbit() {
  return <div className="ventora-brand-loader" aria-hidden="true">
    <span className="brand-loader-orbit orbit-one"/>
    <span className="brand-loader-orbit orbit-two"/>
    <span className="brand-loader-orbit orbit-three"/>
    <span className="brand-loader-particle particle-one"/>
    <span className="brand-loader-particle particle-two"/>
    <img src={import.meta.env.BASE_URL + 'ventora-icon.svg'} alt=""/>
    <i className="brand-loader-flare"/>
  </div>;
}

export default function VentoraLoader({ active = true, status }: Props) {
  const reduceMotion = useReducedMotion();
  const [copyIndex, setCopyIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (active) { startedAt.current = Date.now(); setVisible(true); return; }
    if (startedAt.current === null) { setVisible(false); return; }
    const remaining = Math.max(0, 850 - (Date.now() - startedAt.current));
    const timer = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (!visible || reduceMotion) return;
    const id = window.setInterval(() => setCopyIndex(index => (index + 1) % statusCopy.length), 900);
    return () => window.clearInterval(id);
  }, [visible, reduceMotion]);

  const copy = status || statusCopy[copyIndex];
  return <AnimatePresence>
    {visible && <motion.div className="vc-loader" role="status" aria-live="polite" aria-label={copy}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? .12 : .3, ease: [ .22, .72, .22, 1 ] }}>
      <div className="vc-loader-brand">
        <BrandOrbit/>
        <motion.div className="vc-loader-wordmark" aria-label="Ventora Connect">
          <span className="vc-loader-ventora">{'VENTORA'.split('').map((letter, index) => <motion.span key={index} initial={reduceMotion ? false : { opacity: 0, y: 18, filter: 'blur(5px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: .12 + index * .065, duration: .42 }}>{letter}</motion.span>)}</span>
          <motion.span className="vc-loader-connect" initial={reduceMotion ? false : { opacity: 0, letterSpacing: '.7em' }} animate={{ opacity: 1, letterSpacing: '.38em' }} transition={{ delay: .45, duration: .6 }}>CONNECT</motion.span>
        </motion.div>
      </div>
      <div className="vc-loader-footer">
        <div className="vc-loader-status"><span className="vc-loader-live-dot"/><span key={copy} className="vc-loader-copy">{copy}</span></div>
        <div className="vc-loader-progress" aria-hidden="true"><i/></div>
        <span className="vc-loader-index">PRIVATE DEAL ROOM <b>·</b> SECURE NETWORK</span>
      </div>
    </motion.div>}
  </AnimatePresence>;
}
