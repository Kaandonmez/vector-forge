import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import type { ProjectData } from '../../../schema/src/index.ts';
import { packageRoot } from '../../../core/src/index.ts';
import { genericFiles } from '../../generic/src/index.ts';

async function loadWebRuntime(): Promise<string> {
  const prebuilt = path.join(packageRoot, 'dist/vectorforge-runtime.js');
  const sourceEntry = path.join(packageRoot, 'packages/exporters/web/src/runtime.ts');
  if (existsSync(prebuilt)) {
    return fs.readFile(prebuilt, 'utf8');
  }
  const entry = existsSync(sourceEntry)
    ? sourceEntry
    : path.join(import.meta.dirname, 'runtime.ts');
  const { build } = await import('vite');
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry,
        formats: ['es'],
        fileName: 'vectorforge-runtime',
      },
    },
  });
  const output = (Array.isArray(result) ? result[0] : result) as {
    output: { type: string; code?: string }[];
  };
  return output.output.find((o) => o.type === 'chunk')!.code!;
}

export async function webFiles(data: ProjectData, id?: string) {
  const files = genericFiles(data, id);
  files['vectorforge-runtime.js'] = await loadWebRuntime();
  files['index.html'] =
    `<!doctype html><html><head><meta charset="utf-8"><title>VectorForge export</title><style>body{background:#edf1e7;color:#203629;font:16px system-ui;max-width:960px;margin:40px auto}select{padding:12px}#stage{height:540px;margin:20px 0}</style></head><body><h1>VectorForge · ${data.project.name.replace(/[<>&"]/g, '')}</h1><select id="assets"></select><select id="clips"></select><button id="play">Play / pause</button><div id="stage"></div><script type="module">
import {mount} from './vectorforge-runtime.js';
const manifest=await fetch('./vectorforge.manifest.json').then(r=>r.json());
const items=[...manifest.assets.map(a=>({...a,type:'asset'})),...manifest.actors.map(a=>({...a,type:'actor'}))];
const select=document.querySelector('#assets'), clips=document.querySelector('#clips'); let player;
items.forEach(a=>select.add(new Option(a.name,a.id)));
async function show(){player?.destroy(); const a=items.find(a=>a.id===select.value); if(!a)return; const svg=await fetch(a.svg).then(r=>r.text()); const rig=a.rig?await fetch(a.rig).then(r=>r.json()):undefined;const animations=await Promise.all(manifest.animations.map(id=>fetch('./animations/'+id+'.json').then(r=>r.json())));const own=animations.filter(c=>c.actorId===a.id);const chosen=own.find(c=>c.id===clips.value)??own[0];clips.innerHTML='';own.forEach(c=>clips.add(new Option(c.name??c.id,c.id)));if(chosen)clips.value=chosen.id;player=mount(document.querySelector('#stage'),svg,rig,chosen,animations);player.playback.play();}
select.onchange=()=>{clips.innerHTML='';show()};clips.onchange=show;document.querySelector('#play').onclick=()=>player.playback.playing?player.playback.pause():player.playback.play();await show();
</script></body></html>`;
  files['README.md'] =
    'Serve this directory with any static HTTP server, then open index.html. Import mount from vectorforge-runtime.js to use the standalone SVG and motion runtime in your own web application. No VectorForge server or npm dependency is required.\n';
  return files;
}
