import fs from 'fs';
const html = fs.readFileSync('index.html', 'utf-8');
const escaped = html.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');
const output = `// Auto-generated: HTML content embedded at build time
export const indexHTML = \`${escaped}\`;`;
fs.writeFileSync('src/html-content.js', output);
console.log('HTML content embedded successfully');
