const fs = require('fs'); 
const content = fs.readFileSync('src/pages/AdminDashboard.jsx', 'utf8'); 
const usedIcons = [...new Set([...content.matchAll(/<Fi[A-Za-z0-9]+/g)].map(m => m[0].slice(1)))]; 
const importedIconsMatch = content.match(/import\s+{([^}]+)}\s+from\s+['"]react-icons\/fi['"]/); 
const importedIcons = importedIconsMatch ? importedIconsMatch[1].split(',').map(s => s.trim()) : []; 
const missing = usedIcons.filter(icon => !importedIcons.includes(icon)); 
console.log('Missing Icons:', missing);
