// Static check for the one hazard of splitting the game into ordered classic
// scripts: code that RUNS while a file loads (top-level statements, including
// calls made by functions it invokes) must not reach a function declared in a
// LATER file. Usage: node tools/check-load-order.js
const fs = require('fs'), path = require('path');
let acorn; try { acorn = require('acorn'); } catch { acorn = require('/opt/node-tools/node_modules/acorn'); }
const WWW = path.join(__dirname, '..', 'www');
const boot = fs.readFileSync(path.join(WWW, 'js', 'boot.js'), 'utf8');
const files = boot.match(/GAME_FILES\s*=\s*\[([\s\S]*?)\]/)[1].match(/'([^']+)'/g).map(q => q.slice(1, -1));
const declaredIn = new Map(); const fnBodies = new Map(); const asts = [];
files.forEach((f, idx) => {
  const ast = acorn.parse(fs.readFileSync(path.join(WWW, 'js', 'game', f + '.js'), 'utf8'), { ecmaVersion: 2022, sourceType: 'script', locations: true });
  asts.push(ast);
  for (const n of ast.body) if (n.type === 'FunctionDeclaration') { declaredIn.set(n.id.name, idx); fnBodies.set(n.id.name, n.body); }
});
function calls(node, out) {
  if (!node || typeof node.type !== 'string') return out;
  if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    if (!node._iife) return out;
  }
  if (node.type === 'CallExpression') {
    if (node.callee.type === 'Identifier') out.push({ name: node.callee.name, line: node.loc.start.line });
    if (node.callee.type === 'FunctionExpression' || node.callee.type === 'ArrowFunctionExpression') node.callee._iife = true;
  }
  for (const k in node) { if (k === 'loc') continue; const v = node[k];
    if (Array.isArray(v)) v.forEach(c => calls(c, out)); else if (v && typeof v.type === 'string') calls(v, out); }
  return out;
}
let bad = 0;
asts.forEach((ast, idx) => {
  const top = calls({ type: 'Program', body: ast.body.filter(n => n.type !== 'FunctionDeclaration') }, []);
  // follow transitively through functions invoked at load time
  const seen = new Set(); const stack = top.map(c => ({ ...c, via: [] }));
  while (stack.length) {
    const c = stack.pop(); const d = declaredIn.get(c.name);
    if (d === undefined) continue;
    if (d > idx) { bad++; console.log(`${files[idx]}.js:${c.line} load-time call reaches ${c.name}() from ${files[d]}.js` + (c.via.length ? ` via ${c.via.join(' → ')}` : '')); continue; }
    if (seen.has(c.name)) continue; seen.add(c.name);
    calls(fnBodies.get(c.name), []).forEach(cc => stack.push({ name: cc.name, line: c.line, via: [...c.via, c.name] }));
  }
});
console.log(bad ? `${bad} load-order hazard(s)` : 'load order OK');
process.exit(bad ? 1 : 0);
