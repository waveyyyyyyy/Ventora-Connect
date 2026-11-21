import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';
import WorkspaceNavigation from './WorkspaceNavigation';

type Props={children:ReactNode;className?:string;actionTo?:string;actionLabel?:string};
export default function MemberSectionLayout({children,className='',actionTo='/dashboard',actionLabel='Workspace'}:Props){
 return <div className={'vc-member-section '+className}>
  <WorkspaceNavigation/>
  <header className="vc-member-section-topbar">
   <div className="vc-member-section-brand"><span>VΞNTORA</span><small>CONNECT</small></div>
   <div className="vc-member-section-topbar-note">MEMBER WORKSPACE</div>
   <Link to={actionTo} className="vc-member-section-home">{actionLabel}</Link>
  </header>
  <main className="vc-member-section-content">{children}</main>
 </div>;
}
