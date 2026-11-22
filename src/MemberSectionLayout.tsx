import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';
import WorkspaceNavigation from './WorkspaceNavigation';
import BrandLogo from './BrandLogo';

type Props={children:ReactNode;className?:string;actionTo?:string;actionLabel?:string;user?:any};
export default function MemberSectionLayout({children,className='',actionTo='/dashboard',actionLabel='Workspace',user}:Props){
 return <div className={'vc-member-section '+className}>
  <WorkspaceNavigation user={user}/>
  <header className="vc-member-section-topbar">
   <BrandLogo light to="/dashboard?tab=overview" className="vc-member-section-logo"/>
   <Link to={actionTo} className="vc-member-section-home">{actionLabel}</Link>
  </header>
  <div className="vc-member-section-content">{children}</div>
 </div>;
}
