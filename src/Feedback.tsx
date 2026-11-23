import {useCallback,useEffect,useMemo,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {supabase,restoreUserSession,requireActiveSession} from './lib/supabase';
import {Send,RefreshCw,ShieldCheck,Inbox} from 'lucide-react';
import WorkspaceNavigation from './WorkspaceNavigation';
import BrandLogo from './BrandLogo';
import VentoraFooter from './VentoraFooter';

type FeedbackStatus='open'|'in_review'|'planned'|'resolved'|'closed';
type FeedbackItem={id:string;user_id:string;category:string;title:string;description:string;priority:string;page_context:string|null;status:FeedbackStatus;created_at:string;updated_at:string;profiles?:{full_name?:string}|null};
type FeedbackReply={id:string;feedback_id:string;author_id:string;author_role:'member'|'admin';body:string;created_at:string};
const categories=['Suggestion','Bug Report','Feature Idea','Design & UX','Membership & Plans','Other'];
const statuses:FeedbackStatus[]=['open','in_review','planned','resolved','closed'];
const statusLabel=(s:string)=>({open:'Open',in_review:'In Review',planned:'Planned',resolved:'Resolved',closed:'Closed'} as Record<string,string>)[s]||s;
const dateLabel=(s:string)=>new Date(s).toLocaleString(undefined,{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});
const feedbackStyle=`
.vc-feedback{--f-ink:#0F2234;--f-navy:#132A3A;--f-teal:#245863;--f-teal2:#1E4D58;--f-green:#10B981;min-height:100dvh;position:relative;isolation:isolate;overflow-x:clip;color:var(--f-ink);background:#e9f0f0;padding-bottom:calc(38px + env(safe-area-inset-bottom))}
.vc-feedback:before{content:'';position:fixed;inset:0;z-index:-2;background:linear-gradient(180deg,rgba(241,247,247,.84),rgba(232,240,240,.82)),url('https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2200&q=85') center/cover no-repeat}
.vc-feedback:after{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(120deg,rgba(19,42,58,.04),transparent 48%,rgba(36,88,99,.07))}
.vc-feedback-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;min-height:64px;padding:10px clamp(14px,3vw,30px);background:rgba(255,255,255,.91);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(19,42,58,.12)}
.vc-feedback-back{width:40px;height:40px;display:grid;place-items:center;border:1px solid #d6e1e3;border-radius:13px;background:#fff;color:var(--f-teal)}
.vc-feedback-brand{font-size:14px;font-weight:900;letter-spacing:.16em;color:var(--f-navy)}.vc-feedback-brand small{display:block;margin-top:3px;font-size:8px;letter-spacing:.36em;color:#58717b}
.vc-feedback-wrap{width:min(1080px,100%);margin:0 auto;padding:clamp(18px,4vw,36px) clamp(13px,3vw,28px)}
.vc-feedback-hero{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.68);border-radius:24px;padding:clamp(20px,4vw,34px);background:linear-gradient(120deg,rgba(15,34,52,.91),rgba(30,77,88,.86)),url('https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1800&q=80') center 54%/cover;box-shadow:0 22px 60px rgba(15,34,52,.16);color:#fff}
.vc-feedback-kicker{font-size:9px;font-weight:900;letter-spacing:.22em;color:#b9d5d3}.vc-feedback-hero h1{margin:11px 0 8px;font:780 clamp(30px,5vw,48px)/1.04 Manrope,system-ui,sans-serif;letter-spacing:-.055em;color:#fff}.vc-feedback-hero h1 em{font-family:Georgia,serif;font-weight:500;color:#c7e3dc}.vc-feedback-hero p{max-width:620px;margin:0;color:#e0ebec;font-size:13px;line-height:1.7}
.vc-feedback-grid{display:grid;grid-template-columns:minmax(0,.88fr) minmax(0,1.12fr);gap:16px;margin-top:17px;align-items:start}
.vc-feedback-panel{min-width:0;border:1px solid rgba(19,42,58,.12);border-radius:19px;padding:clamp(14px,2.5vw,22px);background:rgba(255,255,255,.89);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 14px 40px rgba(15,34,52,.07)}
.vc-feedback-panel h2{margin:0;color:var(--f-ink);font-size:16px;letter-spacing:-.02em}.vc-feedback-sub{margin:5px 0 16px;color:#60747d;font-size:11px;line-height:1.6}
.vc-feedback-field{display:grid;gap:6px;margin:0 0 12px;color:#38525d;font-size:11px;font-weight:800}.vc-feedback-field input,.vc-feedback-field textarea,.vc-feedback-field select,.vc-feedback-toolbar input,.vc-feedback-toolbar select{width:100%;min-width:0;border:1px solid #d5e0e2;border-radius:11px;background:rgba(255,255,255,.94);padding:11px 12px;color:var(--f-ink);font:500 13px/1.5 inherit;outline:none}.vc-feedback-field textarea{min-height:125px;resize:vertical}.vc-feedback-field input:focus,.vc-feedback-field textarea:focus,.vc-feedback-field select:focus,.vc-feedback-toolbar input:focus,.vc-feedback-toolbar select:focus{border-color:#6c9698;box-shadow:0 0 0 3px rgba(36,88,99,.1)}
.vc-feedback-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.vc-feedback-submit{width:100%;min-height:45px;display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid var(--f-teal);border-radius:12px;background:linear-gradient(120deg,var(--f-teal),var(--f-teal2));color:#fff;font-size:12px;font-weight:850;cursor:pointer;transition:transform .18s,opacity .18s}.vc-feedback-submit:active{transform:translateY(1px)}.vc-feedback-submit:disabled{opacity:.55;cursor:wait}
.vc-feedback-notice{margin:0 0 12px;padding:11px 12px;border:1px solid #b9ddd0;border-radius:11px;background:#eff8f4;color:#155b49;font-size:12px;line-height:1.5}.vc-feedback-error{border-color:#e6c5bd;background:#fff5f2;color:#8a3d2e}
.vc-feedback-toolbar{display:flex;gap:8px;align-items:center;margin:13px 0}.vc-feedback-toolbar input{flex:1}.vc-feedback-toolbar select{width:auto;max-width:46%}
.vc-feedback-list{display:grid;gap:9px}.vc-feedback-item{width:100%;min-width:0;text-align:left;padding:14px;border:1px solid rgba(19,42,58,.12);border-radius:14px;background:rgba(255,255,255,.86);color:var(--f-ink);cursor:pointer;transition:border-color .18s,transform .18s,box-shadow .18s}.vc-feedback-item:hover,.vc-feedback-item.active{border-color:rgba(36,88,99,.45);box-shadow:0 8px 22px rgba(15,34,52,.07)}.vc-feedback-item:active{transform:translateY(1px)}.vc-feedback-item-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.vc-feedback-item h3{margin:0;font-size:13px;line-height:1.45;overflow-wrap:anywhere}.vc-feedback-item p{margin:7px 0 0;color:#5d707a;font-size:11px;line-height:1.6;overflow-wrap:anywhere}
.vc-feedback-meta{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:10px;color:#71818a;font-size:9px;font-weight:750;letter-spacing:.03em}
.vc-feedback-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid #d8e3e3;border-radius:999px;background:#f5f8f8;color:#385660;font-size:9px;font-weight:850;white-space:nowrap}.vc-feedback-pill.good{border-color:#b8ddd0;background:#eef8f3;color:#17634e}.vc-feedback-pill.warm{border-color:#e8d9bd;background:#fbf6eb;color:#80602b}
.vc-feedback-thread{margin-top:13px;border-top:1px solid #e0e8e8;padding-top:13px}.vc-feedback-message{padding:12px;border:1px solid #e0e8e8;border-radius:12px;background:rgba(247,250,250,.92);margin-bottom:9px}.vc-feedback-message.admin{border-color:#c6d9d8;background:#f0f6f5}.vc-feedback-message-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;color:#405963;font-size:10px;font-weight:850}.vc-feedback-message p{margin:0;color:#263f4b;font-size:12px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}
.vc-feedback-reply{display:grid;gap:9px;margin-top:12px}.vc-feedback-reply textarea{width:100%;min-height:80px;resize:vertical;border:1px solid #d5e0e2;border-radius:11px;padding:11px 12px;background:#fff;color:var(--f-ink);font:500 13px/1.5 inherit}
.vc-feedback-empty{padding:24px 14px;text-align:center;border:1px dashed #c8d6d8;border-radius:14px;color:#637780;font-size:12px;line-height:1.65}.vc-feedback-empty svg{display:block;margin:0 auto 9px;color:var(--f-teal)}
.vc-feedback-admin-toolbar{display:grid;grid-template-columns:1.2fr .8fr .8fr;gap:8px;margin:13px 0}.vc-feedback-admin-toolbar>*{min-width:0}
.vc-feedback-admin-card{border:1px solid rgba(19,42,58,.12);border-radius:15px;background:rgba(255,255,255,.9);padding:14px}
.vc-feedback-admin-card+.vc-feedback-admin-card{margin-top:10px}
.vc-feedback-admin-card .vc-feedback-thread{margin-top:12px}
@media(max-width:760px){.vc-feedback-grid{grid-template-columns:1fr}.vc-feedback-admin-toolbar{grid-template-columns:1fr 1fr}.vc-feedback-admin-toolbar input{grid-column:1/-1}}
@media(max-width:380px){.vc-feedback-row{grid-template-columns:1fr}.vc-feedback-item-head{gap:6px}.vc-feedback-toolbar{flex-wrap:wrap}.vc-feedback-toolbar select{max-width:none;flex:1}}
@media(prefers-reduced-motion:reduce){.vc-feedback-item,.vc-feedback-submit{transition:none}.vc-feedback-item:active,.vc-feedback-submit:active{transform:none}}
`;

export default function Feedback(){
 const nav=useNavigate();
 const[user,setUser]=useState<any>(null),[items,setItems]=useState<FeedbackItem[]>([]),[replies,setReplies]=useState<FeedbackReply[]>([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[category,setCategory]=useState('Suggestion'),[priority,setPriority]=useState('normal'),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[context,setContext]=useState(''),[reply,setReply]=useState('');
 const activeItem=items.find(x=>x.id===selected)||null;
 const load=useCallback(async()=>{
  if(!supabase){setError('Feedback is temporarily unavailable because the secure connection is not configured.');setLoading(false);return;}
  setError('');
  try{
   const current=await restoreUserSession();
   if(!current){nav('/login?next='+encodeURIComponent('/feedback'),{replace:true});return;}
   setUser(current);
   const{data,error:e}=await supabase.from('feedback_items').select('*').order('created_at',{ascending:false}).limit(100);
   if(e)throw e;
   const rows=(data||[]) as FeedbackItem[];
   setItems(rows);
   const ids=rows.map(x=>x.id);
   if(ids.length){const r=await supabase.from('feedback_replies').select('*').in('feedback_id',ids).order('created_at',{ascending:true});if(r.error)throw r.error;setReplies((r.data||[]) as FeedbackReply[]);}
   else setReplies([]);
   setSelected(old=>rows.some(x=>x.id===old)?old:rows[0]?.id||'');
  }catch(e:any){setError(e?.message||'Your feedback could not be loaded.');}
  finally{setLoading(false);}
 },[nav]);
 useEffect(()=>{void load()},[load]);
 async function submit(e:any){
  e.preventDefault();if(!supabase||!user)return;
  if(title.trim().length<4||description.trim().length<10){setError('Add a clear title and at least 10 characters of detail.');return;}
  setSending(true);setError('');setNotice('');
  try{await requireActiveSession(user.id);
   const{data,error:e}=await supabase.from('feedback_items').insert({user_id:user.id,category,title:title.trim(),description:description.trim(),priority,page_context:context.trim()||null}).select('*').single();
   if(e)throw e;
   setItems(old=>[data as FeedbackItem,...old]);setSelected(data.id);setTitle('');setDescription('');setContext('');setPriority('normal');setCategory('Suggestion');setNotice('Your feedback is in. The Ventora team can now review and reply in this thread.');
  }catch(e:any){setError(e?.message||'Your feedback could not be submitted. Please try again.');}
  finally{setSending(false);}
 }
 async function sendReply(e:any){
  e.preventDefault();if(!supabase||!user||!activeItem||!reply.trim())return;
  setSending(true);setError('');setNotice('');
  try{await requireActiveSession(user.id);
   const{data,error:e}=await supabase.from('feedback_replies').insert({feedback_id:activeItem.id,author_id:user.id,author_role:'member',body:reply.trim()}).select('*').single();
   if(e)throw e;setReplies(old=>[...old,data as FeedbackReply]);setReply('');setNotice('Your reply has been added to the conversation.');
  }catch(e:any){setError(e?.message||'Your reply could not be sent.');}
  finally{setSending(false);}
 }
 const threadReplies=replies.filter(x=>x.feedback_id===selected);
 return <div className="vc-feedback"><style>{feedbackStyle}</style><WorkspaceNavigation user={user}/><header className="vc-feedback-top"><BrandLogo to="/dashboard?tab=overview" className="vc-feedback-logo"/><div className="vc-feedback-brand">MEMBER FEEDBACK <small>VENTORA CONNECT / LISTENING ROOM</small></div></header>
  <main className="vc-feedback-wrap"><section className="vc-feedback-hero"><div className="vc-feedback-kicker">VENTORA / LISTENING ROOM</div><h1>Better together,<br/><em>built through feedback.</em></h1><p>Share what is working, tell us what needs attention, and keep the conversation going directly with the Ventora team.</p></section>
   <div className="vc-feedback-grid"><section className="vc-feedback-panel"><h2>Share your feedback</h2><p className="vc-feedback-sub">Suggestions, product ideas, bugs and experience notes all have a place here.</p>
    {notice&&<div className="vc-feedback-notice" role="status">{notice}</div>}{error&&<div className="vc-feedback-notice vc-feedback-error" role="alert">{error}</div>}
    <form onSubmit={submit}><label className="vc-feedback-field">Category<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></label>
     <label className="vc-feedback-field">Title<input required minLength={4} maxLength={140} value={title} onChange={e=>setTitle(e.target.value)} placeholder="A clear headline for your feedback"/></label>
     <label className="vc-feedback-field">Detailed description<textarea required minLength={10} maxLength={10000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="What happened, what did you expect, or what would make this better?"/></label>
     <div className="vc-feedback-row"><label className="vc-feedback-field">Priority<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="vc-feedback-field">Page / screen (optional)<input maxLength={180} value={context} onChange={e=>setContext(e.target.value)} placeholder="e.g. Business Directory"/></label></div>
     <button className="vc-feedback-submit" type="submit" disabled={sending||loading}><Send size={15}/>{sending?'Submitting…':'Send feedback'}</button>
    </form>
   </section>
   <section className="vc-feedback-panel"><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}><div><h2>Your feedback threads</h2><p className="vc-feedback-sub" style={{marginBottom:0}}>Private conversations between you and the Ventora team.</p></div><button className="vc-feedback-back" onClick={()=>void load()} aria-label="Refresh feedback" style={{flex:'0 0 auto'}}><RefreshCw size={16}/></button></div>
    {loading?<div className="vc-feedback-empty"><RefreshCw size={19}/>Loading your feedback…</div>:items.length===0?<div className="vc-feedback-empty"><Inbox size={24}/>No feedback yet. Your first note can start a useful conversation.</div>:<div className="vc-feedback-list" style={{marginTop:14}}>{items.map(item=><button type="button" key={item.id} onClick={()=>{setSelected(item.id);setNotice('');setError('')}} className={'vc-feedback-item'+(selected===item.id?' active':'')}><div className="vc-feedback-item-head"><h3>{item.title}</h3><span className={'vc-feedback-pill '+(item.status==='resolved'?'good':item.status==='in_review'?'warm':'')}>{statusLabel(item.status)}</span></div><p>{item.description.length>150?item.description.slice(0,150)+'…':item.description}</p><div className="vc-feedback-meta"><span>{item.category}</span><span>·</span><span>{dateLabel(item.created_at)}</span><span>·</span><span>{replies.filter(r=>r.feedback_id===item.id).length} replies</span></div></button>)}</div>}
    {activeItem&&<div className="vc-feedback-thread"><div className="vc-feedback-meta" style={{marginBottom:10}}><span className="vc-feedback-pill">{activeItem.category}</span><span className="vc-feedback-pill">Priority: {activeItem.priority}</span>{activeItem.page_context&&<span className="vc-feedback-pill">{activeItem.page_context}</span>}</div>
     <div className="vc-feedback-message"><div className="vc-feedback-message-head"><span>You · Original feedback</span><span>{dateLabel(activeItem.created_at)}</span></div><p>{activeItem.description}</p></div>
     {threadReplies.map(r=><article className={'vc-feedback-message'+(r.author_role==='admin'?' admin':'')} key={r.id}><div className="vc-feedback-message-head"><span>{r.author_role==='admin'?<><ShieldCheck size={12} style={{verticalAlign:'-2px'}}/> Ventora Team / Admin</>:'You'}</span><span>{dateLabel(r.created_at)}</span></div><p>{r.body}</p></article>)}
     <form className="vc-feedback-reply" onSubmit={sendReply}><textarea required maxLength={5000} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Add details or reply to the Ventora team…"/><button className="vc-feedback-submit" type="submit" disabled={sending}><Send size={14}/>{sending?'Sending…':'Reply to this thread'}</button></form>
    </div>}
   </section></div>
  </main>
  <VentoraFooter/>
 </div>;
}

export function FeedbackAdminPanel(){
 const[items,setItems]=useState<FeedbackItem[]>([]),[replies,setReplies]=useState<FeedbackReply[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState('all'),[status,setStatus]=useState('all'),[drafts,setDrafts]=useState<Record<string,string>>({}),[expanded,setExpanded]=useState('');
 const load=useCallback(async()=>{
  if(!supabase){setError('Supabase is not configured.');setLoading(false);return;}
  setLoading(true);setError('');
  try{await requireActiveSession();const{data:allowed,error:a}=await supabase.rpc('is_admin');if(a)throw a;if(!allowed)throw new Error('Administrator access is required.');
   const{data,error:e}=await supabase.from('feedback_items').select('*,profiles!feedback_items_user_id_fkey(full_name)').order('created_at',{ascending:false}).limit(500);
   if(e)throw e;const rows=(data||[]) as FeedbackItem[];setItems(rows);
   const ids=rows.map(x=>x.id);if(ids.length){const r=await supabase.from('feedback_replies').select('*').in('feedback_id',ids).order('created_at',{ascending:true});if(r.error)throw r.error;setReplies((r.data||[]) as FeedbackReply[]);}else setReplies([]);
  }catch(e:any){setError(e?.message||'Feedback queue could not be loaded.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load()},[load]);
 const filtered=useMemo(()=>items.filter(x=>(status==='all'||x.status===status)&&(category==='all'||x.category===category)&&(!query.trim()||[x.title,x.description,x.profiles?.full_name,x.user_id,x.category].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()))),[items,status,category,query]);
 async function changeStatus(item:FeedbackItem,next:FeedbackStatus){if(!supabase)return;setBusy(item.id);setError('');try{const{error:e}=await supabase.from('feedback_items').update({status:next,updated_at:new Date().toISOString()}).eq('id',item.id);if(e)throw e;setItems(old=>old.map(x=>x.id===item.id?{...x,status:next,updated_at:new Date().toISOString()}:x));setNotice('Feedback status updated.');}catch(e:any){setError(e?.message||'Status could not be updated.');}finally{setBusy('');}}
 async function sendAdminReply(item:FeedbackItem){if(!supabase)return;const body=(drafts[item.id]||'').trim();if(!body){setError('Write an official reply first.');return;}setBusy(item.id);setError('');try{await requireActiveSession();const adminUser=await restoreUserSession();if(!adminUser?.id)throw new Error('Your administrator session needs to be restored.');const{data,error:e}=await supabase.from('feedback_replies').insert({feedback_id:item.id,author_id:adminUser.id,author_role:'admin',body}).select('*').single();if(e)throw e;setReplies(old=>[...old,data as FeedbackReply]);setDrafts(old=>({...old,[item.id]:''}));setNotice('Official Ventora Team reply sent.');}catch(e:any){setError(e?.message||'Reply could not be sent.');}finally{setBusy('');}}
 return <div className="vc-feedback" style={{minHeight:'auto',padding:0}}><style>{feedbackStyle}</style><div className="vc-feedback-panel" style={{background:'rgba(255,255,255,.92)'}}>
  <div className="vc-feedback-kicker">MEMBER EXPERIENCE / PRIVATE FEEDBACK QUEUE</div><h2 style={{fontSize:22,marginTop:7}}>Feedback <em style={{fontFamily:'Georgia,serif',fontWeight:500,color:'#245863'}}>triage.</em></h2><p className="vc-feedback-sub">Review member submissions, manage their status and continue the conversation from one secure queue.</p>
  {notice&&<div className="vc-feedback-notice" role="status">{notice}</div>}{error&&<div className="vc-feedback-notice vc-feedback-error" role="alert">{error}</div>}
  <div className="vc-feedback-admin-toolbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search title, member or details"/><select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(x=><option key={x}>{x}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{statuses.map(x=><option key={x} value={x}>{statusLabel(x)}</option>)}</select></div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:12,color:'#617680',fontSize:11}}><span>{filtered.length} matching feedback thread{filtered.length===1?'':'s'}</span><button className="vc-feedback-back" onClick={()=>void load()} aria-label="Refresh admin feedback queue"><RefreshCw size={15}/></button></div>
  {loading?<div className="vc-feedback-empty">Loading feedback queue…</div>:filtered.length===0?<div className="vc-feedback-empty"><Inbox size={22}/>No feedback matches these filters.</div>:filtered.map(item=><article className="vc-feedback-admin-card" key={item.id}>
   <div className="vc-feedback-item-head"><div style={{minWidth:0}}><h3 style={{margin:0,fontSize:14,color:'#0F2234'}}>{item.title}</h3><div className="vc-feedback-meta"><span>{item.profiles?.full_name||'Ventora member'}</span><span>·</span><span>{dateLabel(item.created_at)}</span><span>·</span><span>{item.category}</span><span>·</span><span>{item.priority} priority</span></div></div><span className={'vc-feedback-pill '+(item.status==='resolved'?'good':item.status==='in_review'?'warm':'')}>{statusLabel(item.status)}</span></div>
   <p style={{margin:'10px 0',color:'#405963',fontSize:12,lineHeight:1.7,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{item.description}</p>{item.page_context&&<div className="vc-feedback-meta">Page / screen: {item.page_context}</div>}
   <div className="vc-feedback-row" style={{marginTop:12}}><label className="vc-feedback-field" style={{margin:0}}>Update status<select disabled={busy===item.id} value={item.status} onChange={e=>void changeStatus(item,e.target.value as FeedbackStatus)}>{statuses.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select></label><div className="vc-feedback-field" style={{margin:0,justifyContent:'end'}}><span>Conversation</span><button className="vc-feedback-submit" type="button" onClick={()=>setExpanded(expanded===item.id?'':item.id)}>{expanded===item.id?'Hide thread':'Open thread'} · {replies.filter(r=>r.feedback_id===item.id).length} replies</button></div></div>
   {expanded===item.id&&<div className="vc-feedback-thread"><div className="vc-feedback-message"><div className="vc-feedback-message-head"><span>Member · Original feedback</span><span>{dateLabel(item.created_at)}</span></div><p>{item.description}</p></div>
    {replies.filter(r=>r.feedback_id===item.id).map(r=><article key={r.id} className={'vc-feedback-message'+(r.author_role==='admin'?' admin':'')}><div className="vc-feedback-message-head"><span>{r.author_role==='admin'?<><ShieldCheck size={12} style={{verticalAlign:'-2px'}}/> Ventora Team / Admin</>:'Member reply'}</span><span>{dateLabel(r.created_at)}</span></div><p>{r.body}</p></article>)}
    <form className="vc-feedback-reply" onSubmit={e=>{e.preventDefault();void sendAdminReply(item)}}><textarea maxLength={5000} value={drafts[item.id]||''} onChange={e=>setDrafts(old=>({...old,[item.id]:e.target.value}))} placeholder="Write an official reply to this member…"/><button className="vc-feedback-submit" type="submit" disabled={busy===item.id}><ShieldCheck size={14}/>{busy===item.id?'Sending…':'Send official reply'}</button></form>
   </div>}
  </article>)}
 </div></div>;
}
