const fs = require('fs');
let code = fs.readFileSync('c:/Users/mirza/OneDrive/Desktop/admin portal/frontend/src/App.jsx', 'utf8');

// Add import
if (!code.includes("import PaymentTracking")) {
    code = code.replace("import DriverIssues from './pages/DriverIssues';", "import DriverIssues from './pages/DriverIssues';\nimport PaymentTracking from './pages/PaymentTracking';");
}

// Add route
if (!code.includes('path="payment-tracking"')) {
    code = code.replace('<Route path="pending-rides" element={<PendingRides />} />', '<Route path="pending-rides" element={<PendingRides />} />\n          <Route path="payment-tracking" element={<PaymentTracking />} />');
}

fs.writeFileSync('c:/Users/mirza/OneDrive/Desktop/admin portal/frontend/src/App.jsx', code, 'utf8');
console.log('App patched');
