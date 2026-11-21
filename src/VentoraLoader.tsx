import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export type VentoraLoaderVariant = 'blueprint' | 'pulse' | 'convergence' | 'auto';
type Props = { active?: boolean; variant?: VentoraLoaderVariant; status?: string; intro?: boolean };

const statusCopy = [
  'CONNECTING VENTORA NETWORK...',
  'ALIGNING OPPORTUNITIES...',
  'PREPARING YOUR WORKSPACE...',
  'SECURING YOUR PRIVATE DEAL ROOM...',
  'SYNCING YOUR INVESTOR PIPELINE...'
];

function BrandOrbit() {
  return <div className="ventora-brand-loader" aria-hidden="true">
    <span className="brand-loader-orbit brand-orbit-one"/>
    <span className="brand-loader-orbit brand-orbit-two"/>
    <span className="brand-loader-orbit brand-orbit-three"/>
    <span className="brand-loader-particle particle-one"/>
    <span className="brand-loader-particle particle-two"/>
    <img src={import.meta.env.BASE_URL + 'ventora-icon.svg'} alt=""/>
    <i className="brand-loader-flare"/>
  </div>;
}

function Typewriter({ text, disabled }: { text: string; disabled: boolean }) {
  return <span className="vc-loader-copy" aria-label={text}>
    {disabled ? text : text.split('').map((char, index) => (
      <motion.span key={index} initial={{ opacity: 0, y: 5, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: index * .018, duration: .16, ease: 'easeOut' }}>{char === ' ' ? '\u00a0' : char}</motion.span>
    ))}
  </span>;
}

export default function VentoraLoader({ active = true, status, intro = false }: Props) {
  const reduceMotion = useReducedMotion();
  const [copyIndex, setCopyIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (active) { startedAt.current = Date.now(); setVisible(true); return; }
    if (startedAt.current === null) { setVisible(false); return; }
    const remaining = Math.max(0, (intro ? 2450 : 950) - (Date.now() - startedAt.current));
    const timer = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(timer);
  }, [active, intro]);

  useEffect(() => {
    if (!visible || reduceMotion || status || intro) return;
    const id = window.setInterval(() => setCopyIndex(index => (index + 1) % statusCopy.length), 1150);
    return () => window.clearInterval(id);
  }, [visible, reduceMotion, status, intro]);

  const copy = status || (intro ? 'WHERE AMBITION MEETS OPPORTUNITY' : statusCopy[copyIndex]);
  return <AnimatePresence>
    {visible && <motion.div className={'vc-loader vc-loader-original' + (intro ? ' vc-loader-intro' : '')} role="status" aria-live="polite" aria-label={copy}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: .985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.018, filter: 'blur(3px)' }}
      transition={{ duration: reduceMotion ? .12 : .34, ease: [.22,.72,.22,1] }}>
      <div className="vc-loader-brand">
        <BrandOrbit/>
        <div className="vc-loader-wordmark" aria-label="Ventora Connect">
          <span className="vc-loader-ventora">{'VENTORA'.split('').map((letter, index) => <motion.span key={index} initial={reduceMotion ? false : { opacity: 0, y: 22, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: .12 + index * .075, duration: .48, ease: [.16,1,.3,1] }}>{letter}</motion.span>)}</span>
          <motion.span className="vc-loader-connect" initial={reduceMotion ? false : { opacity: 0, letterSpacing: '.72em' }} animate={{ opacity: 1, letterSpacing: '.38em' }} transition={{ delay: .68, duration: .68, ease: [.16,1,.3,1] }}>CONNECT</motion.span>
          {intro && <motion.span className="vc-loader-tagline" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:1.35,duration:.5}}>WHERE AMBITION MEETS OPPORTUNITY</motion.span>}
        </div>
      </div>
      <div className="vc-loader-footer">
        {!intro && <div className="vc-loader-status"><span className="vc-loader-live-dot"/><Typewriter text={copy} disabled={!!reduceMotion}/></div>}
        <div className="vc-loader-progress" aria-hidden="true"><i/></div>
        <span className="vc-loader-index">VENTORA CONNECT <b>·</b> {intro ? 'BUILT FOR AMBITION' : 'PRIVATE DEAL ROOM'}</span>
      </div>
    </motion.div>}
  </AnimatePresence>;
}
