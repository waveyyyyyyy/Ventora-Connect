import React,{useDeferredValue,useEffect,useMemo,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {ArrowUpRight,Building2,ChartNoAxesCombined,ShieldCheck,Bookmark,UserRoundCheck} from 'lucide-react';
import {supabase,restoreUserSession,requireActiveSession,checkMessagingProfile} from './lib/supabase';

async function readViewerSession(){
 if(!supabase)return null;
 const user=await restoreUserSession();
 if(!user)return null;
 try{await requireActiveSession(user.id);return user;}catch{return null;}
}
function publishDirectoryViewer(user:any){
 if(typeof window!=='undefined'&&user?.id)window.dispatchEvent(new CustomEvent('ventora:directory-viewer',{detail:user}));
}

export default function BusinessDirectoryPage({investors=false,Header,Footer}:{investors?:boolean;Header:React.ComponentType<any>;Footer:React.ComponentType<any>}){
const[query,setQuery]=useState(''),[industry,setIndustry]=useState(''),[stage,setStage]=useState(''),[ticket,setTicket]=useState('');const deferredQuery=useDeferredValue(query);const[items,setItems]=useState<any[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const[viewer,setViewer]=useState<any>(null);const[busy,setBusy]=useState('');const[message,setMessage]=useState('');const[savedIds,setSavedIds]=useState<string[]>([]);const nav=useNavigate();
useEffect(()=>{
 let active=true;
 const maybeClient=supabase;
 if(!maybeClient){setLoading(false);return()=>{active=false;};}
 const client=maybeClient as NonNullable<typeof maybeClient>;
 async function load(){
  const listQuery=investors
   ?client.from('discoverable_profiles').select('id,full_name,bio,avatar_url,country,city,website,account_type,investment_min,investment_max,preferred_industries,preferred_stages').eq('account_type','investor')
   :client.from('discoverable_businesses').select('id,company_name,industry,description,country,city,business_stage,funding_requirement,min_investment,max_investment,owner_id,logo_url,cover_image_url');
  const [current,result]=await Promise.all([readViewerSession(),listQuery]);
  if(!active)return;
  setViewer(current);
  if(current?.id)publishDirectoryViewer(current);
  if(result.error)setError(result.error.message);else setItems(result.data||[]);
  if(current?.id){
   const table=investors?'saved_investors':'saved_businesses';
   const key=investors?'investor_id':'business_id';
   const {data:saved}=await client.from(table).select(key).eq('user_id',current.id);
   if(!active)return;
   setSavedIds((saved||[]).map((x:any)=>x[key]));
  }
  setLoading(false);
 }
 void load();
 return()=>{active=false;};
},[investors]);
async function ensureViewer(){
 // Never trust a cached user object on its own. The Supabase session must also
 // exist so the following RPC is sent with the authenticated JWT, not as anon.
 const current=await readViewerSession();
 if(current?.id)setViewer(current);
 else setViewer(null);
 return current;
}
function readableSupabaseError(error:any){
 const message=typeof error?.message==='string'?error.message:'';
 const details=typeof error?.details==='string'?error.details:'';
 const hint=typeof error?.hint==='string'?error.hint:'';
 const code=typeof error?.code==='string'?' ('+error.code+')':'';
 return [message,details,hint].filter(Boolean).join(' — ')+code;
}
async function messageMember(target:string){if(!supabase){nav('/login?next='+encodeURIComponent('/businesses'));return;}if(!target){setMessage('This business has not published a message recipient yet.');return;}const current=await ensureViewer();if(!current){nav('/login?next='+encodeURIComponent('/dashboard?tab=profile&message_to='+target));return;}if(current.id===target){setMessage('This is your own profile.');return;}setBusy('message-'+target);setMessage('');try{const completion=await checkMessagingProfile(current.id);if(!completion.complete){nav('/dashboard?tab=profile&message_to='+encodeURIComponent(target),{state:{profileGate:{percent:completion.percent,missing:completion.missing}}});return;}const{data,error}=await supabase.rpc('start_conversation',{target_user:target});if(error)throw error;const conversationId=typeof data==='string'?data:Array.isArray(data)?(data[0]?.conversation_id||data[0]?.id):data?.conversation_id||data?.id;if(!conversationId)throw new Error('The conversation could not be opened. Please try again.');nav('/messages?conversation='+encodeURIComponent(String(conversationId)),{state:{conversationId:String(conversationId),recipientId:target,source:'business-discovery'}});}catch(error){const detail=readableSupabaseError(error);setMessage(detail?'Unable to open this conversation: '+detail:'Unable to open this conversation. Please try again.');}finally{setBusy('');}}
async function save(target:string){if(!supabase){nav('/login');return;}const current=await ensureViewer();if(!current){nav('/login?next='+encodeURIComponent(location.pathname+location.search));return;}const table=investors?'saved_investors':'saved_businesses',key=investors?'investor_id':'business_id';setBusy('save-'+target);setMessage('');if(savedIds.includes(target)){const{error}=await supabase.from(table).delete().eq('user_id',current.id).eq(key,target);setBusy('');if(error)setMessage(error.message);else{setSavedIds(old=>old.filter(x=>x!==target));setMessage('Removed from your shortlist.');}}else{const{error}=await supabase.from(table).upsert({user_id:current.id,[key]:target},{onConflict:'user_id,'+key});setBusy('');if(error)setMessage(error.message);else{setSavedIds(old=>[...old,target]);setMessage('Saved to your shortlist.');}}}
const industries=useMemo(()=>Array.from(new Set(items.flatMap(item=>investors?(item.preferred_industries||[]):[item.industry]).filter(Boolean))).sort(),[items,investors]);const stages=useMemo(()=>Array.from(new Set(items.flatMap(item=>investors?(item.preferred_stages||[]):[item.business_stage]).filter(Boolean))).sort(),[items,investors]);
const filtered=useMemo(()=>items.filter(item=>{const haystack=investors?[item.full_name,item.bio,item.city,item.country,...(item.preferred_industries||[]),...(item.preferred_stages||[])].join(' '):[item.company_name,item.description,item.industry,item.city,item.country,item.business_stage].join(' ');const low=investors?Number(item.investment_min||0):Number(item.min_investment||item.funding_requirement||0);const high=investors?Number(item.investment_max||item.investment_min||0):Number(item.max_investment||item.funding_requirement||0);const amount=low||high;const ticketOk=!ticket||(ticket==='under-10'&&amount>0&&amount<10000)||(ticket==='10-50'&&amount>=10000&&amount<=50000)||(ticket==='50-plus'&&amount>50000);return haystack.toLowerCase().includes(deferredQuery.toLowerCase())&&(!industry||((investors?(item.preferred_industries||[]).join(' '):item.industry||'').toLowerCase().includes(industry.toLowerCase())))&&(!stage||((investors?(item.preferred_stages||[]).join(' '):item.business_stage||'').toLowerCase().includes(stage.toLowerCase())))&&ticketOk}),[items,investors,deferredQuery,industry,stage,ticket]);
useEffect(()=>{
 if(typeof window==='undefined')return;
 const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const hero=document.querySelector<HTMLElement>('.directory-hero');
 const footer=document.querySelector<HTMLElement>('.footer');
 let frame=0;
 const update=()=>{
  if(frame)return;
  frame=window.requestAnimationFrame(()=>{
   frame=0;
   const shift=Math.min(44,Math.max(-44,window.scrollY*.045));
   hero?.style.setProperty('--directory-parallax',shift+'px');
   footer?.style.setProperty('--directory-parallax',Math.min(26,Math.max(-26,(window.scrollY-(footer?.offsetTop||0))*.035))+'px');
  });
 };
 if(!reduce){window.addEventListener('scroll',update,{passive:true});update();}
 const nodes=Array.from(document.querySelectorAll<HTMLElement>('.directory-card,.directory-editorial-panel'));
 if(reduce||!('IntersectionObserver'in window)){nodes.forEach(node=>node.classList.add('directory-revealed'));}
 else{
  const observer=new IntersectionObserver(entries=>{
   entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('directory-revealed');observer.unobserve(entry.target);}});
  },{rootMargin:'0px 0px -8% 0px',threshold:.06});
  nodes.forEach(node=>observer.observe(node));
  return()=>{window.removeEventListener('scroll',update);if(frame)window.cancelAnimationFrame(frame);observer.disconnect();};
 }
 return()=>{window.removeEventListener('scroll',update);if(frame)window.cancelAnimationFrame(frame);};
},[loading,filtered.length,investors]);
const money=(value:any)=>value==null?'Not disclosed':'₹'+Number(value).toLocaleString('en-IN',{maximumFractionDigits:0});
return <><Header directoryUser={viewer}/><section className={"directory-hero "+(investors?"directory-investor-hero":"directory-business-hero")}><div className="section-kicker">VENTORA DISCOVERY / {investors?'INVESTORS':'BUSINESSES'}</div><h1>{investors?'Meet the people':'Discover businesses'}<br/><em>moving ideas forward.</em></h1><p>{investors?'Explore investor profiles and understand their stated interests.':'Explore published company profiles, funding needs and founders.'}</p>{!investors&&<div className="directory-hero-actions"><div><span className="directory-live-dot"/> OPEN FOR BUSINESS DISCOVERY</div><Link className="directory-create-link" to={viewer?'/dashboard?tab=business':'/signup?type=business'}>{viewer?'Manage your listings':'List your business'} <ArrowUpRight size={17}/></Link></div>}<div className="directory-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={investors?'Search investors, industries or locations':'Search companies, industries or locations'} aria-label="Search directory"/><select value={industry} onChange={e=>setIndustry(e.target.value)} aria-label="Filter by industry"><option value="">All industries</option>{industries.map(v=><option key={v} value={v}>{v}</option>)}</select><select value={stage} onChange={e=>setStage(e.target.value)} aria-label="Filter by stage"><option value="">All stages</option>{stages.map(v=><option key={v} value={v}>{v}</option>)}</select><select value={ticket} onChange={e=>setTicket(e.target.value)} aria-label="Filter by ticket size"><option value="">Any ticket size</option><option value="under-10">Under ₹10,000</option><option value="10-50">₹10,000–₹50,000</option><option value="50-plus">Above ₹50,000</option></select></div></section><section className="directory-editorial-strip" aria-label="Ventora discovery editorial">
 <div className="directory-editorial-panel directory-editorial-primary"><span>VENTORA / BUILT ON CONNECTION</span><strong>Good businesses<br/><em>deserve the right room.</em></strong><small>DISCOVER WITH CONTEXT · CONNECT WITH INTENT</small></div>
 <div className="directory-editorial-panel directory-editorial-secondary"><span>01 / THE NETWORK</span><strong>Ideas move<br/>when people do.</strong><small>BUSINESSES · CAPITAL · MOMENTUM</small></div>
 <div className="directory-editorial-panel directory-editorial-tertiary"><span>02 / YOUR NEXT INTRODUCTION</span><strong>Make the<br/>next move.</strong><small>OPEN THE DOOR TO A CONVERSATION</small></div>
</section><section className="directory-results"><div className="directory-intro-row"><div><span className="section-kicker">THE VENTORA NETWORK</span><h2>{investors?"People behind the capital.":"Ideas worth getting to know."}</h2></div><p>{investors?"Explore investor profiles and their stated interests.":"A curated space for ambitious companies, clear profiles and meaningful introductions."}</p></div><div className="directory-result-head"><span>{error?'Directory unavailable':loading?'Member profiles':filtered.length+' profiles found'}</span><span>MEMBER-PUBLISHED PROFILES</span></div>{message&&<div className={message.startsWith('Your profile is ')?'directory-profile-alert':'workspace-notice'} role="status">{message.startsWith('Your profile is ')?<><span className="directory-profile-alert-icon"><UserRoundCheck size={22}/></span><div className="directory-profile-alert-copy"><strong>Complete your profile to start messaging</strong><p>{message}</p></div><Link className="directory-profile-alert-action" to="/dashboard?tab=profile">Complete profile <ArrowUpRight size={17}/></Link></>:message}</div>}{error&&<div className="directory-note">{error}. Please check that the Ventora database migrations have been applied.</div>}{loading?null:!filtered.length?<div className="directory-empty"><div className="directory-empty-icon"><Building2 size={28}/></div><span className="section-kicker">A NEW NETWORK STARTS SOMEWHERE</span><h3>{investors?'No investor profiles match these filters.':'No businesses match these filters yet.'}</h3><p>{investors?'Try another industry, stage or ticket size.':'Try adjusting your filters, or publish your company profile when it is ready.'}</p><Link className="btn btn-dark" to={viewer?'/dashboard?tab=business':'/signup?type=business'}>{viewer?'Create your first listing':'Create a business listing'} <ArrowUpRight/></Link></div>:<div className="directory-grid">{filtered.map(item=>{const target=investors?item.id:item.owner_id;const isSaved=savedIds.includes(item.id);const title=investors?item.full_name:item.company_name;const min=investors?item.investment_min:item.min_investment;const max=investors?item.investment_max:item.max_investment;const targetAmount=investors?null:item.funding_requirement;return <article className="directory-card" key={item.id}><div className="directory-card-cover">{!investors&&item.cover_image_url?<img src={item.cover_image_url} alt={title+" cover"} loading="lazy" decoding="async" fetchPriority="low"/>:<div className="directory-cover-art"><span>VENTORA / DISCOVERY</span>{investors?<ChartNoAxesCombined size={34}/>:<Building2 size={34}/>}</div>}</div><div className="directory-card-body"><div className="directory-card-labels"><span className="directory-card-category">{investors?'INVESTOR':(item.industry||'BUSINESS').toUpperCase()}</span><span className="directory-card-trust"><ShieldCheck size={12}/> MEMBER PROFILE</span></div><div className="directory-card-heading">{!investors&&item.logo_url?<img src={item.logo_url} alt={title+" logo"} loading="lazy" decoding="async"/>:item.avatar_url?<img src={item.avatar_url} alt={title+" avatar"} loading="lazy" decoding="async"/>:<span className="directory-avatar">{(title||'V').slice(0,1).toUpperCase()}</span>}<div><h3>{title}</h3><small>{investors?'Investor profile':item.business_stage||'Business profile'}</small></div></div><p className="directory-card-hook">{item.bio||item.description||'A Ventora member building meaningful opportunities.'}</p><div className="directory-card-pills">{!investors&&item.industry&&<span>{item.industry}</span>}<span>{investors?'Investor':item.business_stage||'Stage not specified'}</span></div><div className="directory-card-stats">{investors?<><div><small>MIN TICKET</small><b>{money(min)}</b></div><div><small>MAX TICKET</small><b>{money(max)}</b></div><div><small>FOCUS</small><b>{(item.preferred_industries||[]).slice(0,1).join('')||'Flexible'}</b></div></>:<><div><small>RAISE TARGET</small><b>{money(targetAmount)}</b></div><div><small>MIN TICKET</small><b>{money(min)}</b></div><div><small>LOCATION</small><b>{[item.city,item.country].filter(Boolean).join(', ')||'Not shared'}</b></div></>}</div>{!investors&&<div className="directory-funding-track"><div><span>FUNDING TARGET</span><small>{targetAmount==null?'Not disclosed':'Target disclosed'}</small></div><div className="directory-funding-line"><i/></div></div>}{investors&&<div className="directory-meta"><span>{(item.preferred_stages||[]).slice(0,2).join(' · ')||'Stages flexible'}</span></div>}<div className="directory-card-actions"><Link className="text-link" to={investors?'/member/'+item.id:'/business/'+item.id}>View profile <ArrowUpRight size={16}/></Link><button className={'directory-save-toggle'+(isSaved?' is-saved':'')} type="button" onClick={()=>save(item.id)} disabled={busy==='save-'+item.id} aria-pressed={isSaved} aria-label={isSaved?'Remove from shortlist':'Add to shortlist'}><Bookmark size={15} fill={isSaved?'currentColor':'none'}/><span>{busy==='save-'+item.id?'Saving…':isSaved?'Shortlisted':'Shortlist'}</span></button><button className="directory-message-button" type="button" onClick={()=>messageMember(target)} disabled={busy==='message-'+target}>{busy==='message-'+target?'Opening…':'Message'}</button></div></div></article>})}</div>}</section><Footer/></>}
