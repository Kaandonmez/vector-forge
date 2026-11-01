import type { ProjectData } from '../../../schema/src/index.ts';
import { genericFiles, type ExportFiles } from '../../generic/src/index.ts';
export function flutterFiles(data: ProjectData, id?: string): ExportFiles {
  const source = genericFiles(data, id),
    files: ExportFiles = {};
  const map = (name: string) => 'assets/vectorforge/' + name.replace(/^assets\//, 'static/');
  for (const [name, content] of Object.entries(source)) files[map(name)] = content;
  const manifest = JSON.parse(source['vectorforge.manifest.json']);
  manifest.format = 'flutter';
  for (const asset of manifest.assets) {
    asset.svg = asset.svg.replace(/^assets\//, 'static/');
    asset.metadata = asset.metadata.replace(/^assets\//, 'static/');
  }
  files['assets/vectorforge/vectorforge.manifest.json'] = JSON.stringify(manifest, null, 2) + '\n';
  const dirs = [
    ...new Set(Object.keys(files).map((file) => file.slice(0, file.lastIndexOf('/') + 1))),
  ].sort();
  files['pubspec-assets.yaml'] =
    'flutter:\n  assets:\n' + dirs.map((dir) => `    - ${dir}`).join('\n') + '\n';
  files['README.md'] =
    'Merge pubspec-assets.yaml into your Flutter pubspec.yaml. Load SVGs with an SVG renderer of your choice. Rig and animation JSON are portable data; v0.1 does not ship a Dart/Flame motion runtime. No Flutter installation is needed to generate this package.\n';
  return files;
}
