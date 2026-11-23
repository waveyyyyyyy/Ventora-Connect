import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, Compass, Handshake, Home, Menu, MessageSquare, ShieldCheck, Sparkles, TrendingUp, UserRound, Users, X } from 'lucide-react';
import { supabase, restoreUserSession } from './lib/supabase';
import BrandLogo from './BrandLogo';

import './gust-platform.css';

const BRAND_LOGO = `${import.meta.env.BASE_URL}ventora-icon.svg`;

const pipeline = [{name:'Northstar Robotics',stage:'New',amount:'$1.8M'},{name:'Morrow Health',stage:'Screening',amount:'$850K'},{name:'Fieldnote',stage:'Considering',amount:'$2.2M'},{name:'Forma Labs',stage:'Due diligence',amount:'$6M'}];

export default function GustPlatform(){
 const [session,setSession]=useState<any>(null); const [authChecked,setAuthChecked]=useState(false); const [menuOpen,setMenuOpen]=useState(false); const [adminAllowed,setAdminAllowed]=useState(false); const navigate=useNavigate();
 useEffect(()=>{
  let revealObserver:IntersectionObserver|undefined;
  const revealTargets=Array.from(document.querySelectorAll('.gp-public-header,.gp-hero-copy,.gp-hero-art,.gp-trust,.gp-section-heading,.gp-feature,.gp-audience-copy,.gp-preview-card,.gp-steps>div,.gp-final-cta>div,.gp-footer'));
  const staggerGroups=['.gp-feature-grid','.gp-steps','.gp-trust div','.gp-audience-copy ul','.gp-discover-grid','.gp-stat-grid','.gp-dashboard-grid'];
  staggerGroups.forEach(selector=>document.querySelectorAll(selector).forEach(group=>Array.from(group.children).forEach((child:Element,index)=>{const item=child as HTMLElement;item.style.setProperty('--gp-stagger',String(Math.min(index,7)*75)+'ms');item.classList.add('gp-stagger-reveal');})));
  revealTargets.forEach(el=>el.classList.add('gp-scroll-reveal'));
  if('IntersectionObserver' in window){
   const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('gp-is-revealed');observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px -42px 0px'});
   revealTargets.forEach(el=>observer.observe(el));
   revealObserver=observer;
  }else revealTargets.forEach(el=>el.classList.add('gp-is-revealed'));
  const progress=document.createElement('div');progress.className='gp-scroll-progress';progress.setAttribute('aria-hidden','true');document.body.appendChild(progress);
  const art=document.querySelector<HTMLElement>('.gp-hero-art');
  let raf=0;
  const updateProgress=()=>{raf=0;const max=document.documentElement.scrollHeight-window.innerHeight;const amount=max>0?window.scrollY/max:0;progress.style.transform='scaleX('+Math.max(0,Math.min(1,amount))+')';if(art)art.style.setProperty('--gp-parallax',String(Math.min(window.scrollY,500)));};
  const onScroll=()=>{if(!raf)raf=window.requestAnimationFrame(updateProgress);};
  window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',onScroll,{passive:true});updateProgress();
  const cards=document.querySelectorAll<HTMLElement>('.gp-feature,.gp-opportunity,.gp-preview-card,.gp-panel,.gp-stat,.gp-deal-card,.gp-poster,.gp-float-card');
  const animatedSections=document.querySelectorAll<HTMLElement>('.gp-hero,.gp-showcase,.gp-audience,.gp-final-cta,.gp-ticker-rails,.vc-signed-in-scenery');
  const motionObserver=('IntersectionObserver' in window)?new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('vc-offscreen',!entry.isIntersecting)),{rootMargin:'120px 0px'}):null;
  animatedSections.forEach(el=>motionObserver?.observe(el));
  const onVisibility=()=>document.documentElement.classList.toggle('vc-document-hidden',document.hidden);
  document.addEventListener('visibilitychange',onVisibility,{passive:true});onVisibility();
  let pointerFrame=0,lastPointer:PointerEvent|null=null,activeCard:HTMLElement|null=null;
  const hasFinePointer=window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const onPointerMove=(event:PointerEvent)=>{if(!hasFinePointer)return;lastPointer=event;if(!pointerFrame)pointerFrame=window.requestAnimationFrame(()=>{pointerFrame=0;if(!lastPointer||!activeCard)return;const e=lastPointer,target=activeCard,r=target.getBoundingClientRect();const x=Math.max(0,Math.min(1,(e.clientX-r.left)/Math.max(1,r.width))),y=Math.max(0,Math.min(1,(e.clientY-r.top)/Math.max(1,r.height)));target.style.setProperty('--gp-pointer-x',(x*100)+'%');target.style.setProperty('--gp-pointer-y',(y*100)+'%');target.style.setProperty('--gp-tilt-x',((.5-y)*3)+'deg');target.style.setProperty('--gp-tilt-y',((x-.5)*3)+'deg');});};
  const onPointerEnter=(event:PointerEvent)=>{activeCard=event.currentTarget as HTMLElement;};
  const onPointerLeave=(event:PointerEvent)=>{const target=event.currentTarget as HTMLElement;target.style.setProperty('--gp-tilt-x','0deg');target.style.setProperty('--gp-tilt-y','0deg');if(activeCard===target)activeCard=null;};
  if(hasFinePointer)cards.forEach(card=>{card.addEventListener('pointerenter',onPointerEnter,{passive:true});card.addEventListener('pointermove',onPointerMove,{passive:true});card.addEventListener('pointerleave',onPointerLeave,{passive:true});});
  return()=>{if(raf)window.cancelAnimationFrame(raf);if(pointerFrame)window.cancelAnimationFrame(pointerFrame);window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll);document.removeEventListener('visibilitychange',onVisibility);progress.remove();if(revealObserver)revealObserver.disconnect();motionObserver?.disconnect();if(hasFinePointer)cards.forEach(card=>{card.removeEventListener('pointerenter',onPointerEnter);card.removeEventListener('pointermove',onPointerMove);card.removeEventListener('pointerleave',onPointerLeave);});};
 },[]);
 useEffect(()=>{let active=true,authEventSeen=false;if(!supabase){setAuthChecked(true);return;}async function sync(nextSession:any){if(!active)return;setSession(nextSession);if(nextSession?.user){const{data,error}=await supabase!.rpc('is_admin');if(active)setAdminAllowed(Boolean(data&&!error));}else if(active)setAdminAllowed(false);if(active)setAuthChecked(true);}const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{authEventSeen=true;window.setTimeout(()=>void sync(nextSession),0);});restoreUserSession().then(user=>{if(!authEventSeen)void sync(user?{user}:null);}).catch(()=>{if(active&&!authEventSeen)setAuthChecked(true);});return()=>{active=false;subscription.unsubscribe();};},[]);
 if(authChecked&&session&&!adminAllowed){const role=new URLSearchParams(window.location.search).get('oauth_role');return <Navigate to={'/dashboard?tab=overview'+(role?'&oauth_role='+encodeURIComponent(role):'')} replace/>;}
 return <><header className="gp-public-header"><button className="gp-menu-toggle" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?<X size={21}/>:<Menu size={21}/>}</button><BrandLogo className="gp-brand-lockup"/><nav><a href="#platform">Platform</a><a href="#founders">For founders</a><a href="#investors">For investors</a><a href="#how">How it works</a><Link className="gp-membership-nav" to="/dashboard?tab=subscriptions">Membership</Link></nav><div className="gp-public-actions"><button className="gp-login" onClick={()=>navigate('/login')}>Log in</button><button className="gp-primary" onClick={()=>navigate('/signup')}>Create account <ArrowRight size={16}/></button></div></header>{menuOpen&&<><button className="gp-public-menu-scrim" aria-label="Close navigation menu" onClick={()=>setMenuOpen(false)}/><aside className="gp-public-menu"><div className="gp-public-menu-head"><BrandLogo className="gp-brand-lockup"/><button aria-label="Close menu" onClick={()=>setMenuOpen(false)}><X size={19}/></button></div><span className="gp-eyebrow">VENTORA CONNECT</span><button onClick={()=>{setMenuOpen(false);navigate("/dashboard")}}><Home/>Overview</button><button onClick={()=>{setMenuOpen(false);navigate("/dashboard?tab=profile")}}><UserRound/>Personal profile</button><button onClick={()=>{setMenuOpen(false);navigate("/dashboard?tab=investor")}}><TrendingUp/>Investor preferences</button><button onClick={()=>{setMenuOpen(false);navigate("/investors")}}><Users/>Discover investors</button><button onClick={()=>{setMenuOpen(false);navigate("/messages")}}><MessageSquare/>Messages</button>{session?.user&&adminAllowed&&<button onClick={()=>{setMenuOpen(false);navigate("/admin")}}><ShieldCheck/>Admin portal</button>}<div className="gp-public-menu-bottom"><button onClick={()=>{setMenuOpen(false);navigate("/login")}}>Log in</button><button className="gp-primary" onClick={()=>{setMenuOpen(false);navigate("/signup")}}>Create account <ArrowRight size={15}/></button></div></aside></>}<section className="gp-hero"><div className="gp-hero-copy"><div className="gp-pill"><Sparkles size={14}/> A new perspective on private markets</div><h1><span className="gp-hero-static">Big ideas deserve</span><KineticHeadline/></h1><p>Where ambitious founders meet thoughtful investors. Build relationships, discover opportunity and move your next chapter forward.</p><div className="gp-hero-actions"><button className="gp-primary gp-large" onClick={()=>navigate('/signup')}>Get started <ArrowRight size={18}/></button><button className="gp-text-btn" onClick={()=>document.getElementById('how')?.scrollIntoView({behavior:'smooth'})}>Explore the platform <ChevronRight size={17}/></button></div><div className="gp-proof"><div className="gp-proof-avatars"><span>J</span><span>M</span><span>A</span><span>+</span></div><div><b>A network built on possibility</b><small>For founders and investors at every stage</small></div></div><HeroDeck/></div><div className="gp-hero-art"><PosterWall/><div className="gp-art-orbit orbit-one"/><div className="gp-art-orbit orbit-two"/><div className="gp-art-center"><img className="gp-art-logo-image" src={BRAND_LOGO} alt="Ventora Connect"/><span>VENTORA NETWORK</span></div><div className="gp-float-card founder-card"><div className="gp-mini-avatar lavender">N</div><div><b>Northstar Robotics</b><small>Raising a seed round</small></div><span className="gp-dot"/></div><div className="gp-float-card investor-card"><div className="gp-mini-avatar mint">A</div><div><b>Alex Morgan</b><small>Early-stage investor</small></div><span className="gp-match">94% match</span></div><div className="gp-art-caption">Ideas move further together.</div></div></section><section className="gp-trust"><span>ONE PLATFORM. TWO PERSPECTIVES.</span><b>For the people building tomorrow.</b><div><span>FOUNDERS</span><span>INVESTORS</span><span>ADVISORS</span><span>ECOSYSTEM PARTNERS</span></div></section><section className="gp-section" id="platform"><div className="gp-section-heading"><p className="gp-eyebrow">A connected ecosystem</p><h2>Everything moves forward<br/>when the right pieces connect.</h2><p>From your first introduction to your next milestone, bring the important parts of your journey together.</p></div><div className="gp-feature-grid"><Feature icon={<Compass/>} title="Discover with intention" text="Find relevant companies, investors and opportunities with thoughtful filters and context."/><Feature icon={<Handshake/>} title="Build real relationships" text="Move beyond cold introductions with clear profiles and direct communication."/><Feature icon={<TrendingUp/>} title="Move deals forward" text="Organise opportunities, track progress and keep every conversation moving."/><Feature icon={<ShieldCheck/>} title="Share with confidence" text="Keep important company information and documents organised in one place."/></div></section><section className="gp-audience" id="founders"><div className="gp-audience-copy"><p className="gp-eyebrow">For founders</p><h2>Make your next<br/>chapter possible.</h2><p>Tell your story, get discovered by aligned investors and manage your fundraising journey with clarity.</p><ul><li><Check/> Build a compelling company profile</li><li><Check/> Discover investors aligned with your vision</li><li><Check/> Manage conversations and applications</li><li><Check/> Share documents when the time is right</li></ul><button className="gp-primary" onClick={()=>{navigate('/signup')}}>Create account <ArrowRight size={16}/></button></div><div className="gp-preview-card founder-preview"><div className="gp-preview-top"><span>COMPANY SNAPSHOT</span><span className="gp-live">● PROFILE PREVIEW</span></div><div className="gp-company-head"><div className="gp-company-logo">N</div><div><b>Northstar Robotics</b><small>Industrial technology · Austin, TX</small></div></div><p>Building autonomous systems for safer, more efficient industrial operations.</p><div className="gp-metrics"><div><small>Funding stage</small><b>Seed</b></div><div><small>Target raise</small><b>$1.8M</b></div><div><small>Profile strength</small><b>86%</b></div></div><div className="gp-progress"><span/></div><div className="gp-preview-footer"><span><Users size={15}/> Investor interest</span><b>12 new views this week ↗</b></div></div></section><section className="gp-audience investor-audience" id="investors"><div className="gp-preview-card deal-preview"><div className="gp-preview-top"><span>YOUR DEAL FLOW</span><span>THIS WEEK</span></div><div className="gp-deal-summary"><div><small>Active opportunities</small><b>24</b></div><div><small>In due diligence</small><b>06</b></div><div><small>New this week</small><b>08 ↗</b></div></div>{pipeline.slice(0,3).map((p,i)=><div className="gp-deal-row" key={p.name}><div className={'gp-mini-avatar '+['lavender','peach','mint'][i]}>{p.name[0]}</div><div><b>{p.name}</b><small>{p.stage} · {p.amount}</small></div><ChevronRight size={16}/></div>)}</div><div className="gp-audience-copy"><p className="gp-eyebrow">For investors</p><h2>Find conviction<br/>in what comes next.</h2><p>Discover promising companies, evaluate opportunities and keep your deal flow organised from first look to diligence.</p><ul><li><Check/> Discover companies that fit your thesis</li><li><Check/> Organise opportunities in a deal pipeline</li><li><Check/> Collaborate and communicate with founders</li><li><Check/> Review shared materials in one workspace</li></ul><button className="gp-primary" onClick={()=>{navigate('/signup')}}>Create account <ArrowRight size={16}/></button></div></section><Showcase onJoin={()=>navigate('/signup')}/><section className="gp-how" id="how"><p className="gp-eyebrow">A clearer path forward</p><h2>From first look to next step.</h2><div className="gp-steps"><div><span>01</span><b>Create your profile</b><p>Share who you are, what you're building and what you're looking for.</p></div><div><span>02</span><b>Find your people</b><p>Discover aligned founders, investors and opportunities.</p></div><div><span>03</span><b>Start a conversation</b><p>Connect directly and share the context that matters.</p></div><div><span>04</span><b>Move forward</b><p>Keep your opportunities and next steps organised.</p></div></div></section><PublicPlanComparison onNavigate={navigate}/><section className="gp-membership-spotlight"><div className="gp-membership-copy"><p className="gp-eyebrow">THE VENTORA INNER CIRCLE</p><h2>Make the next<br/><em>introduction count.</em></h2><p>Choose the access that matches your ambition — from thoughtful discovery to a more powerful private network.</p><button className="gp-primary gp-large" onClick={()=>navigate('/dashboard?tab=subscriptions')}>Explore membership <ArrowRight size={18}/></button></div><div className="gp-membership-poster"><span>VENTORA / MEMBERSHIP</span><b>ACCESS<br/>WITH<br/><i>INTENT.</i></b><small>PRO · FOUNDER PLUS · DEAL ROOM</small><div className="gp-membership-orbit"/></div><div className="gp-membership-preview"><span>MEMBER PREVIEW / 01</span><b>Priority discovery</b><small>Be seen by the people who matter.</small><i/><b>Deeper context</b><small>Bring more insight to every introduction.</small><i/><b>Private conversations</b><small>Move from interest to opportunity.</small></div></section><section className="gp-final-cta"><div><p className="gp-eyebrow">Your next chapter starts here</p><h2>Good things happen<br/>when ambition connects.</h2><p>Build with the people who see what you see.</p><button className="gp-primary gp-large" onClick={()=>navigate('/signup')}>Create your account <ArrowRight size={18}/></button></div></section><PublicQuestions/><footer className="gp-footer"><BrandLogo className="gp-brand-lockup"/><span>Where ambition meets opportunity.</span><div><a href="#platform">Platform</a><a href="#founders">Founders</a><a href="#investors">Investors</a><a href="/dashboard?tab=subscriptions" className="gp-membership-nav">Membership</a><a href="mailto:hello@ventora.com">Contact</a></div><small>© 2026 Ventora Connect. All rights reserved.</small></footer></>;
}


function PublicPlanComparison({onNavigate}:{onNavigate:(path:string)=>void}){
 const[plans,setPlans]=useState<any[]>([]);
 const[currentPlan,setCurrentPlan]=useState<string|null>(null);
 const[loaded,setLoaded]=useState(false);
 useEffect(()=>{
  let active=true;
  async function load(){
   if(!supabase){if(active)setLoaded(true);return;}
   const[planResult,userResult]=await Promise.all([
    supabase.from('subscription_plans').select('id,name,description,price_inr,account_type,display_order,features,is_active').eq('is_active',true).order('display_order'),
    restoreUserSession()
   ]);
   if(!active)return;
   if(!planResult.error)setPlans(planResult.data||[]);
   if(userResult?.id){
    const subscription=await supabase.from('subscriptions').select('plan_id,status').eq('user_id',userResult.id).maybeSingle();
    if(!active)return;
    setCurrentPlan(subscription.data?.plan_id||null);
   }
   setLoaded(true);
  }
  void load().catch(()=>{if(active)setLoaded(true)});
  return()=>{active=false};
 },[]);
 const groups=[{key:'business',label:'For businesses',sub:'Build visibility, meet aligned investors and move opportunities forward.'},{key:'investor',label:'For investors',sub:'Discover companies, organise deal flow and build founder relationships.'}];
 const features=(plan:any)=>{
  const f=plan.features||{};
  const values=plan.account_type==='business'?[
   ['Company profiles',f.max_business_profiles===-1?'Unlimited':f.max_business_profiles??'Not listed'],
   ['Monthly profile views',f.monthly_profile_views===-1?'Unlimited':f.monthly_profile_views??'Not listed'],
   ['Discovery',f.advanced_discovery?'Advanced filters':'Standard filters'],
   ['Introductions',f.monthly_connections===-1?'Unlimited':f.monthly_connections??'Not listed'],
   ['Messaging',f.messaging?'Included':'Not included'],
   ['Insights & support',f.analytics?'Analytics included':f.priority_support?'Priority support':'Standard support']
  ]:[
   ['Business profile views',f.monthly_business_views===-1?'Unlimited':f.monthly_business_views??'Not listed'],
   ['Saved profiles',f.saved_profiles===-1?'Unlimited':f.saved_profiles??'Not listed'],
   ['Discovery',f.advanced_filters?'Advanced filters':'Standard filters'],
   ['Messaging',f.messaging?'Included':'Not included'],
   ['Investment interest',f.express_interest?'Included':'Not included'],
   ['Deal access',f.pitch_deck_access?'Private materials access':f.portfolio_access?'Portfolio access':'Standard access']
  ];
  return values;
 };
 if(!loaded||!plans.length)return null;
 return <section className="gp-home-plans" id="plan-comparisons">
  <div className="gp-home-plans-head"><p className="gp-eyebrow">VENTORA CONNECT / MEMBERSHIP GUIDE</p><h2>Plan comparisons.<br/><em>Choose your next level.</em></h2><p>Every active membership tier, with pricing and access drawn from Ventora’s published plan catalogue.</p></div>
  {groups.map(group=>{
   const groupPlans=plans.filter(p=>p.account_type===group.key);
   if(!groupPlans.length)return null;
   return <div className="gp-home-plan-group" key={group.key}>
    <div className="gp-home-plan-group-head"><div><span>{group.key==='business'?'01 / BUSINESS MEMBERSHIPS':'02 / INVESTOR MEMBERSHIPS'}</span><h3>{group.label}</h3></div><p>{group.sub}</p></div>
    <div className="gp-home-plan-grid">
     {groupPlans.map((plan:any)=>{
      const current=plan.id===currentPlan;
      return <article className={'gp-home-plan-card'+(current?' is-current':'')} key={plan.id}>
       <div className="gp-home-plan-card-top"><span>{current?'YOUR CURRENT PLAN':Number(plan.price_inr)===0?'START HERE':'MEMBERSHIP TIER'}</span>{current&&<b>ACTIVE</b>}</div>
       <h4>{plan.name}</h4><p className="gp-home-plan-description">{plan.description}</p>
       <div className="gp-home-plan-price"><strong>₹{Number(plan.price_inr||0).toLocaleString('en-IN')}</strong><span>/ month</span></div>
       <ul>{features(plan).map(([label,value]:any)=><li key={label}><span>{label}</span><b>{String(value)}</b></li>)}</ul>
       <button type="button" className={current?'is-current-button':''} onClick={()=>onNavigate(current?'/dashboard?tab=subscriptions':currentPlan?'/dashboard?tab=subscriptions':'/signup')}>{current?'Manage membership':currentPlan?'Explore upgrade':'Choose this plan'} <ArrowRight size={16}/></button>
       <small>{Number(plan.price_inr)>0?'Paid access is activated after payment review.':'Free access is activated in your workspace.'}</small>
      </article>
     })}
    </div>
   </div>
  })}
  <div className="gp-home-plan-foot"><ShieldCheck size={18}/><p>Plan features reflect the active catalogue. Some capabilities depend on account type, profile completion and verification status.</p><button type="button" onClick={()=>onNavigate(currentPlan?'/dashboard?tab=subscriptions':'/signup')}>View membership options <ArrowRight size={15}/></button></div>
 </section>;
}

function PublicQuestions(){
 const items=[
  {q:'How does discovery and matching work?',a:'Complete your business or investor profile with accurate details, preferences and interests. Ventora uses the information members choose to share to help surface relevant profiles and opportunities. Review each profile and start a conversation when there is a genuine fit; a match is an introduction signal, not an endorsement or funding guarantee.'},
  {q:'How do I complete my profile?',a:'Create an account, open your workspace and visit Personal profile. Businesses can add company details, funding requirements and a pitch deck from Manage businesses. Investors can add preferred industries, stages, locations and investment strategy under Investor preferences. Keep information current so other members can assess fit.'},
  {q:'How do I verify my account or business?',a:'Open Verification in your workspace and submit the requested information. The Ventora team reviews submitted details and updates the request status in your account. Verification is a review process and does not guarantee investment, funding or commercial outcomes.'},
  {q:'What do membership plans include, and how do upgrades work?',a:'The plan comparison above lists the active tiers and their published monthly prices and features. Choose a plan from your workspace Membership page. Free access can be activated in the workspace; paid requests continue through the available payment and review flow. Paid access starts only after the payment has been reviewed and the plan approved.'},
  {q:'How can I contact support or share feedback?',a:'Use Support in your workspace to contact the team, or open Feedback to share a suggestion or report an issue. You can also reach Ventora at hello@ventora.com.'},
  {q:'Who can see my information, and how do I control my account?',a:'Only publish information you are comfortable sharing with the network. Private materials and account functions are governed by your access level and the platform’s privacy controls. Review the Privacy page for details, and use Settings in your workspace to manage available account preferences.'}
 ];
 return <section className="gp-home-faq" id="questions-and-answers">
  <div className="gp-home-faq-intro"><p className="gp-eyebrow">A FEW THINGS WORTH KNOWING</p><h2>Questions &amp;<br/><em>answers.</em></h2><p>Clear guidance for making the most of your Ventora membership.</p><Link to="/support">Still have a question? Contact support <ArrowRight size={15}/></Link></div>
  <div className="gp-home-faq-list">{items.map((item,index)=><details key={item.q} className="gp-home-faq-item"><summary><span>{String(index+1).padStart(2,'0')}</span><b>{item.q}</b><i aria-hidden="true"/></summary><p>{item.a}</p></details>)}</div>
 </section>;
}


function KineticHeadline(){
 const [typed,setTyped]=useState('');
 useEffect(()=>{
  const phrases=['the right people.','the right capital.','a bigger stage.','a bold next step.'];
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setTyped(phrases[0]);return;}
  const glyphs='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789◆◇';
  let phraseIndex=0,letter=0,deleting=false,timeout=0,cancelled=false;
  const tick=()=>{if(cancelled)return;const phrase=phrases[phraseIndex];if(!deleting){letter=Math.min(letter+1,phrase.length);const prefix=phrase.slice(0,Math.max(0,letter-1));const scramble=letter<phrase.length?glyphs[(letter*7+phraseIndex*11)%glyphs.length]:'';setTyped(prefix+(letter<phrase.length?scramble:'' )+(letter===phrase.length?phrase.slice(-1):''));if(letter===phrase.length){setTyped(phrase);deleting=true;timeout=window.setTimeout(tick,1650);return;}}else{letter=Math.max(0,letter-1);setTyped(phrase.slice(0,letter));if(letter===0){deleting=false;phraseIndex=(phraseIndex+1)%phrases.length;timeout=window.setTimeout(tick,260);return;}}timeout=window.setTimeout(tick,deleting?48:92);};
  timeout=window.setTimeout(tick,380);return()=>{cancelled=true;window.clearTimeout(timeout);};
 },[]);
 return <em className="gp-typewrite" aria-label={typed||"the right people."}><span aria-hidden="true">{typed}</span><i className="gp-type-cursor" aria-hidden="true"/></em>;
}
function HeroDeck(){
 const [active,setActive]=useState<'deal'|'thesis'|'network'>('deal');
 return <div className="gp-hero-deck" aria-label="Live platform preview"><div className="gp-deck-heading"><span>LIVE STUDIO DECK</span><i><b/> THREE PERSPECTIVES</i></div><div className="gp-deck-tabs" role="tablist" aria-label="Choose a preview"><button type="button" role="tab" aria-selected={active==='deal'} className={active==='deal'?'active':''} onClick={()=>setActive('deal')}>01 / Deal room</button><button type="button" role="tab" aria-selected={active==='thesis'} className={active==='thesis'?'active':''} onClick={()=>setActive('thesis')}>02 / Founder thesis</button><button type="button" role="tab" aria-selected={active==='network'} className={active==='network'?'active':''} onClick={()=>setActive('network')}>03 / Network</button></div><div className="gp-deck-preview" key={active}><div className="gp-deck-preview-mark">{active==='deal'?'DR':active==='thesis'?'FT':'VN'}</div><div><small>{active==='deal'?'NORTHSTAR ROBOTICS · SEED ROUND':active==='thesis'?'FOUNDER THESIS · INDUSTRIAL AI':'VENTORA NETWORK · INTRODUCTIONS'}</small><b>{active==='deal'?'A round with momentum.':active==='thesis'?'A thesis worth backing.':'The right people, connected.'}</b><span>{active==='deal'?'4 investors reviewing · $1.8M target':active==='thesis'?'Autonomy · Infrastructure · Climate':'Founders · Investors · Advisors'}</span></div><span className="gp-deck-live">LIVE</span></div></div>;
}
function PosterWall(){
 const [focus,setFocus]=useState<0|1|2>(0); const navigate=useNavigate();
 useEffect(()=>{if(!focus)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setFocus(0)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[focus]);
 return <><button type="button" className="gp-poster gp-poster-one" aria-label="Explore Ideas Find People poster" aria-expanded={focus===1} onClick={()=>setFocus(focus===1?0:1)}><small>VENTORA / 01</small><b>IDEAS<br/>FIND<br/><i>PEOPLE.</i></b><span>BUILD WHAT'S NEXT</span><div/><i className="gp-poster-open">↗</i></button><button type="button" className="gp-poster gp-poster-two" aria-label="Explore Capital Meets Clarity poster" aria-expanded={focus===2} onClick={()=>setFocus(focus===2?0:2)}><small>VENTORA / 02</small><b>CAPITAL<br/><i>MEETS</i><br/>CLARITY.</b><span>THE NETWORK EFFECT</span><div/><i className="gp-poster-open">↗</i></button>{focus!==0&&createPortal(<><button className="gp-poster-focus-scrim" aria-label="Close poster showcase" onClick={()=>setFocus(0)}/><div className="gp-poster-focus" role="dialog" aria-modal="true" aria-label="Ventora editorial poster"><button type="button" className="gp-poster-focus-close" onClick={()=>setFocus(0)} aria-label="Close poster">×</button><span>VENTORA / 0{focus}</span><strong>{focus===1?'IDEAS FIND PEOPLE.':'CAPITAL MEETS CLARITY.'}</strong><p>{focus===1?'A connected studio for founders, investors and the people who help ideas move forward.':'A clearer way to discover aligned opportunities, build conviction and move capital with context.'}</p><button type="button" className="gp-primary" onClick={()=>{setFocus(0);navigate("/signup")}}>Enter the network <ArrowRight size={16}/></button></div></>,document.body)}</>;
}

function Showcase({onJoin}:{onJoin:()=>void}){
 const [active,setActive]=useState<'founder'|'investor'|'network'>('founder');
 useEffect(()=>{const order:Array<'founder'|'investor'|'network'>=['founder','investor','network'];if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const timer=window.setInterval(()=>setActive(current=>order[(order.indexOf(current)+1)%order.length]),5600);return()=>window.clearInterval(timer);},[]);
 const panels={
  founder:{eyebrow:'FOUNDER VIEW',title:'Your story, in the right room.',copy:'A clear company profile helps aligned investors understand your vision, traction and next milestone.',stats:[['Profile strength','86%'],['Investor views','128'],['New interest','12']],items:['Company story & milestones','Fundraising snapshot','Investor conversations']},
  investor:{eyebrow:'INVESTOR VIEW',title:'A sharper lens on opportunity.',copy:'Bring discovery, evaluation and deal flow into one focused workspace built around your investment thesis.',stats:[['Active opportunities','24'],['In diligence','06'],['New this week','08']],items:['Thesis-aligned discovery','Organised deal pipeline','Founder communication']},
  network:{eyebrow:'CONNECTED NETWORK',title:'Good introductions create momentum.',copy:'Move from discovery to meaningful conversations with context that makes every connection count.',stats:[['Potential matches','94%'],['Shared context','1 place'],['Next step','Connect']],items:['Relevant people, not noise','Context-rich profiles','A clear path forward']}
 };
 const p=panels[active];
 return <section className="gp-showcase" id="showcase"><div className="gp-showcase-heading"><p className="gp-eyebrow">THE VENTORA EXPERIENCE</p><h2>One network.<br/><em>Three ways to move forward.</em></h2><p>Switch perspectives and explore how the platform brings every side of the journey together.</p><div className="gp-showcase-tabs" role="tablist" aria-label="Platform perspectives"><button role="tab" aria-selected={active==='founder'} className={active==='founder'?'active':''} onClick={()=>setActive('founder')}>For founders</button><button role="tab" aria-selected={active==='investor'} className={active==='investor'?'active':''} onClick={()=>setActive('investor')}>For investors</button><button role="tab" aria-selected={active==='network'} className={active==='network'?'active':''} onClick={()=>setActive('network')}>The network</button></div></div><div className="gp-showcase-stage" key={active}><div className="gp-showcase-orbit gp-showcase-orbit-a"/><div className="gp-showcase-orbit gp-showcase-orbit-b"/><div className="gp-showcase-window"><div className="gp-showcase-windowbar"><span/><span/><span/><b>VENTORA / {active.toUpperCase()}</b><i>LIVE PREVIEW</i></div><div className="gp-showcase-content"><div className="gp-showcase-copy"><small>{p.eyebrow}</small><h3>{p.title}</h3><p>{p.copy}</p><ul>{p.items.map(item=><li key={item}><Check size={15}/>{item}</li>)}</ul><button className="gp-primary" onClick={onJoin}>Explore Ventora <ArrowRight size={16}/></button></div><div className="gp-showcase-data"><div className="gp-showcase-datahead"><div className="gp-company-logo lavender">{active==='founder'?'N':active==='investor'?'A':'V'}</div><div><b>{active==='founder'?'Northstar Robotics':active==='investor'?'Alex Morgan':'Ventora Network'}</b><small>{active==='founder'?'Company workspace':active==='investor'?'Investor workspace':'Connected ecosystem'}</small></div><span className="gp-live">● ACTIVE</span></div><div className="gp-showcase-stats">{p.stats.map(([label,value])=><div key={label}><small>{label}</small><b>{value}</b></div>)}</div><div className="gp-showcase-activity"><div><span className="gp-mini-avatar mint">{active==='investor'?'M':'A'}</span><span><b>{active==='investor'?'Morrow Health':'A new connection'}</b><small>{active==='investor'?'Seed · Digital health':'Shared interests found'}</small></span><i>Just now</i></div><div><span className="gp-mini-avatar peach">{active==='founder'?'I':'N'}</span><span><b>{active==='founder'?'Investor interest':'Northstar Robotics'}</b><small>{active==='founder'?'12 profile views this week':'Potential fit · Seed'}</small></span><i>Today</i></div></div><div className="gp-showcase-chart"><span>Momentum over time</span><div><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div></div></div></div></div><div className="gp-ticker-rails" aria-hidden="true"><div className="gp-ticker-track"><span>IDEAS FIND PEOPLE</span><i>✳</i><span>CAPITAL MEETS CLARITY</span><i>✳</i><span>FOUNDERS / INVESTORS / ADVISORS</span><i>✳</i><span>MOVE WHAT MATTERS FORWARD</span><i>✳</i><span>IDEAS FIND PEOPLE</span><i>✳</i></div><div className="gp-ticker-track reverse"><span>VENTORA NETWORK</span><i>✳</i><span>DISCOVER WITH INTENTION</span><i>✳</i><span>BUILD REAL RELATIONSHIPS</span><i>✳</i><span>MOVE DEALS FORWARD</span><i>✳</i><span>VENTORA NETWORK</span><i>✳</i></div></div></section>;
}

function Feature({icon,title,text}:any){return <article className="gp-feature"><div>{icon}</div><h3>{title}</h3><p>{text}</p><ArrowRight size={17}/></article>}
