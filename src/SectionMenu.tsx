import {useState} from 'react';
import {Link} from 'react-router-dom';
import {MoreVertical,X,LayoutDashboard,MessageCircle,Users,Sparkles,Bookmark,Bell,LifeBuoy} from 'lucide-react';
import './section-menu.css';
const links=[['/dashboard','Workspace overview',LayoutDashboard],['/messages','Messages',MessageCircle],['/interests','Investment interests',Users],['/matches','Suggested matches',Sparkles],['/saved','Saved profiles',Bookmark],['/announcements','Announcements',Bell],['/support','Support',LifeBuoy]] as const;
export default function SectionMenu(){const[open,setOpen]=useState(false);return <div className="vc-section-menu"><button type="button" className="vc-section-menu-trigger" aria-label="Open section menu" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?<X size={19}/>:<MoreVertical size={20}/>}</button>{open&&<><button className="vc-section-menu-scrim" aria-label="Close section menu" onClick={()=>setOpen(false)}/><nav className="vc-section-menu-panel" aria-label="Workspace sections">{links.map(([to,label,Icon])=><Link key={to} to={to} onClick={()=>setOpen(false)}><Icon size={16}/>{label}</Link>)}</nav></>}</div>}
