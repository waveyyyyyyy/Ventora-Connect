import {Link} from 'react-router-dom';

type Props={light?:boolean;to?:string;className?:string};
export default function BrandLogo({light=false,to='/',className=''}:Props){
 return <Link to={to} className={['brand',light?'brand-light':'',className].filter(Boolean).join(' ')} aria-label="Ventora Connect home">
  <img className="brand-mark" src={import.meta.env.BASE_URL+'ventora-icon.svg'} alt=""/>
  <span className="brand-copy"><span className="brand-word">V<span className="brand-e">Ξ</span>NTORA</span><span className="brand-sub">CONNECT</span></span>
 </Link>;
}
