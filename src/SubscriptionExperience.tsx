import {useMemo,useState} from 'react';
import {ArrowUpRight,Check,ShieldCheck,Eye,Building2,ChartNoAxesCombined,LockKeyhole,Sparkles} from 'lucide-react';
import './subscription-experience.css';

type Lens='business'|'investor';
type Billing='monthly'|'annual';
type Filter='all'|'visibility'|'connections'|'trust';
type Props={plans:any[];currentPlan:any;accountType:Lens;requests:any[];busy:boolean;onRequest:(id:string)=>void};

const cap=(value:any,singular:string)=>value===-1?'Unlimited':value==null?'Not included':Number(value)===1?'1 '+singular:Number(value).toLocaleString('en-IN')+' '+singular+'s';
const yes=(value:any)=>value===true;
const isNotIncluded=(value:any)=>/^(not included|preview only|not listed|unavailable|—|✕)$/i.test(String(value).trim());
const featureIndicator=(value:any)=>isNotIncluded(value)?<span className="vc-feature-not-included" aria-label="Not included">—</span>:<Check size={15} aria-label="Included"/>;
const money=(value:any)=>'₹'+Number(value||0).toLocaleString('en-IN');

function rowsFor(lens:Lens){
 if(lens==='business')return [
  {group:'visibility',label:'Company profile slots',value:(f:any)=>cap(f.max_business_profiles,'profile')},
  {group:'visibility',label:'Monthly profile views',value:(f:any)=>cap(f.monthly_profile_views,'view')},
  {group:'visibility',label:'Priority directory placement',value:(f:any)=>yes(f.featured)?'Featured placement':'Standard discovery'},
  {group:'visibility',label:'Advanced discovery filters',value:(f:any)=>yes(f.advanced_discovery)?'Included':'Standard filters'},
  {group:'connections',label:'Monthly introductions',value:(f:any)=>cap(f.monthly_connections,'introduction')},
  {group:'connections',label:'Direct messaging',value:(f:any)=>yes(f.messaging)?'Included':'Not included'},
  {group:'connections',label:'Investor contact tools',value:(f:any)=>yes(f.investor_contacts)?'Included':'Not included'},
  {group:'connections',label:'Private pitch deck uploads',value:(f:any)=>yes(f.pitch_deck)?'Included':'Not included'},
  {group:'trust',label:'Business analytics',value:(f:any)=>yes(f.analytics)?'Included':'Not included'},
  {group:'trust',label:'Verification review',value:()=>'Standard review'},
  {group:'trust',label:'Priority support',value:(f:any)=>yes(f.priority_support)?'Priority':'Standard'}
 ];
 return [
  {group:'visibility',label:'Monthly business profile views',value:(f:any)=>cap(f.monthly_business_views,'view')},
  {group:'visibility',label:'Saved business & investor profiles',value:(f:any)=>cap(f.saved_profiles,'profile')},
  {group:'visibility',label:'Advanced discovery filters',value:(f:any)=>yes(f.advanced_filters)?'Included':'Standard filters'},
  {group:'connections',label:'Direct messaging',value:(f:any)=>yes(f.messaging)?'Included':'Not included'},
  {group:'connections',label:'Express investment interest',value:(f:any)=>yes(f.express_interest)?'Included':'Not included'},
  {group:'connections',label:'Network connections',value:(f:any)=>yes(f.networking)?'Included':'Preview only'},
  {group:'connections',label:'Private pitch deck access',value:(f:any)=>yes(f.pitch_deck_access)?'Included':'Not included'},
  {group:'connections',label:'Portfolio access',value:(f:any)=>yes(f.portfolio_access)?'Included':'Not included'},
  {group:'trust',label:'Verification review',value:()=>'Standard review'},
  {group:'trust',label:'Member support',value:()=>'Standard support'}
 ];
}

const previews=[
 {eyebrow:'01 / PRIORITY PRESENCE',title:'Be easier to discover.',copy:'Featured placement and stronger profile visibility help put your business in the right conversations.',icon:Eye},
 {eyebrow:'02 / MATCH INTELLIGENCE',title:'See the signal sooner.',copy:'Expanded discovery, saved profiles and analytics add useful context to your next connection.',icon:ChartNoAxesCombined},
 {eyebrow:'03 / TRUSTED ACCESS',title:'Move with more context.',copy:'Private materials, direct conversations and a clear review process keep the next step considered.',icon:ShieldCheck}
];

export default function SubscriptionExperience({plans,currentPlan,accountType,requests,busy,onRequest}:Props){
 const[lens,setLens]=useState<Lens>(accountType);
 const[billing,setBilling]=useState<Billing>('monthly');
 const[filter,setFilter]=useState<Filter>('all');
 const[preview,setPreview]=useState(0);
 const visiblePlans=useMemo(()=>plans.filter(p=>p.account_type===lens).sort((a,b)=>Number(a.display_order)-Number(b.display_order)),[plans,lens]);
 const rows=useMemo(()=>rowsFor(lens).filter(row=>filter==='all'||row.group===filter),[lens,filter]);
 const pendingFor=(id:string)=>requests.find(r=>r.plan_id===id&&r.status==='pending');
 const current=plans.find(p=>p.id===currentPlan?.plan_id);
 const PreviewIcon=previews[preview].icon;
 return <div className="vc-membership-experience">
  <section className="vc-membership-intro">
   <div className="vc-membership-intro-copy"><span className="vc-membership-eyebrow">VENTORA CONNECT / MEMBERSHIP STUDIO</span><h1>Access that moves<br/><em>ambition forward.</em></h1><p>Choose the level of visibility, discovery and connection that fits the way you build or invest. Every tier below is drawn from the live Ventora plan catalogue.</p><div className="vc-membership-intro-meta"><span><ShieldCheck size={15}/> Reviewed membership requests</span><span><LockKeyhole size={15}/> Secure workspace activation</span></div></div>
   <div className="vc-membership-intro-art"><div className="vc-membership-poster"><small>VENTORA / PRIVATE NETWORK</small><strong>THE<br/><i>RIGHT</i><br/>ROOM.</strong><span>DISCOVERY · ACCESS · MOMENTUM</span></div><div className="vc-membership-art-panel"><span>MEMBER EXPERIENCE / LIVE</span><b>Profile visibility</b><i/><b>Match context</b><i/><b>Private introductions</b><small>BUILT AROUND YOUR NEXT MOVE</small></div></div>
  </section>
  <section className="vc-membership-current" aria-label="Current membership"><div><span>CURRENT MEMBERSHIP</span><strong>{current?.name||'Explorer'}</strong><small>{currentPlan?.status==='active'?'Active in your workspace':'Your membership status is '+(currentPlan?.status||'active')}</small></div><b>{money(current?.price_inr)}<small> / month</small></b></section>
  <section className="vc-membership-benefit-strip"><div className="vc-membership-benefit-heading"><span>THE MEMBER EXPERIENCE / 01</span><h2>Useful advantages.<br/><em>Made visible.</em></h2><p>Explore the difference between being present and being better equipped to connect.</p><div className="vc-membership-preview-tabs">{previews.map((p,i)=><button type="button" key={p.eyebrow} className={preview===i?'active':''} onClick={()=>setPreview(i)} aria-label={'Show '+p.title}>{'0'+(i+1)}</button>)}</div></div><article className="vc-membership-preview-card" key={preview}><div className="vc-membership-preview-visual"><span>{previews[preview].eyebrow}</span><PreviewIcon size={42}/><b>{preview===0?'PRESENCE':preview===1?'INSIGHT':'ACCESS'}</b></div><div className="vc-membership-preview-copy"><span>VENTORA / MEMBER ADVANTAGE</span><h3>{previews[preview].title}</h3><p>{previews[preview].copy}</p><small>Illustrative product capability · availability varies by plan</small></div></article></section>
  <section className="vc-membership-plans" id="membership-options">
   <div className="vc-membership-section-heading"><span className="vc-membership-eyebrow">FIND YOUR PLACE / 02</span><h2>One network.<br/><em>Your level of access.</em></h2><p>Switch perspectives to compare every active plan for each side of the Ventora network.</p></div>
   <div className="vc-membership-controls"><div className="vc-membership-lens" role="group" aria-label="Compare membership perspective"><button type="button" className={lens==='business'?'active':''} onClick={()=>{setLens('business');setFilter('all')}}><Building2 size={16}/> Business</button><button type="button" className={lens==='investor'?'active':''} onClick={()=>{setLens('investor');setFilter('all')}}><ChartNoAxesCombined size={16}/> Investor</button></div><div className="vc-membership-billing" role="group" aria-label="Billing period"><button type="button" className={billing==='monthly'?'active':''} onClick={()=>setBilling('monthly')}>Monthly</button><button type="button" className={billing==='annual'?'active':''} onClick={()=>setBilling('annual')}>Annual <span>Coming soon</span></button></div></div>
   {lens!==accountType&&<div className="vc-membership-lens-note"><ShieldCheck size={17}/><span>You're viewing {lens} memberships for comparison. Your signed-in account is registered as {accountType}; plan requests can only be submitted for your registered account type.</span></div>}
   {billing==='annual'&&<div className="vc-membership-annual-note"><Sparkles size={17}/><div><b>Annual billing is not active yet.</b><p>Ventora currently supports monthly subscriptions only. We’ll show verified annual pricing and savings here once annual billing is enabled—no estimated discount or annual charge is being applied.</p></div></div>}
   <div className="vc-membership-plan-grid">{visiblePlans.map((plan:any)=>{const isCurrent=plan.id===currentPlan?.plan_id;const pending=pendingFor(plan.id);const isFeatured=plan.id==='business_growth'||plan.id==='investor_access';const compatible=plan.account_type===accountType;return <article key={plan.id} className={'vc-membership-plan'+(isFeatured?' featured':'')+(isCurrent?' current':'')}><div className="vc-membership-plan-top"><span>{isFeatured?'RECOMMENDED':Number(plan.price_inr)===0?'START HERE':'MEMBER ACCESS'}</span>{isCurrent?<b className="vc-membership-status">CURRENT PLAN</b>:pending?<b className="vc-membership-pending">REQUEST PENDING</b>:null}</div><h3>{plan.name}</h3><p>{plan.description}</p><div className="vc-membership-price"><strong>{money(plan.price_inr)}</strong><span>/ month</span></div><ul>{rowsFor(lens).slice(0,5).map((row:any)=>{const value=row.value(plan.features||{});return <li key={row.label}>{featureIndicator(value)}<span><b>{row.label}</b><small>{value}</small></span></li>})}</ul><button type="button" disabled={busy||isCurrent||Boolean(pending)||billing==='annual'||!compatible} onClick={()=>onRequest(plan.id)}>{isCurrent?'Current membership':pending?'Request under review':!compatible?'Not available for this account':billing==='annual'?'Annual billing coming soon':Number(plan.price_inr)===0?'Activate free plan':'Continue to payment'} <ArrowUpRight size={16}/></button><small>{Number(plan.price_inr)>0?'Paid access activates only after payment review.':'Free access activates in your workspace.'}</small></article>})}</div>
   {!visiblePlans.length&&<div className="vc-membership-empty">No active plans are currently listed for this membership type.</div>}
  </section>
  <section className="vc-membership-comparison"><div className="vc-membership-comparison-heading"><span className="vc-membership-eyebrow">THE DETAILS / 03</span><h2>Compare what<br/><em>actually changes.</em></h2><p>Feature availability and caps below are read directly from the published subscription plan settings.</p><div className="vc-membership-filter" role="group" aria-label="Filter comparison features"><button type="button" className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All features</button><button type="button" className={filter==='visibility'?'active':''} onClick={()=>setFilter('visibility')}>Visibility & reach</button><button type="button" className={filter==='connections'?'active':''} onClick={()=>setFilter('connections')}>Connections & deal flow</button><button type="button" className={filter==='trust'?'active':''} onClick={()=>setFilter('trust')}>Trust & support</button></div></div><div className="vc-membership-table-scroll" tabIndex={0} aria-label="Swipe horizontally to compare all plans"><div className="vc-membership-table" style={{'--plan-count':visiblePlans.length} as any}><div className="vc-membership-table-row head"><b>MEMBERSHIP BENEFIT</b>{visiblePlans.map((p:any)=><b key={p.id}>{p.name}{p.id===currentPlan?.plan_id?' · CURRENT':''}</b>)}</div>{rows.map(row=><div className="vc-membership-table-row" key={row.label}><b>{row.label}</b>{visiblePlans.map((p:any)=>{const value=row.value(p.features||{});const included=!isNotIncluded(value);return <span key={p.id} className={included?'included':'not-included'}>{included?<Check size={14}/>:<span className="vc-feature-not-included">—</span>} {value}</span>})}</div>)}</div></div><p className="vc-membership-swipe-hint">On mobile, swipe the comparison table sideways to see every tier.</p></section>
  <section className="vc-membership-request-footer"><div><span>VENTORA CONNECT / MEMBERSHIP</span><h2>Make room for<br/><em>what comes next.</em></h2><p>Choose a plan above to continue in your existing workspace flow. Requests and payment reviews remain visible here and in the admin portal.</p></div><div className="vc-membership-request-status"><ShieldCheck size={24}/><b>Clear status. Human review.</b><small>Paid plan requests appear in your workspace history and the /admin Plan requests queue. Activation follows payment verification and admin approval.</small></div></section>
  {requests.length>0&&<section className="vc-membership-history"><div><span>YOUR WORKSPACE / REQUEST TRACKER</span><h3>Membership request history</h3></div><div className="vc-membership-history-list">{requests.map((r:any)=><article key={r.id}><div><b>{plans.find(p=>p.id===r.plan_id)?.name||r.plan_id}</b><small>{new Date(r.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</small></div><span className={'vc-membership-request-pill '+r.status}>{String(r.status).replace(/_/g,' ')}</span></article>)}</div></section>}
 </div>;
}
