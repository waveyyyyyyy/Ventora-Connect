import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {Bell,Search,UserRound} from 'lucide-react';
import WorkspaceNavigation from './WorkspaceNavigation';
import BrandLogo from './BrandLogo';

type Props={children:ReactNode;className?:string;actionTo?:string;actionLabel?:string;user?:any};
export default function MemberSectionLayout({children,className='',user}:Props){
 const initials=String(user?.user_metadata?.full_name||user?.user_metadata?.name||'').trim().split(/\\s+/).filter(Boolean).map((part:string)=>part[0]).join('').slice(0,2).toUpperCase()||'V';
 return <div className={'vc-member-section '+className}>
  <header className="workspace-topbar vc-unified-member-topbar vc-overview-identical-topbar">
   <WorkspaceNavigation user={user}/>
   <BrandLogo to="/dashboard?tab=overview" className="workspace-topbar-logo"/>
   <label className="workspace-command vc-member-command"><Search size={16}/><span>Workspace</span></label>
   <div className="topbar-actions">
    <Link to="/dashboard?tab=notifications" aria-label="Notifications" title="Notifications"><Bell size={18}/></Link>
    <Link to="/dashboard?tab=profile" className="topbar-avatar vc-member-topbar-avatar" aria-label="Personal profile" title="Personal profile"><span>{initials}</span><UserRound size={13}/></Link>
   </div>
  </header>
  <div className="vc-member-section-content">{children}</div>
 </div>;
}
