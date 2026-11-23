import {Link} from 'react-router-dom';
import BrandLogo from './BrandLogo';

export default function VentoraFooter(){
 return <footer className="vc-editorial-footer">
  <div className="vc-editorial-footer-main">
   <div className="vc-editorial-footer-brand"><BrandLogo to="/" /><p>Where ambition meets opportunity.</p></div>
   <nav aria-label="Footer navigation">
    <Link to="/businesses">Businesses</Link><Link to="/investors">Investors</Link><Link to="/faq">Help centre</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link>
   </nav>
  </div>
  <div className="vc-editorial-footer-bottom"><span>© {new Date().getFullYear()} VENTORA CONNECT. ALL RIGHTS RESERVED.</span><span>BUILT FOR AMBITION.</span></div>
 </footer>;
}
