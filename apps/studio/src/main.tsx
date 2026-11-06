import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDownToLine,
  ArrowRight,
  Box,
  Braces,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  Copy,
  Expand,
  FileCode2,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Grid2X2,
  Layers,
  Leaf,
  Link2,
  Loader2,
  Maximize2,
  MoreHorizontal,
  MousePointer2,
  Palette,
  Pause,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Workflow,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  compileSequence,
  evaluateAnimation,
  evaluateSequence,
  Machine,
  Playback,
} from '../../../packages/motion/src/index.ts';
import { SvgRenderer } from '../../../packages/renderer-web/src/index.ts';
import type {
  ActorEntry,
  AssetEntry,
  ProjectData,
  Style,
} from '../../../packages/schema/src/index.ts';
import type { ResourceKind } from '../../../packages/core/src/index.ts';
import { ProjectTree } from './ProjectTree.tsx';
import {
  allFolder,
  buildProjectTree,
  collectionKey,
  entityFolder,
  folderBreadcrumbs,
  folderEntities,
  projectFolders,
  type TreeNode,
} from './project-tree.ts';
import './styles.css';

type Page =
  | 'Collection'
  | 'Project'
  | 'Assets'
  | 'Actors'
  | 'Animations'
  | 'Sequences'
  | 'Styles'
  | 'Validation';
type SourceTab =
  | 'SVG'
  | 'Metadata'
  | 'Rig'
  | 'Animation'
  | 'Sequence'
  | 'State machine'
  | 'Style'
  | 'Project'
  | 'Context';
type RecentProject = { root: string; name: string };
function recentProjects(): RecentProject[] {
  try {
    const value = JSON.parse(localStorage.getItem('vectorforge:projects') ?? '[]');
    return Array.isArray(value)
      ? value.filter((p) => typeof p?.root === 'string' && typeof p?.name === 'string').slice(0, 12)
      : [];
  } catch {
    return [];
  }
}
type ExportPlan = { destination: string; files: string[]; conflicts: string[]; written: string[] };
declare global {
  interface Window {
    __VF_READY?: boolean;
    __VF_RENDER_ERROR?: string;
  }
}
async function api<T>(route: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api/${route}`,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Local API request failed.');
  return value;
}
const formatTime = (time: number) =>
  `${Math.floor(time / 60)
    .toString()
    .padStart(2, '0')}:${(time % 60).toFixed(2).padStart(5, '0')}`;
const json = (value: unknown) => JSON.stringify(value, null, 2);

function Studio() {
  const params = new URLSearchParams(location.search);
  const snapshotMode = params.has('snapshot');
  const [data, setData] = useState<ProjectData>();
  const [fatal, setFatal] = useState('');
  const [page, setPage] = useState<Page>('Collection');
  const [selected, setSelected] = useState(params.get('snapshot') ?? params.get('selected') ?? '');
  const [clipId, setClipId] = useState(params.get('clip') ?? '');
  const [sequenceId, setSequenceId] = useState(params.get('sequence') ?? '');
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState('all');
  const [folder, setFolder] = useState(allFolder);
  const [motionFilter, setMotionFilter] = useState('all');
  const [activeTree, setActiveTree] = useState('project');
  const [motionOwner, setMotionOwner] = useState('');
  const [recents, setRecents] = useState<RecentProject[]>(recentProjects);
  const [treeOpen, setTreeOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderEditId, setFolderEditId] = useState('');
  const [folderName, setFolderName] = useState('');
  const [folderParent, setFolderParent] = useState('');
  const [selectedNode, setSelectedNode] = useState('');
  const [zoom, setZoom] = useState(1);
  const [background, setBackground] = useState('paper');
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceTab, setSourceTab] = useState<SourceTab>('SVG');
  const [sourceText, setSourceText] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('generic');
  const [destination, setDestination] = useState('');
  const [exportAll, setExportAll] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [plan, setPlan] = useState<ExportPlan>();
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectPath, setProjectPath] = useState('');
  const [projectMode, setProjectMode] = useState<'open' | 'create'>('open');
  const [projectName, setProjectName] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [styleId, setStyleId] = useState('');
  const [machineState, setMachineState] = useState('');
  const [optionGroups, setOptionGroups] = useState<
    Record<string, { options: string[]; active: string }>
  >({});
  const [slotColors, setSlotColors] = useState<Record<string, string>>({});
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const machine = useRef<Machine | undefined>(undefined);
  const autoPlay = useRef(!snapshotMode);
  const stage = useRef<HTMLDivElement>(null),
    renderer = useRef<SvgRenderer | undefined>(undefined),
    playback = useRef<Playback | undefined>(undefined),
    seek = useRef<HTMLInputElement>(null),
    timeLabel = useRef<HTMLSpanElement>(null),
    fps = useRef<HTMLSpanElement>(null),
    clock = useRef<HTMLSpanElement>(null);
  const reload = useCallback(async () => {
    try {
      const value = await api<ProjectData>('project');
      setData(value);
      setFatal('');
    } catch (e) {
      setFatal(String(e));
    }
  }, []);
  useEffect(() => {
    void reload();
    if (import.meta.hot) {
      const update = () => {
        void reload();
      };
      import.meta.hot.on('vectorforge:reload', update);
      return () => import.meta.hot?.off('vectorforge:reload', update);
    }
  }, [reload]);
  useEffect(() => {
    if (!data) return;
    const next = [
      { root: data.root, name: data.project.name },
      ...recentProjects().filter((p) => p.root !== data.root),
    ].slice(0, 12);
    setRecents(next);
    try {
      localStorage.setItem('vectorforge:projects', JSON.stringify(next));
    } catch {
      /* Local storage may be disabled. */
    }
  }, [data?.root, data?.project.name]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  const selectedClip = data?.animations.find((c) => c.id === selected),
    selectedSequence = data?.sequences.find((s) => s.id === selected);
  const entityId = selectedClip?.actorId ?? selectedSequence?.actorId ?? selected;
  const entity =
    data?.assets.find((a) => a.metadata.id === entityId) ??
    data?.actors.find((a) => a.metadata.id === entityId);
  const actor = data?.actors.find((a) => a.metadata.id === entityId);
  const clip =
    data?.animations.find((a) => a.id === (clipId || selectedClip?.id)) ??
    (actor && !sequenceId && !selectedSequence
      ? data?.animations.find((a) => a.actorId === actor.metadata.id)
      : undefined);
  const sequence = data?.sequences.find((s) => s.id === (sequenceId || selectedSequence?.id));
  const compiled = useMemo(() => {
    if (!sequence || !data) return undefined;
    try {
      return compileSequence(sequence, data.animations);
    } catch (e) {
      window.__VF_RENDER_ERROR = String(e);
      return undefined;
    }
  }, [sequence, data]);
  const duration = compiled?.duration ?? clip?.duration ?? 0;
  const style =
    data?.styles.find((s) => s.id === (page === 'Styles' ? styleId : entity?.metadata.style)) ??
    data?.styles[0];
  const selectedIssues =
    data?.issues.filter(
      (i) =>
        entity &&
        (i.path.startsWith(entity.path) ||
          i.path === `animations/${clip?.id}.json` ||
          i.path === `sequences/${sequence?.id}.json`),
    ) ?? [];
  const unsafe = selectedIssues.some((i) => i.severity === 'error' && i.path.endsWith('.svg'));
  const signature = json({ source: entity?.svg, rig: actor?.rig, clip, sequence, unsafe });
  const handleSelectOption = useCallback((group: string, option: string) => {
    if (!stage.current) return;
    const els = stage.current.querySelectorAll(`[data-option-group="${group}"]`);
    els.forEach((el) => {
      const opt = el.getAttribute('data-option');
      if (opt === option) {
        (el as HTMLElement).style.display = '';
      } else {
        (el as HTMLElement).style.display = 'none';
      }
    });
    setOptionGroups((prev) => ({
      ...prev,
      [group]: { ...prev[group], active: option },
    }));
  }, []);

  const handleSetSlotColor = useCallback((slot: string, color: string) => {
    if (!stage.current) return;
    const els = stage.current.querySelectorAll(`#${slot}, .${slot}`);
    els.forEach((el) => {
      const fill = el.getAttribute('fill');
      const stroke = el.getAttribute('stroke');
      if (fill && fill !== 'none') {
        el.setAttribute('fill', color);
      } else if (stroke && stroke !== 'none') {
        el.setAttribute('stroke', color);
      } else {
        el.setAttribute('fill', color);
      }
    });
    setSlotColors((prev) => ({ ...prev, [slot]: color }));
  }, []);

  const handleResetSlots = useCallback(() => {
    if (!stage.current || !entity) return;
    renderer.current = new SvgRenderer(stage.current, entity.svg, actor?.rig);
    setSlotColors({});
    const optionEls = stage.current.querySelectorAll('[data-option-group]');
    const optionMap: Record<string, { options: string[]; active: string }> = {};
    optionEls.forEach((el) => {
      const group = el.getAttribute('data-option-group');
      const opt = el.getAttribute('data-option');
      if (group && opt) {
        if (!optionMap[group]) {
          optionMap[group] = { options: [], active: opt };
        }
        if (!optionMap[group].options.includes(opt)) {
          optionMap[group].options.push(opt);
        }
        const isHidden = (el as HTMLElement).style.display === 'none';
        if (!isHidden) {
          optionMap[group].active = opt;
        }
      }
    });
    setOptionGroups(optionMap);
  }, [entity, actor?.rig]);

  useEffect(() => {
    if (!stage.current || !entity || unsafe) {
      stage.current?.querySelector('svg')?.remove();
      renderer.current = undefined;
      playback.current = undefined;
      setPlaying(false);
      setOptionGroups({});
      setAvailableSlots([]);
      setSlotColors({});
      return;
    }
    window.__VF_READY = false;
    let frame = 0;
    try {
      renderer.current = new SvgRenderer(stage.current, entity.svg, actor?.rig);
      const optionMap: Record<string, { options: string[]; active: string }> = {};
      const optionEls = stage.current.querySelectorAll('[data-option-group]');
      optionEls.forEach((el) => {
        const group = el.getAttribute('data-option-group');
        const opt = el.getAttribute('data-option');
        if (group && opt) {
          if (!optionMap[group]) {
            optionMap[group] = { options: [], active: opt };
          }
          if (!optionMap[group].options.includes(opt)) {
            optionMap[group].options.push(opt);
          }
          const isHidden = (el as HTMLElement).style.display === 'none';
          if (!isHidden) {
            optionMap[group].active = opt;
          }
        }
      });
      setOptionGroups(optionMap);

      const standardSlots = [
        'slot-body',
        'slot-accent',
        'slot-screen',
        'slot-camera',
        'slot-shadow',
        'slot-highlight',
      ];
      const foundSlots: string[] = [];
      for (const slot of standardSlots) {
        if (stage.current.querySelector(`#${slot}, .${slot}`)) {
          foundSlots.push(slot);
        }
      }
      setAvailableSlots(foundSlots);
      setSlotColors({});
      const player = new Playback(duration || 1, sequence?.loop ?? clip?.loop ?? true);
      player.speed = speed;
      playback.current = player;
      if (autoPlay.current && duration && !snapshotMode) player.play();
      autoPlay.current = false;
      setLoop(player.loop);
      setPlaying(player.playing);
      renderer.current.select(selectedNode || undefined);
      const render = () => {
        renderer.current?.apply(
          compiled
            ? evaluateSequence(compiled, player.time, false)
            : clip
              ? evaluateAnimation(clip, player.time, false)
              : {},
        );
      };
      if (snapshotMode) player.seek(Number(params.get('time') ?? 0));
      render();
      window.__VF_READY = true;
      let last = performance.now(),
        lastUI = 0,
        count = 0,
        fpsStart = last;
      const tick = (now: number) => {
        const wasPlaying = player.playing;
        player.advance(Math.min(0.1, (now - last) / 1000));
        last = now;
        render();
        count++;
        if (wasPlaying && !player.playing) {
          setPlaying(false);
          if (machine.current?.transition(undefined, {}, true)) {
            autoPlay.current = true;
            setMachineState(machine.current.state);
            setClipId(machine.current.clip ?? '');
          }
        }
        if (now - lastUI > 80) {
          if (seek.current) seek.current.value = String(player.time);
          if (timeLabel.current) timeLabel.current.textContent = formatTime(player.time);
          if (clock.current) clock.current.textContent = `${player.time.toFixed(2)}s`;
          lastUI = now;
        }
        if (now - fpsStart >= 600) {
          if (fps.current)
            fps.current.textContent = String(Math.round((count * 1000) / (now - fpsStart)));
          count = 0;
          fpsStart = now;
        }
        if (!snapshotMode) frame = requestAnimationFrame(tick);
      };
      if (!snapshotMode) frame = requestAnimationFrame(tick);
    } catch (e) {
      window.__VF_RENDER_ERROR = String(e);
      setNotice(String(e));
    }
    return () => cancelAnimationFrame(frame);
    // Source changes and selected motion rebuild the renderer; playback remains outside React.
  }, [
    signature,
    page === 'Styles' || page === 'Project' || page === 'Validation',
    page === 'Collection' && !selected,
  ]);
  useEffect(() => {
    if (playback.current) playback.current.loop = loop;
  }, [loop]);
  useEffect(() => {
    if (playback.current) playback.current.speed = speed;
  }, [speed]);
  useEffect(() => {
    renderer.current?.select(selectedNode || undefined);
  }, [selectedNode]);
  useEffect(() => {
    const definition = data?.stateMachines.find((s) => s.actorId === actor?.metadata.id);
    machine.current = definition ? new Machine(definition) : undefined;
    setMachineState(machine.current?.state ?? '');
  }, [actor?.metadata.id, data?.stateMachines]);

  const choose = (entry: AssetEntry | ActorEntry | string) => {
    const id = typeof entry === 'string' ? entry : entry.metadata.id;
    setSelected(id);
    setClipId('');
    setSequenceId('');
    setZoom(1);
    setSelectedNode('');
    setActiveTree(
      `${data?.animations.some((a) => a.id === id) ? 'animation' : data?.sequences.some((s) => s.id === id) ? 'sequence' : 'entity'}:${id}`,
    );
  };
  const selectAnimation = (id: string) => {
    autoPlay.current = true;
    if (clip?.id === id && !sequence && stage.current && playback.current) {
      playback.current.restart();
      setPlaying(true);
      autoPlay.current = false;
    }
    setSelected(id);
    setClipId('');
    setSequenceId('');
    setActiveTree(`animation:${id}`);
    if (data?.animations.find((a) => a.id === id)?.actorId !== actor?.metadata.id)
      setSelectedNode('');
  };
  const navigate = (next: Page) => {
    setPage(next);
    setSearch('');
    setFamily('all');
    setMotionFilter('all');
    setMotionOwner('');
    setActiveTree(next === 'Styles' ? 'styles' : '');
    if (next === 'Collection') {
      setFolder(allFolder);
      setSelected('');
      setActiveTree('project');
    }
    if (next === 'Assets')
      choose(
        data?.assets.find((a) => a.metadata.id === data.context.defaultPreview) ??
          data?.assets[0] ??
          '',
      );
    if (next === 'Actors')
      choose(
        data?.actors.find((a) => a.metadata.id === data.context.defaultActor) ??
          data?.actors[0] ??
          '',
      );
    if (next === 'Animations') choose(data?.animations[0]?.id ?? '');
    if (next === 'Sequences') choose(data?.sequences[0]?.id ?? '');
  };
  const perform = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      const result = await work();
      setNotice(typeof result === 'string' ? result : message);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const togglePlayback = () => {
    if (!duration || !playback.current) return;
    if (playback.current.playing) playback.current.pause();
    else playback.current.play();
    setPlaying(playback.current.playing);
  };
  const restart = () => {
    playback.current?.restart();
    setPlaying(true);
  };
  const stop = () => {
    playback.current?.stop();
    setPlaying(false);
  };
  const openExport = () => {
    setExportOpen(true);
    setExportAll(!selected || page === 'Project' || page === 'Styles' || page === 'Validation');
    setDestination(`${data?.root}/exports/${exportFormat}`);
    setPlan(undefined);
  };
  const sourceFor = (tab: SourceTab) =>
    tab === 'SVG'
      ? (entity?.svg ?? '')
      : json(
          tab === 'Metadata'
            ? entity?.metadata
            : tab === 'Rig'
              ? actor?.rig
              : tab === 'Animation'
                ? clip
                : tab === 'Sequence'
                  ? sequence
                  : tab === 'State machine'
                    ? data?.stateMachines.find((s) => s.actorId === actor?.metadata.id)
                    : tab === 'Project'
                      ? data?.project
                      : tab === 'Context'
                        ? data?.context
                        : style,
        );
  const switchSource = (tab: SourceTab) => {
    setSourceTab(tab);
    setSourceText(sourceFor(tab));
  };
  const openSource = () => {
    setSourceOpen(true);
    switchSource(
      page === 'Project'
        ? 'Project'
        : page === 'Styles'
          ? 'Style'
          : page === 'Sequences'
            ? 'Sequence'
            : page === 'Animations'
              ? 'Animation'
              : 'SVG',
    );
  };
  const saveSource = async () => {
    let kind: ResourceKind = actor ? 'actor' : 'asset';
    let payload: unknown = entity?.metadata;
    let id = entity?.metadata.id;
    let svg: string | undefined;
    if (sourceTab === 'SVG') svg = sourceText;
    else {
      payload = JSON.parse(sourceText);
      if (sourceTab === 'Rig') kind = 'rig';
      if (sourceTab === 'Animation') {
        kind = 'animation';
        id = clip?.id;
      }
      if (sourceTab === 'Sequence') {
        kind = 'sequence';
        id = sequence?.id;
      }
      if (sourceTab === 'State machine') {
        kind = 'stateMachine';
        id = data?.stateMachines.find((s) => s.actorId === actor?.metadata.id)?.id;
      }
      if (sourceTab === 'Style') {
        kind = 'style';
        id = style?.id;
      }
      if (sourceTab === 'Project' || sourceTab === 'Context') {
        kind = sourceTab === 'Project' ? 'project' : 'context';
        id = 'project';
      }
    }
    await api('save', { kind, id, data: payload, svg });
    await reload();
  };
  const machineEvent = (event?: string, conditions?: Record<string, boolean>) => {
    if (machine.current?.transition(event, conditions)) {
      autoPlay.current = true;
      if (clip?.id === machine.current.clip) {
        playback.current?.restart();
        setPlaying(true);
        autoPlay.current = false;
      }
      setMachineState(machine.current.state);
      setClipId(machine.current.clip ?? '');
      setSequenceId('');
    }
  };
  const allEntities =
    page === 'Collection'
      ? data
        ? folderEntities(data, folder)
        : []
      : page === 'Actors'
        ? (data?.actors ?? [])
        : (data?.assets ?? []);
  const filtered = allEntities.filter(
    (e) =>
      (family === 'all' || e.metadata.family === family) &&
      (motionFilter === 'all' || (motionFilter === 'animated') === 'rig' in e) &&
      `${e.metadata.name} ${e.metadata.id} ${e.metadata.category} ${e.metadata.tags.join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const errors = data?.issues.filter((i) => i.severity === 'error').length ?? 0,
    warnings = data?.issues.filter((i) => i.severity === 'warning').length ?? 0;
  const families = [
    ...new Set(allEntities.map((e) => e.metadata.family).filter((f): f is string => !!f)),
  ];
  const familyLabels = (data?.context.familyLabels ?? {}) as Record<string, string>;
  useEffect(() => {
    if (
      !data ||
      !selected ||
      [...data.assets, ...data.actors].some((e) => e.metadata.id === selected) ||
      data.animations.some((e) => e.id === selected) ||
      data.sequences.some((e) => e.id === selected)
    )
      return;
    setSelected(
      data.assets.find((e) => e.metadata.id === data.context.defaultPreview)?.metadata.id ??
        data.assets[0]?.metadata.id ??
        data.actors[0]?.metadata.id ??
        '',
    );
  }, [data, selected]);
  const counts = {
    Collection: (data?.assets.length ?? 0) + (data?.actors.length ?? 0),
    Project: '',
    Assets: data?.assets.length,
    Actors: data?.actors.length,
    Animations: data?.animations.length,
    Sequences: data?.sequences.length,
    Styles: data?.styles.length,
    Validation: errors || undefined,
  };
  const tree = useMemo(() => (data ? buildProjectTree(data) : undefined), [data]);
  const folders = data ? projectFolders(data) : [];
  const breadcrumbs = data ? folderBreadcrumbs(data, folder) : [];
  const folderLabel =
    family !== 'all'
      ? (familyLabels[family] ?? family.replaceAll('-', ' '))
      : (breadcrumbs.at(-1)?.name ?? 'All assets');
  const childFolders = folders.filter((f) =>
    folder === allFolder ? !f.parent : f.parent === folder,
  );
  const showPreview = page !== 'Collection' || !!selected;
  const openFolder = (key: string, familyId = 'all', treeKey = key) => {
    setPage('Collection');
    setFolder(key);
    setFamily(familyId);
    setMotionFilter('all');
    setSelected('');
    setClipId('');
    setSequenceId('');
    setSearch('');
    setActiveTree(treeKey === allFolder ? 'project' : treeKey);
    setTreeOpen(false);
  };
  const selectTree = (node: TreeNode) => {
    if (node.kind === 'project' || node.kind === 'folder') {
      openFolder(node.folder ?? allFolder, node.family ?? 'all', node.key);
      return;
    }
    if (node.kind === 'group') return;
    setSearch('');
    setMotionFilter('all');
    setTreeOpen(false);
    if (node.kind === 'style' || node.kind === 'styles') {
      setStyleId(node.target ?? '');
      setPage('Styles');
      setActiveTree(node.key);
      return;
    }
    if (node.folder) {
      setFolder(node.folder);
      setFamily('all');
    }
    if (node.kind === 'animation' || node.kind === 'sequence') {
      if (node.kind === 'animation') selectAnimation(node.target ?? '');
      else choose(node.target ?? '');
      setPage(node.kind === 'animation' ? 'Animations' : 'Sequences');
      setMotionOwner(node.owner ?? '');
    } else {
      choose(node.owner ?? node.target ?? '');
      setPage('Collection');
      if (node.kind === 'rig') setSelectedNode(node.target ?? '');
      if (node.kind === 'machine') {
        setSourceOpen(true);
        setSourceTab('State machine');
        setSourceText(json(data?.stateMachines.find((s) => s.id === node.target)));
      }
    }
    setActiveTree(node.key);
  };
  const switchProject = async (root: string, create = false) => {
    const next = await api<ProjectData>(create ? 'create' : 'open', {
      path: root,
      name: projectName,
    });
    setData(next);
    setSelected('');
    setClipId('');
    setSequenceId('');
    setStyleId('');
    setSelectedNode('');
    setPage('Collection');
    setFolder(allFolder);
    setFamily('all');
    setMotionFilter('all');
    setMotionOwner('');
    setActiveTree('project');
    setSearch('');
    setProjectOpen(false);
    setTreeOpen(false);
    setSourceOpen(false);
    setPlan(undefined);
  };
  const editFolder = (id = '') => {
    const current = data?.context.collections.find((c) => c.id === id);
    setFolderEditId(id);
    setFolderName(current?.name ?? '');
    setFolderParent(
      current ? (current.parentId ?? '') : folder.startsWith('collection:') ? folder.slice(11) : '',
    );
    setFolderOpen(true);
  };
  const saveFolder = async () => {
    if (!data || !folderName.trim()) throw new Error('Enter a folder name.');
    const id = folderEditId || `folder-${crypto.randomUUID()}`;
    const value = {
      id,
      name: folderName.trim(),
      ...(folderParent ? { parentId: folderParent } : {}),
    };
    await api('save', {
      kind: 'context',
      id: 'project',
      data: {
        ...data.context,
        collections: folderEditId
          ? data.context.collections.map((c) => (c.id === id ? value : c))
          : [...data.context.collections, value],
      },
    });
    await reload();
    setFolderOpen(false);
    openFolder(collectionKey(id));
  };

  if (fatal)
    return (
      <div className="empty-app">
        <ShieldCheck size={40} />
        <h1>Project needs attention</h1>
        <pre>{fatal}</pre>
        <p>Repair the project JSON on disk, then reload.</p>
        <button className="primary" onClick={() => void reload()}>
          Reload project
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="empty-app">
        <Loader2 className="spin" />
        <p>Opening your local workspace…</p>
      </div>
    );
  if (snapshotMode)
    return (
      <div
        id="snapshot-stage"
        ref={stage}
        style={{
          width: 800,
          height: 640,
          background: params.get('background') ?? '#edf0e6',
          padding: 40,
        }}
      >
        {unsafe && <p>Invalid SVG cannot be rendered.</p>}
      </div>
    );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${treeOpen ? 'mobile-open' : ''}`}>
        <button
          className="mobile-tree-close icon-button"
          aria-label="Close project tree"
          onClick={() => setTreeOpen(false)}
        >
          <X size={18} />
        </button>
        <div className="brand">
          <span className="brand-mark">
            <img src="/logo.png" alt="VectorForge" className="brand-mark-img" />
          </span>
          <span>
            VectorForge
            <small>
              STUDIO <span>v0.1</span>
            </small>
          </span>
        </div>
        <button
          aria-label="Manage projects"
          className="project-switch"
          onClick={() => {
            setProjectMode('open');
            setProjectPath(data.root);
            setProjectOpen(true);
          }}
        >
          <span className="project-icon">
            <FolderOpen size={17} />
          </span>
          <span>
            {data.project.name}
            <small>Local workspace</small>
          </span>
          <ChevronDown size={13} />
        </button>
        <div className="tree-section-label">
          <span>PROJECTS</span>
          <button
            aria-label="Add project"
            className="icon-button"
            onClick={() => {
              setProjectMode('open');
              setProjectPath('');
              setProjectOpen(true);
            }}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="sidebar-scroll">
          {tree && (
            <ProjectTree
              root={tree}
              storageKey={`vectorforge:tree:${data.root}`}
              activeKey={activeTree}
              onSelect={selectTree}
            />
          )}
          {recents
            .filter((p) => p.root !== data.root)
            .map((project) => (
              <button
                className="recent-project"
                key={project.root}
                title={project.root}
                disabled={busy}
                onClick={() =>
                  void perform(() => switchProject(project.root), 'Local project opened.')
                }
              >
                <FolderOpen size={14} />
                <span>{project.name}</span>
                <ChevronRight size={12} />
              </button>
            ))}
          <div className="tree-section-label">
            <span>PROJECT TOOLS</span>
          </div>
          <nav className="project-tools">
            <button
              aria-label="Project"
              className={page === 'Project' ? 'active' : ''}
              onClick={() => navigate('Project')}
            >
              <Settings2 size={15} />
              <span>Project settings</span>
            </button>
            <button
              aria-label="Validation"
              className={page === 'Validation' ? 'active' : ''}
              onClick={() => navigate('Validation')}
            >
              <ShieldCheck size={15} />
              <span>Validation</span>
              {errors ? (
                <small className="error-count">{errors}</small>
              ) : (
                <span className="tiny-dot" />
              )}
            </button>
            <button aria-label="Export" onClick={openExport}>
              <ArrowDownToLine size={15} />
              <span>Export</span>
              <ArrowRight size={12} />
            </button>
          </nav>
          <details className="quick-views">
            <summary>Browse by type</summary>
            <nav>
              {(
                ['Collection', 'Assets', 'Actors', 'Animations', 'Sequences', 'Styles'] as Page[]
              ).map((label) => (
                <button
                  key={label}
                  aria-label={label}
                  className={page === label ? 'active' : ''}
                  onClick={() => navigate(label)}
                >
                  <span>{label === 'Collection' ? 'All assets' : label}</span>
                  <small>{counts[label]}</small>
                </button>
              ))}
            </nav>
          </details>
        </div>
        <div className="agent-card">
          <div>
            <Braces size={18} />
            <span>Made for your agent</span>
          </div>
          <p>
            Open formats. Shared context.
            <br />
            Your next asset starts here.
          </p>
          <button onClick={() => setHelpOpen(true)}>
            Connect via MCP <ArrowUpRightIcon />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="tiny-dot" />
          Local & connected{' '}
          <button aria-label="Help and setup" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={17} />
          </button>
        </div>
      </aside>
      {treeOpen && (
        <button
          className="tree-backdrop"
          aria-label="Close project tree overlay"
          onClick={() => setTreeOpen(false)}
        />
      )}

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <FolderOpen size={14} />
            <button
              className="mobile-tree-button icon-button"
              aria-label="Toggle project tree"
              aria-expanded={treeOpen}
              onClick={() => setTreeOpen((v) => !v)}
            >
              <Layers size={17} />
            </button>
            <button onClick={() => openFolder(allFolder)}>{data.project.name}</button>
            <ChevronRight size={12} />
            {page === 'Collection' ? (
              <>
                <button onClick={() => openFolder(allFolder)}>All assets</button>
                {breadcrumbs.map((f) => (
                  <React.Fragment key={f.key}>
                    <ChevronRight size={12} />
                    <button onClick={() => openFolder(f.key)}>{f.name}</button>
                  </React.Fragment>
                ))}
                {entity && (
                  <>
                    <ChevronRight size={12} />
                    <strong>{entity.metadata.name}</strong>
                  </>
                )}
              </>
            ) : (
              <strong>{page}</strong>
            )}
          </div>
          <div className="topbar-right">
            <span className="live-pill">
              <span className="tiny-dot" />
              Live sync
            </span>
            <button
              className="icon-button"
              aria-label="Project information"
              onClick={() => navigate('Project')}
            >
              <Settings2 size={17} />
            </button>
            <span className="avatar">VF</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR LOCAL CREATIVE TOOLKIT</div>
              <h1>
                {page === 'Collection'
                  ? (entity?.metadata.name ?? folderLabel)
                  : page === 'Assets'
                    ? 'Asset library'
                    : page === 'Actors'
                      ? 'Actors & rigs'
                      : page === 'Animations'
                        ? 'Motion library'
                        : page === 'Sequences'
                          ? 'Sequence library'
                          : page === 'Styles'
                            ? 'Style profiles'
                            : page === 'Validation'
                              ? 'Project validation'
                              : 'Project overview'}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {page === 'Collection'
                  ? `${data.project.name} · ${allEntities.length} assets · static and animated, together.`
                  : page === 'Assets'
                    ? 'One visual language. Endless possibilities.'
                    : page === 'Actors'
                      ? 'Independent parts. A shared motion system.'
                      : page === 'Animations'
                        ? 'A little anticipation. A little personality.'
                        : page === 'Sequences'
                          ? 'Turn reusable motion into a story.'
                          : page === 'Styles'
                            ? 'Art direction that travels with every asset.'
                            : page === 'Validation'
                              ? 'Inspect the details before they leave your workspace.'
                              : 'Everything your next asset needs to know.'}
              </p>
            </div>
            <div className="heading-actions">
              {page === 'Collection' && (
                <button className="secondary" onClick={() => editFolder()}>
                  <FolderPlus size={15} />
                  New folder
                </button>
              )}
              <button
                className="secondary"
                disabled={page === 'Collection' && !entity}
                onClick={openSource}
              >
                <Code2 size={15} />
                View source
              </button>
              <button className="primary" onClick={openExport}>
                <ArrowDownToLine size={15} />
                Export{' '}
                {!selected || page === 'Project' || page === 'Styles' || page === 'Validation'
                  ? 'project'
                  : 'asset'}
              </button>
            </div>
          </div>

          {page === 'Project' ? (
            <div className="project-overview">
              <div className="overview-hero">
                <div className="eyebrow">PROJECT 001 · LOCAL FIRST</div>
                <h2>{data.project.name}</h2>
                <p>{data.project.description}</p>
                <div className="overview-stats">
                  {(['Assets', 'Actors', 'Animations', 'Styles'] as Page[]).map((p) => (
                    <button key={p} onClick={() => navigate(p)}>
                      <strong>{counts[p]}</strong>
                      <span>
                        {p}
                        <ArrowRight size={15} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="overview-columns">
                <section className="panel">
                  <h3>
                    <Braces size={17} />
                    Agent context
                  </h3>
                  <p className="muted">
                    Shared guidance keeps independently generated assets coherent.
                  </p>
                  <dl>
                    <dt>Default style</dt>
                    <dd>{data.project.defaultStyle ?? 'None'}</dd>
                    <dt>Naming</dt>
                    <dd>{data.context.namingConventions}</dd>
                    <dt>Project root</dt>
                    <dd className="mono break">{data.root}</dd>
                  </dl>
                  <h4>PROJECT RULES</h4>
                  {data.context.rules.map((r, i) => (
                    <p key={r} className="rule">
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      {r}
                    </p>
                  ))}
                </section>
                <section className="panel">
                  <h3>
                    <Layers size={17} />
                    Portable by design
                  </h3>
                  <p>SVG for visuals. JSON for metadata and motion. Normal files for everything.</p>
                  <pre className="directory-tree">{`${data.root.split(/[\\/]/).at(-1)}/\n├─ vectorforge.project.json\n├─ vectorforge.context.json\n├─ styles/\n├─ assets/\n├─ actors/\n├─ animations/\n├─ sequences/\n└─ exports/`}</pre>
                  <button
                    className="secondary"
                    onClick={() => {
                      setProjectPath(data.root);
                      setProjectOpen(true);
                    }}
                  >
                    <FolderOpen size={14} />
                    Open another project
                  </button>
                </section>
              </div>
            </div>
          ) : page === 'Validation' ? (
            <div className="validation-page">
              <div className={`validation-summary ${errors ? 'has-errors' : ''}`}>
                <ShieldCheck size={38} />
                <div>
                  <h2>{errors ? 'A few things need attention' : 'Ready for the next step'}</h2>
                  <p>
                    {errors} errors · {warnings} warnings ·{' '}
                    {data.assets.length + data.actors.length} SVGs inspected
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => void perform(reload, 'Project validation refreshed.')}
                >
                  <RotateCcw size={14} />
                  Run validation
                </button>
              </div>
              <div className="panel">
                <h3>
                  Validation report <span className="muted">{data.issues.length} findings</span>
                </h3>
                {data.issues.length ? (
                  data.issues.map((issue, i) => (
                    <div className={`issue ${issue.severity}`} key={i}>
                      <span>{issue.severity.toUpperCase()}</span>
                      <div>
                        <strong>{issue.code}</strong>
                        <p>{issue.message}</p>
                        <code>{issue.path}</code>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="validation-empty">
                    <CheckCircle2 size={30} />
                    <h3>Everything checks out</h3>
                    <p>
                      Schemas, SVG structure, rig mappings, references, styles and motion are valid.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : page === 'Styles' ? (
            <div className="style-page">
              <div className="style-tabs">
                {data.styles.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyleId(s.id)}
                    className={style?.id === s.id ? 'active' : ''}
                  >
                    <Palette size={15} />
                    {s.name}
                    <span>{s.id}</span>
                  </button>
                ))}
              </div>
              {style && <StyleView style={style} data={data} />}
            </div>
          ) : (
            <>
              <div className="library-toolbar">
                <div className="library-tabs">
                  <button
                    className={family === 'all' ? 'active' : ''}
                    onClick={() => setFamily('all')}
                  >
                    {page === 'Collection'
                      ? folderLabel
                      : page === 'Assets'
                        ? 'All assets'
                        : page === 'Actors'
                          ? 'All actors'
                          : 'All motion'}{' '}
                    <span>
                      {page === 'Collection' || page === 'Assets' || page === 'Actors'
                        ? allEntities.length
                        : page === 'Animations'
                          ? data.animations.length
                          : data.sequences.length}
                    </span>
                  </button>
                  {(page === 'Collection' || page === 'Assets' || page === 'Actors') &&
                    families.map((id) => (
                      <button
                        key={id}
                        className={family === id ? 'active' : ''}
                        onClick={() => setFamily(id)}
                      >
                        <GitBranch size={14} />
                        {familyLabels[id] ?? id.replaceAll('-', ' ')}{' '}
                        <span>{allEntities.filter((e) => e.metadata.family === id).length}</span>
                      </button>
                    ))}
                </div>
                <div className="library-tools">
                  <div className="search-field">
                    <Search size={15} />
                    <input
                      aria-label="Search library"
                      placeholder="Search your library…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <kbd>/</kbd>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Reset library filters"
                    onClick={() => {
                      setSearch('');
                      setFamily('all');
                      setMotionFilter('all');
                    }}
                  >
                    <SlidersHorizontal size={17} />
                  </button>
                </div>
              </div>
              {page === 'Collection' && (
                <div className="collection-controls">
                  <div className="motion-filters">
                    {[
                      ['all', 'All'],
                      ['static', 'Static'],
                      ['animated', 'Animated'],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={motionFilter === id ? 'active' : ''}
                        onClick={() => setMotionFilter(id)}
                      >
                        {label}
                        <small>
                          {
                            allEntities.filter(
                              (e) => id === 'all' || (id === 'animated') === 'rig' in e,
                            ).length
                          }
                        </small>
                      </button>
                    ))}
                  </div>
                  <div>
                    {entity && (
                      <button className="text-link" onClick={() => openFolder(folder)}>
                        <Grid2X2 size={13} />
                        Back to folder
                      </button>
                    )}
                    {folder.startsWith('collection:') && (
                      <button className="text-link" onClick={() => editFolder(folder.slice(11))}>
                        <Settings2 size={13} />
                        Edit folder
                      </button>
                    )}
                  </div>
                </div>
              )}
              {page === 'Collection' && !search && family === 'all' && childFolders.length > 0 && (
                <div className="folder-grid">
                  {childFolders.map((f) => (
                    <button
                      key={f.key}
                      data-testid={`folder-card-${f.key}`}
                      onClick={() => openFolder(f.key)}
                    >
                      <FolderOpen size={23} />
                      <span>
                        <strong>{f.name}</strong>
                        <small>{folderEntities(data, f.key).length} assets</small>
                      </span>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>
              )}
              {showPreview && (
                <div className="editor-layout">
                  <section className="preview-panel">
                    <div className="preview-header">
                      <div>
                        <span className="tiny-dot" />
                        <strong>{entity?.metadata.name ?? 'Choose an item'}</strong>
                        <span className="type-tag">{actor ? 'ACTOR' : 'SVG'}</span>
                      </div>
                      <div>
                        <button
                          className="icon-button"
                          aria-label="Capture snapshot"
                          disabled={busy || !entity}
                          onClick={() =>
                            void perform(async () => {
                              const result = await api<{ path: string }>('snapshot', {
                                id: entity?.metadata.id,
                                time: playback.current?.time ?? 0,
                                clip: sequence ? undefined : clip?.id,
                                sequence: sequence?.id,
                              });
                              return `Snapshot saved: ${result.path}`;
                            }, 'Snapshot generated in exports/snapshots.')
                          }
                        >
                          <Camera size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="View source"
                          onClick={openSource}
                        >
                          <FileCode2 size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Fullscreen preview"
                          onClick={() =>
                            void stage.current?.parentElement
                              ?.requestFullscreen()
                              .catch((e) => setNotice(String(e)))
                          }
                        >
                          <Expand size={16} />
                        </button>
                      </div>
                    </div>
                    <div className={`canvas ${background}`}>
                      <div className="canvas-caption">
                        <span>PREVIEW</span>
                        <span>
                          {entity?.metadata.width ?? 0} × {entity?.metadata.height ?? 0}
                        </span>
                      </div>
                      <div
                        className="canvas-stage"
                        ref={stage}
                        data-testid="preview-stage"
                        style={{ transform: `scale(${zoom})` }}
                      >
                        {unsafe ? (
                          <div className="canvas-error">
                            Invalid SVG. Open validation to repair it.
                          </div>
                        ) : (
                          !entity && <p>Select an item from the library.</p>
                        )}
                      </div>
                      <div className="canvas-tools">
                        <div className="background-options">
                          <button
                            aria-label="Paper background"
                            className={`paper-swatch ${background === 'paper' ? 'selected' : ''}`}
                            onClick={() => setBackground('paper')}
                          />
                          <button
                            aria-label="Dark background"
                            className={`dark-swatch ${background === 'dark' ? 'selected' : ''}`}
                            onClick={() => setBackground('dark')}
                          />
                          <button
                            aria-label="Transparent background"
                            className={`checker-swatch ${background === 'checker' ? 'selected' : ''}`}
                            onClick={() => setBackground('checker')}
                          />
                        </div>
                        <div className="zoom-tools">
                          <button
                            aria-label="Zoom out"
                            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                          >
                            <ZoomOut size={15} />
                          </button>
                          <span>{Math.round(zoom * 100)}%</span>
                          <button
                            aria-label="Zoom in"
                            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                          >
                            <ZoomIn size={15} />
                          </button>
                          <i />
                          <button aria-label="Fit preview" onClick={() => setZoom(1)}>
                            <Maximize2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="playback-bar">
                      <button
                        className={`play-button ${!duration ? 'disabled' : ''}`}
                        aria-label={playing ? 'Pause animation' : 'Play animation'}
                        onClick={togglePlayback}
                        disabled={!duration}
                      >
                        {playing ? (
                          <Pause size={15} fill="currentColor" />
                        ) : (
                          <Play size={15} fill="currentColor" />
                        )}
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Restart animation"
                        disabled={!duration}
                        onClick={restart}
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Stop animation"
                        disabled={!duration}
                        onClick={stop}
                      >
                        <Square size={12} />
                      </button>
                      <span className="time-code">
                        <span ref={timeLabel}>00:00.00</span>
                        <span> / {formatTime(duration)}</span>
                      </span>
                      <input
                        ref={seek}
                        aria-label="Animation time"
                        type="range"
                        min="0"
                        max={duration || 1}
                        step=".01"
                        defaultValue="0"
                        disabled={!duration}
                        onChange={(e) => playback.current?.seek(Number(e.target.value))}
                      />
                      <button
                        aria-label="Toggle loop"
                        className={`icon-button ${loop && duration ? 'on' : ''}`}
                        disabled={!duration}
                        onClick={() => setLoop((l) => !l)}
                      >
                        <Repeat2 size={16} />
                      </button>
                      <select
                        aria-label="Playback speed"
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                      >
                        {[0.25, 0.5, 1, 1.5, 2].map((n) => (
                          <option value={n} key={n}>
                            {n}×
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="preview-footer">
                      <span>
                        <span className="tiny-dot" />
                        {actor ? 'Motion runtime ready' : 'Native SVG · resolution independent'}
                      </span>
                      <span>
                        <span ref={fps}>—</span> FPS<span className="footer-separator">/</span>
                        <span ref={clock}>0.00s</span>
                      </span>
                    </div>
                  </section>
                  <aside className="inspector">
                    <div className="inspector-title">
                      <span>
                        <MousePointer2 size={15} />
                        Inspector
                      </span>
                      <MoreHorizontal size={17} />
                    </div>
                    <div className="inspector-scroll">
                      <div className="inspector-section">
                        <div className="section-label">
                          {actor ? 'ACTOR DETAILS' : 'ASSET DETAILS'}
                          <Box size={14} />
                        </div>
                        <h3>{entity?.metadata.name}</h3>
                        <code className="asset-id">{entity?.metadata.id}</code>
                        <dl>
                          <dt>Category</dt>
                          <dd>{entity?.metadata.category}</dd>
                          <dt>Dimensions</dt>
                          <dd>
                            {entity?.metadata.width} × {entity?.metadata.height}
                          </dd>
                          <dt>Format</dt>
                          <dd>
                            SVG <span className="muted">/ v1</span>
                          </dd>
                        </dl>
                      </div>
                      {entity && (
                        <div className="inspector-section">
                          <div className="section-label">
                            PROJECT FOLDER <FolderOpen size={14} />
                          </div>
                          <select
                            className="wide-select"
                            aria-label="Asset folder"
                            value={entity.metadata.collection ?? ''}
                            disabled={busy}
                            onChange={(e) => {
                              const collection = e.target.value;
                              void perform(async () => {
                                const metadata = { ...entity.metadata };
                                if (collection) metadata.collection = collection;
                                else delete metadata.collection;
                                await api('save', {
                                  kind: actor ? 'actor' : 'asset',
                                  id: metadata.id,
                                  data: metadata,
                                });
                                const next = await api<ProjectData>('project');
                                setData(next);
                                setFolder(entityFolder(next, { ...entity, metadata }));
                                setFamily('all');
                              }, 'Asset folder saved.');
                            }}
                          >
                            <option value="">Automatic · {entity.metadata.category}</option>
                            {data.context.collections.map((c) => (
                              <option key={c.id} value={c.id}>
                                {folderBreadcrumbs(data, collectionKey(c.id))
                                  .map((f) => f.name)
                                  .join(' / ')}
                              </option>
                            ))}
                          </select>
                          <p className="muted small">
                            Static and animated assets share the same folders.
                          </p>
                        </div>
                      )}
                      {actor && (
                        <div className="inspector-section">
                          <div className="section-label">
                            MOTION <Zap size={14} />
                          </div>
                          <select
                            className="wide-select"
                            aria-label="Select animation"
                            value={sequence ? '' : (clip?.id ?? '')}
                            onChange={(e) => selectAnimation(e.target.value)}
                          >
                            <option value="" disabled>
                              Select a clip
                            </option>
                            {data.animations
                              .filter((a) => a.actorId === actor.metadata.id)
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name ?? a.id}
                                </option>
                              ))}
                          </select>
                          {sequence && (
                            <div className="sequence-label">
                              <Workflow size={13} />
                              {sequence.id}
                            </div>
                          )}
                          <dl>
                            <dt>Duration</dt>
                            <dd>{duration.toFixed(2)} seconds</dd>
                            <dt>Tracks</dt>
                            <dd>
                              {clip
                                ? Object.keys(clip.tracks).length
                                : (compiled?.segments.length ?? 0)}
                            </dd>
                            <dt>State</dt>
                            <dd>{machineState || (playing ? 'playing' : 'paused')}</dd>
                          </dl>
                          {machine.current && (
                            <div className="state-events">
                              {[
                                ...new Set(
                                  Object.values(machine.current.definition.states).flatMap((s) =>
                                    s.transitions.map((t) => t.event).filter(Boolean),
                                  ),
                                ),
                              ].map((event) => (
                                <button key={event} onClick={() => machineEvent(event)}>
                                  {event}
                                </button>
                              ))}
                              <button onClick={() => machineEvent(undefined, { busy: true })}>
                                busy = true
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {actor && (
                        <div className="inspector-section">
                          <div className="section-label">
                            RIG NODES <GitBranch size={14} />
                          </div>
                          <div className="node-list">
                            {Object.entries(actor.rig.nodes).map(([id, node]) => (
                              <button
                                key={id}
                                className={selectedNode === id ? 'selected' : ''}
                                onClick={() => setSelectedNode((n) => (n === id ? '' : id))}
                              >
                                <span style={{ paddingLeft: node.parent ? 12 : 0 }}>
                                  <span className="node-dot" />
                                  {id}
                                </span>
                                <code>#{node.svgId}</code>
                              </button>
                            ))}
                          </div>
                          {selectedNode && (
                            <div className="pivot-info">
                              Pivot: [{actor.rig.nodes[selectedNode]?.pivot.join(', ')}] ·{' '}
                              {actor.rig.nodes[selectedNode]?.pivotSpace}
                            </div>
                          )}
                        </div>
                      )}
                      {!actor && (
                        <div className="inspector-section">
                          <div className="section-label">
                            FAMILY & VARIANT <GitBranch size={14} />
                          </div>
                          <button
                            className="family-link"
                            onClick={() => {
                              setFamily(entity?.metadata.family ?? 'all');
                              setSearch('');
                            }}
                          >
                            <GitBranch size={14} />
                            {entity?.metadata.family ?? 'Independent asset'}
                            <Link2 size={12} />
                          </button>
                          <dl>
                            <dt>Variant</dt>
                            <dd>{entity?.metadata.variant ?? 'Base asset'}</dd>
                            <dt>Base</dt>
                            <dd>
                              {entity?.metadata.baseAsset ? (
                                <button
                                  className="text-link"
                                  onClick={() => choose(entity.metadata.baseAsset!)}
                                >
                                  {entity.metadata.baseAsset}
                                  <ChevronRight size={12} />
                                </button>
                              ) : (
                                '—'
                              )}
                            </dd>
                          </dl>
                        </div>
                      )}
                      {Object.keys(optionGroups).length > 0 && (
                        <div className="inspector-section" data-testid="modular-options-section">
                          <div className="section-label">
                            MODULAR OPTIONS <SlidersHorizontal size={14} />
                          </div>
                          {Object.entries(optionGroups).map(([group, { options, active }]) => (
                            <div key={group} className="option-group-block">
                              <span className="option-group-label">{group}</span>
                              <div className="option-chips-row">
                                {options.map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    data-testid={`option-chip-${group}-${opt}`}
                                    className={`option-chip ${active === opt ? 'active' : ''}`}
                                    onClick={() => handleSelectOption(group, opt)}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {availableSlots.length > 0 && (
                        <div className="inspector-section" data-testid="color-slots-section">
                          <div className="section-label">
                            DYNAMIC COLOR SLOTS <Palette size={14} />
                          </div>
                          {availableSlots.map((slot) => (
                            <div key={slot} className="slot-palette-row">
                              <span className="slot-title">
                                <code>#{slot}</code>
                              </span>
                              <div className="slot-swatch-list">
                                {style?.palette.map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    title={c}
                                    data-testid={`slot-swatch-${slot}-${c.replace('#', '')}`}
                                    className={`slot-color-dot ${slotColors[slot] === c ? 'active' : ''}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => handleSetSlotColor(slot, c)}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                          {Object.keys(slotColors).length > 0 && (
                            <button
                              type="button"
                              className="text-link reset-link"
                              onClick={handleResetSlots}
                            >
                              <RotateCcw size={12} /> Reset to original colors
                            </button>
                          )}
                        </div>
                      )}
                      <div className="inspector-section">
                        <div className="section-label">
                          STYLE PROFILE <Palette size={14} />
                        </div>
                        <button
                          className="style-link"
                          onClick={() => {
                            setStyleId(style?.id ?? '');
                            navigate('Styles');
                          }}
                        >
                          <span className="style-thumb">
                            <Leaf size={16} />
                          </span>
                          <span>
                            {style?.name}
                            <small>{style?.id}</small>
                          </span>
                          <ChevronRight size={14} />
                        </button>
                        <div className="palette-row">
                          {style?.palette.slice(0, 8).map((c) => (
                            <span title={c} style={{ background: c }} key={c} />
                          ))}
                        </div>
                      </div>
                      <div className="inspector-section">
                        <div className="section-label">TAGS</div>
                        <div className="tags">
                          {entity?.metadata.tags.map((t) => (
                            <button key={t} onClick={() => setSearch(t)}>
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="inspector-section inspector-validation">
                        <div className="section-label">
                          VALIDATION <ShieldCheck size={14} />
                        </div>
                        <div
                          className={
                            selectedIssues.some((i) => i.severity === 'error') ? 'invalid' : 'valid'
                          }
                        >
                          <CheckCircle2 size={15} />
                          {selectedIssues.length
                            ? `${selectedIssues.length} findings`
                            : 'All checks passed'}
                        </div>
                        <p>Structure, references & style rules</p>
                        <button className="text-link" onClick={() => navigate('Validation')}>
                          View report <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  </aside>
                </div>
              )}
              {page === 'Collection' || page === 'Assets' || page === 'Actors' ? (
                <section className="asset-strip">
                  <div className="strip-title">
                    <h2>
                      {family !== 'all'
                        ? (familyLabels[family] ?? family.replaceAll('-', ' '))
                        : page === 'Collection'
                          ? folderLabel
                          : page === 'Actors'
                            ? 'Meet the actors'
                            : 'In this collection'}{' '}
                      <span>{filtered.length}</span>
                    </h2>
                    <span>
                      {page === 'Collection'
                        ? 'Choose an asset to inspect its variants, parts and motion'
                        : 'SVG assets, made to belong together'}
                    </span>
                  </div>
                  <div className="asset-grid">
                    {filtered.map((e) => (
                      <button
                        key={e.metadata.id}
                        data-testid={`asset-card-${e.metadata.id}`}
                        className={`asset-card ${entity?.metadata.id === e.metadata.id ? 'selected' : ''}`}
                        onClick={() => {
                          choose(e);
                          setActiveTree(`entity:${e.metadata.id}`);
                        }}
                      >
                        <div
                          className="thumbnail"
                          dangerouslySetInnerHTML={{
                            __html: data.issues.some(
                              (i) =>
                                i.path.startsWith(e.path) &&
                                i.severity === 'error' &&
                                i.path.endsWith('.svg'),
                            )
                              ? ''
                              : e.svg,
                          }}
                        />
                        <span className={`motion-badge ${'rig' in e ? 'animated' : 'static'}`}>
                          {'rig' in e ? <Zap size={10} /> : <FileCode2 size={10} />}
                          {'rig' in e ? 'Animated' : 'Static'}
                        </span>
                        <div className="asset-card-info">
                          <strong>{e.metadata.name}</strong>
                          <span>
                            {e.metadata.family ?? e.metadata.category}
                            <span>
                              {entity?.metadata.id === e.metadata.id ? (
                                <Check size={12} />
                              ) : (
                                <ArrowRight size={12} />
                              )}
                            </span>
                          </span>
                        </div>
                      </button>
                    ))}
                    {!filtered.length && (
                      <div className="no-results">
                        <Search size={22} />
                        <p>
                          {search || family !== 'all' || motionFilter !== 'all'
                            ? `No assets match “${search || motionFilter}”.`
                            : 'This folder is ready for your first asset.'}
                        </p>
                        {(search || family !== 'all' || motionFilter !== 'all') && (
                          <button
                            className="text-link"
                            onClick={() => {
                              setSearch('');
                              setFamily('all');
                              setMotionFilter('all');
                            }}
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              ) : (
                <section className="motion-list">
                  <div className="strip-title">
                    <h2>
                      {page === 'Animations' ? 'Animation clips' : 'Sequences'}{' '}
                      <span>
                        {page === 'Animations' ? data.animations.length : data.sequences.length}
                      </span>
                    </h2>
                    <span>Deterministic motion · seconds</span>
                  </div>
                  <div className="motion-grid">
                    {(page === 'Animations' ? data.animations : data.sequences)
                      .filter(
                        (m) =>
                          (!motionOwner || m.actorId === motionOwner) &&
                          `${m.id} ${m.name}`.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            if ('tracks' in m) selectAnimation(m.id);
                            else choose(m.id);
                            setActiveTree(`${'tracks' in m ? 'animation' : 'sequence'}:${m.id}`);
                          }}
                          className={selected === m.id ? 'selected' : ''}
                        >
                          <span className="motion-icon">
                            {'tracks' in m ? <Zap size={17} /> : <Workflow size={17} />}
                          </span>
                          <span>
                            <strong>{m.name ?? m.id}</strong>
                            <small>{m.actorId}</small>
                          </span>
                          <span className="mono">
                            {'duration' in m ? `${m.duration}s` : `${m.steps.length} steps`}
                          </span>
                          <Play size={13} />
                        </button>
                      ))}
                  </div>
                  {clip && (
                    <div className="track-inspector">
                      <h4>KEYFRAME TRACKS</h4>
                      {Object.entries(clip.tracks).map(([track, frames]) => (
                        <div key={track}>
                          <code>{track}</code>
                          <span>
                            {frames.map((f) => (
                              <i
                                key={f.time}
                                title={`${f.time}s → ${f.value} (${f.easing ?? 'linear'})`}
                                style={{ left: `${(f.time / clip.duration) * 95}%` }}
                              />
                            ))}
                          </span>
                          <small>{frames.length} keys</small>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              <span className="tiny-dot" />
              Saved locally<span>·</span>No cloud required
            </span>
            <span>
              SVG + JSON<span>·</span>Open by design <Sparkles size={12} />
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <ShieldCheck size={18} />
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy-indicator">
          <Loader2 className="spin" size={15} />
          Working locally…
        </div>
      )}

      {sourceOpen && (
        <Modal
          title="The source of truth"
          subtitle="Inspectable, portable, and validated before every save."
          onClose={() => setSourceOpen(false)}
          wide
        >
          <div className="source-tabs">
            {(
              (page === 'Project'
                ? ['Project', 'Context']
                : [
                    'SVG',
                    'Metadata',
                    ...(actor ? ['Rig'] : []),
                    ...(clip ? ['Animation'] : []),
                    ...(sequence ? ['Sequence'] : []),
                    ...(machine.current ? ['State machine'] : []),
                    'Style',
                  ]) as SourceTab[]
            ).map((tab) => (
              <button
                key={tab}
                className={sourceTab === tab ? 'active' : ''}
                onClick={() => switchSource(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <textarea
            aria-label="Source editor"
            className="source-editor"
            spellCheck={false}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
          />
          <div className="modal-actions">
            <span className="muted">
              <ShieldCheck size={13} />
              Schema + structural checks before writing
            </span>
            <button
              className="secondary"
              onClick={() =>
                void perform(() => navigator.clipboard.writeText(sourceText), 'Source copied.')
              }
            >
              <Copy size={14} />
              Copy
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void perform(saveSource, 'Validated source saved to disk.')}
            >
              <Check size={14} />
              Validate & save
            </button>
          </div>
        </Modal>
      )}
      {exportOpen && (
        <Modal
          title="Ready to leave the studio"
          subtitle="Portable files for your next project."
          onClose={() => setExportOpen(false)}
        >
          <label className="form-label">
            FORMAT
            <select
              value={exportFormat}
              onChange={(e) => {
                setExportFormat(e.target.value);
                setDestination(`${data.root}/exports/${e.target.value}`);
                setPlan(undefined);
              }}
            >
              <option value="generic">Generic · SVG + JSON</option>
              <option value="web">Web · standalone runtime + demo</option>
              <option value="flutter">Flutter · assets + pubspec snippet</option>
            </select>
          </label>
          <label className="form-label">
            DESTINATION
            <input
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setPlan(undefined);
              }}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={exportAll}
              onChange={(e) => {
                setExportAll(e.target.checked);
                setPlan(undefined);
              }}
            />
            Export the complete project
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            Explicitly overwrite conflicting export files
          </label>
          <p className="muted small">
            Actor exports include their rigs, clips, sequences and styles. Source directories are
            protected.
          </p>
          {plan && (
            <div className="export-plan">
              <strong>
                {plan.files.length} files · {plan.conflicts.length} conflicts
              </strong>
              <pre>{plan.files.join('\n')}</pre>
            </div>
          )}
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                void perform(
                  async () =>
                    setPlan(
                      await api<ExportPlan>('export', {
                        destination,
                        format: exportFormat,
                        id: exportAll ? undefined : selected,
                        dryRun: true,
                      }),
                    ),
                  'Export plan is ready to inspect.',
                )
              }
            >
              <Search size={14} />
              Dry run
            </button>
            <button
              className="primary"
              disabled={busy || !plan || (!!plan.conflicts.length && !overwrite)}
              onClick={() =>
                void perform(async () => {
                  const result = await api<ExportPlan>('export', {
                    destination,
                    format: exportFormat,
                    id: exportAll ? undefined : selected,
                    dryRun: false,
                    overwrite,
                  });
                  setPlan(result);
                }, 'Export written successfully.')
              }
            >
              <ArrowDownToLine size={14} />
              Write export
            </button>
          </div>
        </Modal>
      )}
      {projectOpen && (
        <Modal
          title="Your local projects"
          subtitle="Keep each game, website or app in its own workspace."
          onClose={() => setProjectOpen(false)}
        >
          <div className="source-tabs">
            <button
              className={projectMode === 'open' ? 'active' : ''}
              onClick={() => setProjectMode('open')}
            >
              Open existing
            </button>
            <button
              className={projectMode === 'create' ? 'active' : ''}
              onClick={() => {
                setProjectMode('create');
                setProjectPath('');
              }}
            >
              Create new
            </button>
          </div>
          {projectMode === 'create' && (
            <label className="form-label">
              PROJECT NAME
              <input
                aria-label="New project name"
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  if (!projectPath || projectPath.startsWith(`${data.studioRoot}/projects/`))
                    setProjectPath(
                      `${data.studioRoot}/projects/${
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, '') || 'untitled'
                      }`,
                    );
                }}
              />
            </label>
          )}
          <label className="form-label">
            ABSOLUTE DIRECTORY PATH
            <input
              aria-label="Project directory"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
            />
          </label>
          <p className="muted small">
            {projectMode === 'open'
              ? 'Choose a directory containing vectorforge.project.json.'
              : 'Choose an empty or new directory. The project starts with an empty asset library.'}
          </p>
          {projectMode === 'open' && (
            <div className="recent-project-list">
              {recents.map((project) => (
                <button
                  key={project.root}
                  disabled={busy}
                  onClick={() =>
                    void perform(() => switchProject(project.root), 'Local project opened.')
                  }
                >
                  <FolderOpen size={16} />
                  <span>
                    <strong>{project.name}</strong>
                    <small>{project.root}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="primary"
              disabled={
                busy || !projectPath.trim() || (projectMode === 'create' && !projectName.trim())
              }
              onClick={() =>
                void perform(async () => {
                  await switchProject(projectPath, projectMode === 'create');
                }, 'Local project opened.')
              }
            >
              <FolderOpen size={14} />
              {projectMode === 'create' ? 'Create project' : 'Open project'}
            </button>
          </div>
        </Modal>
      )}
      {folderOpen && (
        <Modal
          title={folderEditId ? 'Edit project folder' : 'New project folder'}
          subtitle="Organize static and animated assets around your project."
          onClose={() => setFolderOpen(false)}
        >
          <label className="form-label">
            FOLDER NAME
            <input
              aria-label="Folder name"
              value={folderName}
              autoFocus
              onChange={(e) => setFolderName(e.target.value)}
            />
          </label>
          <label className="form-label">
            PARENT FOLDER
            <select
              aria-label="Parent folder"
              value={folderParent}
              onChange={(e) => setFolderParent(e.target.value)}
            >
              <option value="">Project root</option>
              {data.context.collections
                .filter(
                  (c) =>
                    !folderEditId ||
                    !folderBreadcrumbs(data, collectionKey(c.id)).some(
                      (f) => f.authoredId === folderEditId,
                    ),
                )
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {folderBreadcrumbs(data, collectionKey(c.id))
                      .map((f) => f.name)
                      .join(' / ')}
                  </option>
                ))}
            </select>
          </label>
          <div className="modal-actions">
            <button
              className="primary"
              disabled={busy || !folderName.trim()}
              onClick={() => void perform(saveFolder, 'Project folder saved.')}
            >
              <Check size={14} />
              Save folder
            </button>
          </div>
        </Modal>
      )}
      {helpOpen && (
        <Modal
          title="Your agent. Your pipeline."
          subtitle="Connect any MCP-compatible coding agent to the local project."
          onClose={() => setHelpOpen(false)}
        >
          <p>
            VectorForge provides project context, style rules, file creation, validation, snapshots
            and export. Your existing coding agent creates the SVG and JSON.
          </p>
          <h4>MCP SERVER</h4>
          <pre className="help-code">
            {json({
              mcpServers: {
                vectorforge: {
                  command: 'pnpm',
                  args: [
                    '--dir',
                    data.studioRoot ?? data.root,
                    'vectorforge',
                    'mcp',
                    '--project',
                    data.root,
                  ],
                },
              },
            })}
          </pre>
          <h4>USEFUL COMMANDS</h4>
          <pre className="help-code">{`pnpm vectorforge validate\npnpm vectorforge list assets\npnpm vectorforge snapshot ${entity?.metadata.id ?? 'asset-id'}\npnpm vectorforge export ${entity?.metadata.id ?? 'asset-id'} --dest ./output --dry-run`}</pre>
          <p className="muted small">
            See README.md and docs/MCP.md for the complete tool surface and setup.
          </p>
        </Modal>
      )}
    </div>
  );
}

function StyleView({ style, data }: { style: Style; data: ProjectData }) {
  return (
    <div className="style-content">
      <section className="panel">
        <div className="style-hero-icon">
          <Palette size={27} />
        </div>
        <div className="eyebrow">STYLE PROFILE / VERSION 1</div>
        <h2>{style.name}</h2>
        <p>{style.description}</p>
        <h4>THE PALETTE</h4>
        <div className="large-palette">
          {style.palette.map((c) => (
            <div key={c}>
              <span style={{ background: c }} />
              <code>{c}</code>
            </div>
          ))}
        </div>
        <h4>ART DIRECTION</h4>
        <p className="art-guidance">{style.guidance}</p>
        <div className="style-properties">
          <div>
            <span>Shape language</span>
            <strong>{String(style.geometry?.shapeLanguage ?? 'Unspecified')}</strong>
          </div>
          <div>
            <span>Perspective</span>
            <strong>{String(style.perspective?.default ?? 'Unspecified')}</strong>
          </div>
          <div>
            <span>Stroke</span>
            <strong>
              {style.stroke?.enabled
                ? `Enabled · max ${style.stroke.maxWidth ?? '—'}px`
                : 'Filled shapes'}
            </strong>
          </div>
          <div>
            <span>Motion</span>
            <strong>{style.motion?.personality ?? 'Unspecified'}</strong>
          </div>
        </div>
      </section>
      <section className="panel style-references">
        <h3>
          Style in practice <span className="muted">Reference assets</span>
        </h3>
        {data.assets
          .filter((a) => a.metadata.style === style.id)
          .slice(0, 3)
          .map((a) => (
            <div key={a.metadata.id}>
              <div
                dangerouslySetInnerHTML={{
                  __html: data.issues.some(
                    (i) =>
                      i.path.startsWith(a.path) &&
                      i.severity === 'error' &&
                      i.path.endsWith('.svg'),
                  )
                    ? ''
                    : a.svg,
                }}
              />
              <strong>{a.metadata.name}</strong>
              <code>{a.metadata.id}</code>
            </div>
          ))}
      </section>
    </div>
  );
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="eyebrow">VECTORFORGE / LOCAL WORKFLOW</div>
        <h2>{title}</h2>
        <p className="modal-subtitle">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}
function ArrowUpRightIcon() {
  return <span aria-hidden="true">↗</span>;
}
createRoot(document.getElementById('root')!).render(<Studio />);
