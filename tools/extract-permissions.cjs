const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('app.js', 'utf8');
const catalogSource = source.split('let state=')[0];
const sandbox = { window: { SKApp: null } };
vm.createContext(sandbox);
vm.runInContext(`${catalogSource}\nglobalThis.__catalog = { profiles: PROFILES, permissions, groups: EMPLOYEE_GROUPS };`, sandbox);
process.stdout.write(JSON.stringify(sandbox.__catalog));
