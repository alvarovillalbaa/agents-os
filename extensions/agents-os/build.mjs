import esbuild from 'esbuild';
import { createPluginBundlerPresets } from '@paperclipai/plugin-sdk/bundlers';
import fs from 'node:fs';
import path from 'node:path';
const presets = createPluginBundlerPresets({ uiEntry: 'src/ui/index.tsx', sourcemap: false });
await esbuild.build(presets.esbuild.manifest);
await esbuild.build(presets.esbuild.worker);
await esbuild.build(presets.esbuild.ui);
const licenses = [];
for (const name of ['@paperclipai/plugin-sdk', '@paperclipai/shared', 'zod']) {
  const roots = [path.join('node_modules', name), path.join('node_modules/@paperclipai/plugin-sdk/node_modules', name)];
  let file = roots.flatMap(root => ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map(name => path.join(root, name))).find(file => fs.existsSync(file));
  if (!file && name === '@paperclipai/shared') {
    const metadataPath = roots.map(root => path.join(root, 'package.json')).find(file => fs.existsSync(file));
    const metadata = metadataPath ? JSON.parse(fs.readFileSync(metadataPath, 'utf8')) : null;
    if (metadata?.name === name && metadata.version === '2026.1106.0' && metadata.license === 'MIT') file = 'licenses/Paperclip-MIT.txt';
  }
  if (!file) throw new Error('Required third-party license is missing: ' + name);
  licenses.push(name + '\n\n' + fs.readFileSync(file, 'utf8'));
}
fs.writeFileSync('dist/THIRD_PARTY_LICENSES.txt', licenses.join('\n\n---\n\n'));
