import {Link} from 'react-router-dom';
import {LayoutDashboard,UserRound,Building2,ChartNoAxesCombined,FileCheck,MessageCircle,Target,Sparkles,Bookmark,BellRing,Bell,LifeBuoy,Settings,Compass,ShieldCheck,LogOut,LockKeyhole,Users, type LucideIcon} from 'lucide-react';

type Member={email?:string;user_metadata?:Record<string,any>};
type MemberProfile={full_name?:string|null;account_type?:'business'|'investor'|string|null;avatar_url?:string|null};
type Props={
  user:Member|null;
  profile?:MemberProfile|null;
  adminAllowed?:boolean;
  open:boolean;
  alwaysVisible?:boolean;
  activeKey?:string;
  notificationCount?:number;
  onClose:()=>void;
  onNavigate:(key:string)=>void;
  onSignOut:()=>void;
};

const workspaceLinks:Array<{key:string;label:string;icon:LucideIcon;role?:'business'|'investor'}>=[
  {key:'overview',label:'Overview',icon:LayoutDashboard},
  {key:'profile',label:'Personal profile',icon:UserRound},
  {key:'business',label:'Company profile',icon:Building2,role:'business'},
  {key:'investor',label:'Investor preferences',icon:ChartNoAxesCombined,role:'investor'},
  {key:'verification',label:'Verification',icon:FileCheck},
  {key:'messages',label:'Messages',icon:MessageCircle},
  {key:'interests',label:'Funding interests',icon:Target},
  {key:'matches',label:'Suggested matches',icon:Sparkles},
  {key:'saved',label:'Saved profiles',icon:Bookmark},
  {key:'announcements',label:'Announcements',icon:BellRing},
  {key:'notifications',label:'Notifications',icon:Bell},
  {key:'support',label:'Help & support',icon:LifeBuoy},
  {key:'subscriptions',label:'Membership',icon:Sparkles},
  {key:'settings',label:'Account settings',icon:Settings},
];

export default function WorkspaceSidebar({user,profile,adminAllowed=false,open,alwaysVisible=false,activeKey='',notificationCount=0,onClose,onNavigate,onSignOut}:Props){
  if(!open&&!alwaysVisible)return null;
  const name=profile?.full_name||user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email||'Ventora member';
  const accountType=profile?.account_type||user?.user_metadata?.account_type||'business';
  const initials=String(name).trim().slice(0,1).toUpperCase()||'V';
  const visibleLinks=workspaceLinks.filter(item=>!item.role||item.role===accountType);
  return <>
    {open&&<button type="button" className="workspace-menu-backdrop" aria-label="Close navigation menu" onClick={onClose}/>}
    <aside className="workspace-sidebar workspace-sidebar-open gust-workspace-sidebar" aria-label="Main navigation">
      <Link to="/" onClick={onClose} className="workspace-brand"><span>VΞNTORA</span><small>CONNECT</small></Link>
      {user?<>
        <div className="workspace-member">
          {profile?.avatar_url?<img className="member-avatar-image" src={profile.avatar_url} alt=""/>:<div className="member-avatar">{initials}</div>}
          <div><strong>{name}</strong><small>{accountType==='investor'?'Investor account':'Business account'}</small></div>
        </div>
        <div className="workspace-nav-label">WORKSPACE</div>
        <nav>{visibleLinks.map(({key,label,icon:Icon})=><button type="button" key={key} className={activeKey===key?'active':''} onClick={()=>onNavigate(key)}><Icon size={17}/>{label}{key==='notifications'&&notificationCount>0&&<i>{notificationCount}</i>}</button>)}</nav>
        <div className="workspace-nav-label">DISCOVER</div>
        <nav>
          <button type="button" className={activeKey==='business-listings'?'active':''} onClick={()=>onNavigate('business-listings')}><Compass size={17}/>Business listings</button>
          <button type="button" className={activeKey==='investor-directory'?'active':''} onClick={()=>onNavigate('investor-directory')}><ChartNoAxesCombined size={17}/>Investor directory</button>
        </nav>
        {adminAllowed&&<><div className="workspace-nav-label">ADMINISTRATION</div><nav><button type="button" className={activeKey==='admin'?'active':''} onClick={()=>onNavigate('admin')}><ShieldCheck size={17}/>Admin portal</button></nav></>}
        <div className="workspace-sidebar-bottom"><button type="button" onClick={onSignOut}><LogOut size={16}/>Sign out</button></div>
      </>:<>
        <div className="workspace-member"><div className="member-avatar"><Users size={18}/></div><div><strong>Welcome to Ventora</strong><small>Discover founders and investors</small></div></div>
        <div className="workspace-nav-label">MEMBER ACCESS</div>
        <nav><button type="button" onClick={()=>onNavigate('login')}><LockKeyhole size={17}/>Log in</button><button type="button" onClick={()=>onNavigate('signup')}><Users size={17}/>Create an account</button></nav>
        <div className="workspace-nav-label">DISCOVER</div>
        <nav><button type="button" onClick={()=>onNavigate('business-listings')}><Building2 size={17}/>Business listings</button><button type="button" onClick={()=>onNavigate('investor-directory')}><ChartNoAxesCombined size={17}/>Investor directory</button></nav>
      </>}
    </aside>
  </>;
}
