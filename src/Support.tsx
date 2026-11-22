import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase,restoreUserSession} from './lib/supabase';
import {LifeBuoy,Send,ShieldCheck,Clock3,MessageCircle,ChevronDown,ArrowUpRight,CheckCircle2,LockKeyhole,Headphones,Ticket,Activity,Plus} from 'lucide-react';
import MemberSectionLayout from './MemberSectionLayout';

const answers=[
 {q:'Is Ventora an investment platform?',a:'Ventora is a discovery and networking service. An expression of interest is not an investment commitment, and the platform does not transfer funds or execute securities transactions.'},
 {q:'What does a verified badge mean?',a:'Only a completed review can result in a verification badge. Verification does not guarantee a business or investment outcome.'},
 {q:'How do private documents work?',a:'Verification documents are stored in private storage and are accessible only to their owner and authorised reviewers.'},
 {q:'How do I get an update on my request?',a:'Your requests appear in Support history below. Keep the subject and message specific so the team can understand the issue and follow up in context.'}
];
const statusLabel=(value:string)=>String(value||'open').replace(/[_-]/g,' ').toUpperCase();
export default function Support(){
 const[user,setUser]=useState<any>(null),[authReady,setAuthReady]=useState(false),[rows,setRows]=useState<any[]>([]);
 const[subject,setSubject]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const[openAnswer,setOpenAnswer]=useState<number|null>(0),[filter,setFilter]=useState('all');
 useEffect(()=>{let active=true;async function load(){if(!supabase){setAuthReady(true);return;}const member=await restoreUserSession();if(!active)return;setUser(member);setAuthReady(true);if(member){const{data:tickets}=await supabase.from('support_tickets').select('id,subject,message,status,created_at').eq('user_id',member.id).order('created_at',{ascending:false}).limit(20);if(active)setRows(tickets||[]);}}load();return()=>{active=false}},[]);
 async function submit(e:any){e.preventDefault();if(!supabase||!user){setNotice('Please log in before submitting a support request.');return;}if(!subject.trim()||!message.trim())return;setBusy(true);setNotice('');const{error}=await supabase.from('support_tickets').insert({user_id:user.id,subject:subject.trim(),message:message.trim()});setBusy(false);if(error)setNotice(error.message);else{setNotice('Request received. Your support history has been refreshed.');setSubject('');setMessage('');const{data}=await supabase.from('support_tickets').select('id,subject,message,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20);setRows(data||[]);}}
 const filtered=useMemo(()=>rows.filter(t=>filter==='all'||(filter==='active'&&!['resolved','closed','complete','completed'].includes(String(t.status||'').toLowerCase()))||(filter==='resolved',['resolved','closed','complete','completed'].includes(String(t.status||'').toLowerCase()))),[rows,filter]);
 if(!authReady)return <MemberSectionLayout className="support-page" user={user}><main className="support-shell"><div className="support-kicker">VENTORA MEMBER CARE</div><h1>Loading <em>your care desk…</em></h1></main></MemberSectionLayout>;
 if(!user)return <div className="workspace-gate"><div className="workspace-gate-card"><h1>Member access<br/><em>required.</em></h1><p>Log in to contact Ventora support.</p><Link className="btn btn-dark" to="/login">Log in</Link></div></div>;
 return <MemberSectionLayout className="support-page" user={user}><main className="support-shell">
  <section className="support-hero-v2">
   <div className="support-hero-grid" aria-hidden="true"/><div className="support-architecture" aria-hidden="true"><i/><i/><i/><i/><span>VC / MEMBER STUDIO</span></div>
   <div className="support-hero-copy"><div className="support-kicker"><span className="support-live-dot"/> VENTORA MEMBER CARE <span className="support-kicker-rule"/></div><h1>Good support.<br/><em>Clear next steps.</em></h1><p>A considered space to ask, resolve and move forward. Your requests stay connected to your Ventora account.</p><div className="support-hero-meta"><span><ShieldCheck size={15}/> ACCOUNT-LINKED CARE</span><span><Clock3 size={15}/> TRACKABLE REQUESTS</span></div></div>
   <div className="support-hero-poster" aria-label="Member care promise"><div className="support-poster-top"><span>CARE STANDARD / 01</span><ArrowUpRight size={18}/></div><div className="support-poster-mark"><Headphones size={34}/></div><strong>Human<br/>attention.<br/><em>Thoughtful<br/>answers.</em></strong><div className="support-poster-bottom"><span>VENTORA CONNECT</span><span>MEMBER FIRST</span></div></div>
   <div className="support-hero-index">01 — MEMBER SERVICES</div>
  </section>
  <div className="support-section-heading"><div><span className="support-kicker">TALK TO OUR TEAM / 02</span><h2>Contact <em>support.</em></h2></div><p>Tell us what’s happening. We’ll keep the conversation tied to your account.</p></div>
  <section className="support-main-grid">
   <form className="support-form-v2" onSubmit={submit}>
    <div className="support-form-head"><div className="support-form-icon"><MessageCircle size={20}/></div><div><span>NEW SUPPORT REQUEST</span><h3>Let’s get it sorted.</h3></div><span className="support-secure"><LockKeyhole size={13}/> PRIVATE</span></div>
    <label className="support-field"><span>SUBJECT</span><input required maxLength={120} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="A short title for your request"/></label>
    <label className="support-field"><span>HOW CAN WE HELP?</span><textarea required rows={6} maxLength={5000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Share the details, what you expected, and what happened…"/></label>
    <div className="support-form-foot"><small>{message.length}/5000 characters · Linked to {user?.email||'your member account'}</small><button className="support-submit" disabled={busy||!subject.trim()||!message.trim()} type="submit">{busy?'Sending request…':'Submit request'} <Send size={16}/></button></div>
    {notice&&<div className={notice.startsWith('Request received')?'support-notice success':'support-notice'} role="status">{notice.startsWith('Request received')&&<CheckCircle2 size={16}/ >}{notice}</div>}
   </form>
   <aside className="support-editorial-side">
    <article className="support-care-card support-care-dark"><span>OUR PROMISE / 01</span><div className="support-care-number">01</div><h3>Clarity over<br/><em>complexity.</em></h3><p>Useful answers, clear ownership and a next step you can act on.</p><div className="support-care-line"/></article>
    <article className="support-care-card support-care-light"><span>BUILT AROUND YOU / 02</span><div className="support-care-number">02</div><h3>Your account.<br/><em>Your context.</em></h3><p>Requests are associated with your member account, keeping your support history in one place.</p><div className="support-care-line"/></article>
   </aside>
  </section>
  <section className="support-answers">
   <div className="support-section-heading"><div><span className="support-kicker">THE MEMBER PLAYBOOK / 03</span><h2>Quick <em>answers.</em></h2></div><p>Good to know before you send a request.</p></div>
   <div className="support-answer-stage"><div className="support-answer-intro"><span>HELP DESK / FAQ</span><strong>Find your<br/><em>starting point.</em></strong><small>SELECT A TOPIC TO OPEN THE ANSWER</small></div><div className="support-accordion">{answers.map((item,i)=><article className={'support-answer '+(openAnswer===i?'is-open':'')} key={item.q}><button type="button" aria-expanded={openAnswer===i} onClick={()=>setOpenAnswer(openAnswer===i?null:i)}><span className="support-answer-index">0{i+1}</span><strong>{item.q}</strong><ChevronDown size={18}/></button><div className="support-answer-body"><p>{item.a}</p></div></article>)}</div></div>
  </section>
  <section className="support-history-v2">
   <div className="support-section-heading"><div><span className="support-kicker">YOUR MEMBER RECORD / 04</span><h2>Your support <em>history.</em></h2></div><div className="support-history-total"><strong>{rows.length.toString().padStart(2,'0')}</strong><span>RECENT REQUESTS</span></div></div>
   <div className="support-history-toolbar"><div className="support-history-tabs" role="group" aria-label="Filter support requests">{[['all','All requests'],['active','In progress'],['resolved','Resolved']].map(([key,label])=><button type="button" key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}</div><span><Activity size={14}/> LIVE ACCOUNT HISTORY</span></div>
   <div className="support-ticket-list">{filtered.length?filtered.map((t,i)=><article className="support-ticket" key={t.id}><div className="support-ticket-index">{String(i+1).padStart(2,'0')}</div><div className="support-ticket-copy"><strong>{t.subject}</strong><small><Ticket size={12}/> {new Date(t.created_at).toLocaleString()}</small></div><span className={'support-ticket-status '+(['resolved','closed','complete','completed'].includes(String(t.status||'').toLowerCase())?'resolved':'active')}>{['resolved','closed','complete','completed'].includes(String(t.status||'').toLowerCase())?<CheckCircle2 size={13}/>:<span/>}{statusLabel(t.status)}</span></article>):<div className="support-empty"><LifeBuoy size={24}/><strong>{rows.length?'No requests in this filter.':'Your support timeline starts here.'}</strong><p>{rows.length?'Try another status filter to see your requests.':'When you submit a request, it will appear here with its latest status.'}</p><button type="button" onClick={()=>{setFilter('all');document.querySelector('.support-form-v2')?.scrollIntoView({behavior:'smooth',block:'center'});}}><Plus size={14}/> Create a request</button></div>}</div>
  </section>
  <footer className="support-footer-note"><span>VENTORA CONNECT / MEMBER CARE</span><span>BUILT ON TRUST. DESIGNED FOR CLARITY.</span></footer>
 </main></MemberSectionLayout>;
}
