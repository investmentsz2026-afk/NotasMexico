const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const packages = ['shared', 'validation'];
const targetNodeModulesRoots = [
  path.join(repoRoot, 'node_modules', '@mexagenda'),
  path.join(repoRoot, 'apps', 'backend', 'node_modules', '@mexagenda'),
];

for (const nmRoot of targetNodeModulesRoots) {
  fs.mkdirSync(nmRoot, { recursive: true });

  for (const pkg of packages) {
    const srcDir = path.join(repoRoot, 'packages', pkg);
    const destDir = path.join(nmRoot, pkg);

    // Remove existing symlink/junction/directory safely
    try {
      const stat = fs.lstatSync(destDir);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(destDir);
      } else {
        fs.rmSync(destDir, { recursive: true, force: true });
      }
    } catch {
      // Destination does not exist yet
    }

    fs.mkdirSync(destDir, { recursive: true });

    const pkgJsonSrc = path.join(srcDir, 'package.json');
    const pkgJsonDest = path.join(destDir, 'package.json');
    if (fs.existsSync(pkgJsonSrc)) {
      fs.copyFileSync(pkgJsonSrc, pkgJsonDest);
    }

    const distSrc = path.join(srcDir, 'dist');
    const distDest = path.join(destDir, 'dist');
    if (fs.existsSync(distSrc)) {
      fs.cpSync(distSrc, distDest, { recursive: true });
    }
  }
}

console.log('[materialize-workspace-pkgs] @mexagenda/shared and @mexagenda/validation materialized as physical directories.');
