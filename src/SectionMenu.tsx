import {useEffect,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {supabase} from './lib/supabase';
import {Menu,X,LayoutDashboard,UserRound,Building2,FileCheck,MessageCircle,Target,Sparkles,Bookmark,BellRing,Bell,LifeBuoy,Compass,Settings,LogOut,ShieldCheck,ChartNoAxesCombined} from 'lucide-react';

type Member={id:string;email?:string;created_at?:string;full_name?:string;account_type?:'business'|'investor'};
const mainLinks=[
  {label:'Overview',to:'/dashboard?tab=overview',icon:LayoutDashboard,key:'overview'},
  {label:'Personal profile',to:'/dashboard?tab=profile',icon:UserRound,key:'profile'},
  {label:'Manage businesses',to:'/dashboard?tab=business',icon:Building2,key:'business',role:'business'},
  {label:'Investor preferences',to:'/dashboard?tab=investor',icon:ChartNoAxesCombined,key:'investor',role:'investor'},
  {label:'Verification',to:'/dashboard?tab=verification',icon:FileCheck,key:'verification'},
  {label:'Messages',to:'/messages',icon:MessageCircle,key:'messages'},
  {label:'Investment interests',to:'/interests',icon:Target,key:'interests'},
  {label:'Suggested matches',to:'/matches',icon:Sparkles,key:'matches'},
  {label:'Saved profiles',to:'/saved',icon:Bookmark,key:'saved'},
  {label:'Announcements',to:'/announcements',icon:BellRing,key:'announcements'},
  {label:'Notifications',to:'/dashboard?tab=notifications',icon:Bell,key:'notifications'},
  {label:'Support',to:'/support',icon:LifeBuoy,key:'support'},
  {label:'Subscriptions',to:'/dashboard?tab=subscriptions',icon:Sparkles,key:'subscriptions'},
  {label:'Settings',to:'/dashboard?tab=settings',icon:Settings,key:'settings'}
];
export default function SectionMenu(){
 const[open,setOpen]=useState(false);
 const[member,setMember]=useState<Member|null>(null);
 const[admin,setAdmin]=useState(false);
 const location=useLocation();
 const navigate=useNavigate();
 useEffect(()=>{let active=true;async function load(){if(!supabase)return;const{data}=await supabase.auth.getUser();if(!active||!data.user)return;const u=data.user;const{data:profile}=await supabase.from('profiles').select('full_name,account_type').eq('id',u.id).maybeSingle();if(!active)return;setMember({id:u.id,email:u.email,created_at:u.created_at,full_name:profile?.full_name||u.user_metadata?.full_name||u.user_metadata?.name||'',account_type:profile?.account_type||'business'});const result=await supabase.rpc('is_admin');if(active)setAdmin(Boolean(result.data&&!result.error));}void load();return()=>{active=false}},[]);
 useEffect(()=>{setOpen(false)},[location.pathname,location.search]);
 useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[open]);
 const activeKey=location.pathname==='/messages'?'messages':location.pathname==='/interests'?'interests':location.pathname==='/matches'?'matches':location.pathname==='/saved'?'saved':location.pathname==='/announcements'?'announcements':location.pathname==='/support'?'support':location.pathname==='/businesses'?'business-listings':new URLSearchParams(location.search).get('tab')||'overview';
 function go(to:string){setOpen(false);navigate(to)}
 async function signOut(){setOpen(false);await supabase?.auth.signOut();navigate('/')}
 const visible=mainLinks.filter(item=>!item.role||item.role===member?.account_type);
 return <><button type="button" className="section-drawer-trigger" aria-label={open?'Close workspace navigation':'Open workspace navigation'} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?<X size={23}/>:<Menu size={25}/>}</button>{open&&<><button type="button" className="workspace-menu-backdrop section-drawer-backdrop" aria-label="Close navigation menu" onClick={()=>setOpen(false)}/><aside className="workspace-sidebar workspace-sidebar-open section-drawer" aria-label="Workspace navigation"><a href="/" className="workspace-brand" onClick={e=>{e.preventDefault();go('/')}}><span>VΞNTORA</span><small>CONNECT</small></a><div className="workspace-member"><div className="member-avatar">{(member?.full_name||member?.email||'V').slice(0,1).toUpperCase()}</div><div><strong>{member?.full_name||'Ventora member'}</strong><small>{member?.account_type==='investor'?'Investor account':'Business account'}</small><span className="workspace-role-badge">{member?.account_type==='investor'?'INVESTOR':'FOUNDER'}</span></div></div><div className="workspace-nav-label">WORKSPACE</div><nav>{visible.map(({label,to,icon:Icon,key})=><button type="button" key={key} className={activeKey===key?'active':''} onClick={()=>go(to)}><Icon size={19}/>{label}</button>)}</nav><div className="workspace-nav-label">DISCOVER</div><nav><button type="button" className={activeKey==='business-listings'?'active':''} onClick={()=>go('/businesses')}><Compass size={19}/>Business Listings</button><button type="button" onClick={()=>go('/investors')}><Compass size={19}/>Investor Directory</button></nav>{admin&&<><div className="workspace-nav-label">ADMINISTRATION</div><nav><button type="button" onClick={()=>go('/admin')}><ShieldCheck size={19}/>Admin Portal</button></nav></>}<div className="workspace-sidebar-bottom"><button type="button" onClick={signOut}><LogOut size={18}/> Sign out</button></div></aside></>}</>;
}
