const fs = require('fs');
let code = fs.readFileSync('c:/Users/mirza/OneDrive/Desktop/admin portal/frontend/src/layouts/AdminLayout.jsx', 'utf8');

if (!code.includes('CreditCard')) {
    code = code.replace("KeyRound, Star", "KeyRound, Star, CreditCard");
}

const target = `<div className="nav-category mt-4">MANAGEMENT</div>
          <ul className="nav-list">
            <li className="nav-item">
              <NavLink to="/pending-rides" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <AlertCircle size={18} />
                <span>Pending Rides</span>
              </NavLink>
            </li>
          </ul>`;
          
const replacement = target + `\n\n          <div className="nav-category mt-4">FINANCE</div>
          <ul className="nav-list">
            <li className="nav-item">
              <NavLink to="/payment-tracking" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
                <CreditCard size={18} />
                <span>Payment Tracking</span>
              </NavLink>
            </li>
          </ul>`;

if (code.includes(target) && !code.includes("Payment Tracking")) {
    code = code.replace(target, replacement);
    fs.writeFileSync('c:/Users/mirza/OneDrive/Desktop/admin portal/frontend/src/layouts/AdminLayout.jsx', code, 'utf8');
    console.log('Layout patched');
} else {
    console.log('Target not found or already patched');
}
