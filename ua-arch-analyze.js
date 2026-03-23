const fs = require('fs');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const nodes = input.nodes || [];
const edges = input.edges || [];

// A. Directory Grouping
const dirGroups = {};
for (const node of nodes) {
  if (!node.filePath) continue;
  const parts = node.filePath.split('/');
  let topDir;
  if (parts[0] === 'app' && parts[1] === 'api') {
    topDir = 'app/api';
  } else if (parts[0] === 'app') {
    topDir = 'app';
  } else {
    topDir = parts[0];
  }
  if (!dirGroups[topDir]) dirGroups[topDir] = [];
  dirGroups[topDir].push(node.id);
}

// B. Fan-out and fan-in per file
const fanOut = {};
const fanIn = {};
for (const node of nodes) {
  fanOut[node.id] = 0;
  fanIn[node.id] = 0;
}
for (const edge of edges) {
  if (fanOut[edge.source] !== undefined) fanOut[edge.source]++;
  if (fanIn[edge.target] !== undefined) fanIn[edge.target]++;
}

// Directory fan-out/in
const dirFanOut = {};
const dirFanIn = {};
for (const dir of Object.keys(dirGroups)) {
  dirFanOut[dir] = dirGroups[dir].reduce((s, id) => s + (fanOut[id] || 0), 0);
  dirFanIn[dir] = dirGroups[dir].reduce((s, id) => s + (fanIn[id] || 0), 0);
}

// C. Inter-group import frequency
const interGroup = {};
function getDir(id) {
  const node = nodes.find(n => n.id === id);
  if (!node || !node.filePath) return 'unknown';
  const parts = node.filePath.split('/');
  if (parts[0] === 'app' && parts[1] === 'api') return 'app/api';
  if (parts[0] === 'app') return 'app';
  return parts[0];
}
for (const edge of edges) {
  const srcDir = getDir(edge.source);
  const tgtDir = getDir(edge.target);
  if (srcDir === tgtDir) continue;
  const key = `${srcDir} -> ${tgtDir}`;
  interGroup[key] = (interGroup[key] || 0) + 1;
}

// D. Intra-group density
const intraGroup = {};
for (const dir of Object.keys(dirGroups)) {
  const members = new Set(dirGroups[dir]);
  let count = 0;
  for (const edge of edges) {
    if (members.has(edge.source) && members.has(edge.target)) count++;
  }
  const n = dirGroups[dir].length;
  intraGroup[dir] = { edges: count, density: n > 1 ? count / (n * (n - 1)) : 0 };
}

// E. Pattern matching
const patterns = {
  'app/api': 'api',
  'app': 'ui',
  'components': 'ui',
  'lib': 'service',
  'utils': 'utility',
  'config': 'config',
  'types': 'types'
};
const dirPatterns = {};
for (const dir of Object.keys(dirGroups)) {
  dirPatterns[dir] = patterns[dir] || 'unknown';
}

// F. Dependency direction
const depDirection = Object.entries(interGroup).sort((a, b) => b[1] - a[1]);

const results = {
  dirGroups,
  dirFanOut,
  dirFanIn,
  interGroupFrequency: interGroup,
  intraGroupDensity: intraGroup,
  dirPatterns,
  dependencyDirection: depDirection,
  fileMetrics: nodes.map(n => ({
    id: n.id,
    fanOut: fanOut[n.id] || 0,
    fanIn: fanIn[n.id] || 0,
    tags: n.tags || []
  }))
};

fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
process.exit(0);
