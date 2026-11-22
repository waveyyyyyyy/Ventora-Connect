import { useEffect, useMemo, useState } from 'react';
import { supabase, restoreUserSession } from './lib/supabase';
import { Bug, Copy, X, ChevronDown, ChevronUp } from 'lucide-react';

type LogItem = { time: string; kind: string; message: string; source?: string; status?: number };
const MAX_LOGS = 80;
const redact = (value: unknown) => {
  let text = typeof value === 'string' ? value : (() => { try { return JSON.stringify(value); } catch { return String(value); } })();
  return text
    .replace(/Bearer\\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+/g, '[token redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi, '[email redacted]')
    .slice(0, 700);
};
export default function DebugPanel() {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const user = await restoreUserSession();
        if (!active || !user || !supabase) return;
        const { data, error } = await supabase.rpc('is_admin');
        if (active && !error && data === true) setAllowed(true);
      } catch { /* Debug tooling must never affect the app. */ }
    };
    void check();
    const { data: auth } = supabase?.auth.onAuthStateChange(() => { void check(); }) ?? { data: { subscription: { unsubscribe() {} } } };
    return () => { active = false; auth.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const add = (item: LogItem) => setLogs(previous => [...previous, item].slice(-MAX_LOGS));
    const onError = (event: ErrorEvent) => add({
      time: new Date().toISOString(), kind: 'JavaScript error',
      message: redact(event.message || 'Unknown window error'),
      source: event.filename ? event.filename.split('?')[0].slice(-160) : undefined
    });
    const onRejection = (event: PromiseRejectionEvent) => add({
      time: new Date().toISOString(), kind: 'Unhandled promise rejection',
      message: redact(event.reason instanceof Error ? event.reason.message : event.reason)
    });
    const originalFetch = window.fetch.bind(window);
    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET')).toUpperCase();
      try {
        const response = await originalFetch(input, init);
        if (!response.ok) add({
          time: new Date().toISOString(), kind: 'HTTP request failed',
          message: method + ' ' + new URL(rawUrl, window.location.href).pathname + ' returned ' + response.status,
          source: new URL(rawUrl, window.location.href).origin,
          status: response.status
        });
        return response;
      } catch (error) {
        add({
          time: new Date().toISOString(), kind: 'Network request failed',
          message: method + ' ' + (() => { try { return new URL(rawUrl, window.location.href).pathname; } catch { return '[unknown path]'; } })() + ': ' + redact(error instanceof Error ? error.message : error)
        });
        throw error;
      }
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    window.fetch = wrappedFetch;
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    };
  }, [allowed]);

  const report = useMemo(() => ({
    app: 'Ventora Connect diagnostic report',
    capturedAt: new Date().toISOString(),
    page: window.location.origin + window.location.pathname,
    browser: navigator.userAgent,
    viewport: window.innerWidth + 'x' + window.innerHeight,
    online: navigator.onLine,
    totalCaptured: logs.length,
    logs: logs.slice(-MAX_LOGS)
  }), [logs]);

  if (!allowed) return null;
  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const area = document.createElement('textarea');
      area.value = JSON.stringify(report, null, 2);
      document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
      setCopied(true); window.setTimeout(() => setCopied(false), 2200);
    }
  };
  const panelStyle: React.CSSProperties = { position: 'fixed', right: 14, bottom: 14, zIndex: 99999, fontFamily: 'system-ui,sans-serif' };
  const buttonStyle: React.CSSProperties = { border: '1px solid #526071', borderRadius: 999, background: '#111827', color: 'white', padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, boxShadow: '0 8px 30px #0005', cursor: 'pointer' };
  return <div style={panelStyle}>
    {!open ? <button type="button" style={buttonStyle} onClick={() => setOpen(true)}><Bug size={17}/> Debug <span style={{background:'#ef4444',borderRadius:99,minWidth:19,textAlign:'center',fontSize:11,padding:'2px 5px'}}>{logs.length}</span></button> :
    <section style={{width:'min( min(92vw, 390px), 390px)', maxHeight:'min(72vh,620px)', overflow:'hidden', border:'1px solid #475569', borderRadius:18, background:'#0f172a', color:'#f8fafc', boxShadow:'0 18px 60px #0008'}}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:14,borderBottom:'1px solid #334155'}}>
        <div style={{display:'flex',alignItems:'center',gap:9}}><Bug size={18}/><strong>Private debug panel</strong><span style={{fontSize:11,color:'#94a3b8'}}>ADMIN</span></div>
        <button type="button" aria-label="Close debug panel" onClick={()=>setOpen(false)} style={{background:'transparent',border:0,color:'white',padding:4}}><X size={19}/></button>
      </header>
      <div style={{padding:14,display:'grid',gap:10}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#cbd5e1'}}><span>Captured events</span><b>{logs.length}</b></div>
        <div style={{display:'flex',gap:8}}>
          <button type="button" onClick={copyReport} style={{...buttonStyle,background:'#a3e635',color:'#14210a',border:0,flex:1,justifyContent:'center'}}><Copy size={15}/>{copied?'Copied!':'Copy diagnostic report'}</button>
          <button type="button" onClick={()=>setLogs([])} style={{...buttonStyle,background:'#1e293b',fontSize:12,padding:'9px 11px'}}>Clear</button>
        </div>
        <button type="button" onClick={()=>setExpanded(v=>!v)} style={{display:'flex',justifyContent:'space-between',background:'transparent',color:'#cbd5e1',border:0,padding:'4px 0',fontSize:12}}>
          Recent errors {expanded?<ChevronDown size={16}/>:<ChevronUp size={16}/>}
        </button>
        {expanded&&<div style={{overflowY:'auto',maxHeight:260,display:'grid',gap:8}}>
          {logs.length===0?<p style={{fontSize:12,color:'#94a3b8'}}>No errors captured yet. Reproduce the problem while this panel is enabled.</p>:logs.slice().reverse().map((item,index)=><article key={index} style={{background:'#1e293b',borderRadius:9,padding:9,fontSize:11}}>
            <b style={{color:'#fca5a5'}}>{item.kind}</b><div style={{marginTop:4,overflowWrap:'anywhere'}}>{item.message}</div><small style={{color:'#94a3b8'}}>{new Date(item.time).toLocaleTimeString()}</small>
          </article>)}
        </div>}
        <p style={{margin:0,fontSize:10,lineHeight:1.5,color:'#94a3b8'}}>Captures browser errors and failed HTTP requests. Does not collect request bodies, passwords, access tokens or message contents. Copy the report and paste it into your ChatGPT chat.</p>
      </div>
    </section>}
  </div>;
}
