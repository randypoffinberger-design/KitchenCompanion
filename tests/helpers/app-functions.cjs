const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8').replace(/\r\n/g, '\n');

// App functions are declared at the IIFE's top level. Use declaration boundaries,
// rather than whitespace or the name of whichever helper happens to follow.
function functionSource(name) {
  const pattern = /^  (?:async )?function ([\w]+)\(/gm;
  const declarations = [...source.matchAll(pattern)];
  const index = declarations.findIndex(match => match[1] === name);
  if (index < 0) throw new Error(`App function not found: ${name}`);
  const start = declarations[index].index;
  const end = declarations[index + 1]?.index ?? source.indexOf('\n  // Existing shopping data');
  return source.slice(start, end);
}

function loadFunctions(names, globals = {}) {
  const context = vm.createContext(globals);
  vm.runInContext(names.map(functionSource).join('\n'), context);
  return context;
}
module.exports = { source, functionSource, loadFunctions };
