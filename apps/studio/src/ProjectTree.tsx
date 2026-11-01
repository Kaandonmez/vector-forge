import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Folder,
  FolderOpen,
  GitBranch,
  Layers,
  Palette,
  Search,
  Workflow,
  Zap,
} from 'lucide-react';
import { filterTree, type TreeNode } from './project-tree.ts';

const icons = {
  project: FolderOpen,
  folder: Folder,
  asset: FileCode2,
  actor: Box,
  group: Layers,
  rig: GitBranch,
  animation: Zap,
  sequence: Workflow,
  machine: Workflow,
  style: Palette,
  styles: Palette,
};
export function ProjectTree({
  root,
  storageKey,
  activeKey,
  onSelect,
}: {
  root: TreeNode;
  storageKey: string;
  activeKey: string;
  onSelect: (node: TreeNode) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['project']));
  const [search, setSearch] = useState('');
  const [focusKey, setFocusKey] = useState('project');
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      setExpanded(
        new Set(Array.isArray(value) ? value.filter((v) => typeof v === 'string') : ['project']),
      );
    } catch {
      setExpanded(new Set(['project']));
    }
    setSearch('');
    setFocusKey('project');
  }, [storageKey]);
  useEffect(() => {
    const ancestors = (node: TreeNode, parents: string[]): string[] | undefined => {
      if (node.key === activeKey) return parents;
      for (const child of node.children ?? []) {
        const found = ancestors(child, [...parents, node.key]);
        if (found) return found;
      }
    };
    const path = ancestors(root, []);
    if (path?.length) setExpanded((old) => new Set([...old, ...path]));
  }, [activeKey, root]);
  const rows = useMemo(() => {
    const result: { node: TreeNode; depth: number }[] = [];
    const visit = (nodes: TreeNode[], depth: number) => {
      for (const node of nodes) {
        result.push({ node, depth });
        if (search.trim() || expanded.has(node.key)) visit(node.children ?? [], depth + 1);
      }
    };
    visit(filterTree([root], search), 1);
    return result;
  }, [root, search, expanded]);
  const toggle = (key: string, open = !expanded.has(key)) => {
    const next = new Set(expanded);
    if (open) next.add(key);
    else next.delete(key);
    setExpanded(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* Storage may be disabled. */
    }
  };
  const focus = (key: string) => {
    setFocusKey(key);
    Array.from(container.current?.querySelectorAll<HTMLButtonElement>('[role="treeitem"]') ?? [])
      .find((button) => button.dataset.treeKey === key)
      ?.focus();
  };
  return (
    <div className="project-tree-container">
      <div className="tree-search">
        <Search size={13} />
        <input
          aria-label="Search project tree"
          placeholder="Find assets, parts, motion…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="project-tree" role="tree" aria-label="Project assets" ref={container}>
        {rows.map(({ node, depth }, index) => {
          const Icon = icons[node.kind],
            branch = !!node.children?.length;
          const open = !!search.trim() || expanded.has(node.key);
          return (
            <div className="tree-row" key={node.key} style={{ paddingLeft: (depth - 1) * 13 }}>
              {branch ? (
                <button
                  className="tree-toggle"
                  aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label}`}
                  tabIndex={-1}
                  onClick={() => toggle(node.key)}
                >
                  {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              ) : (
                <span className="tree-toggle-spacer" />
              )}
              <button
                role="treeitem"
                data-tree-key={node.key}
                data-testid={`tree-${node.key}`}
                aria-level={depth}
                aria-expanded={branch ? open : undefined}
                aria-selected={activeKey === node.key}
                tabIndex={
                  focusKey === node.key ||
                  (!rows.some((r) => r.node.key === focusKey) && index === 0)
                    ? 0
                    : -1
                }
                className={`tree-item ${activeKey === node.key ? 'active' : ''}`}
                title={node.label}
                onFocus={() => setFocusKey(node.key)}
                onClick={() => {
                  onSelect(node);
                  if (node.kind === 'group') toggle(node.key);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown')
                    focus(rows[Math.min(rows.length - 1, index + 1)].node.key);
                  else if (event.key === 'ArrowUp') focus(rows[Math.max(0, index - 1)].node.key);
                  else if (event.key === 'Home') focus(rows[0].node.key);
                  else if (event.key === 'End') focus(rows.at(-1)!.node.key);
                  else if (event.key === 'ArrowRight' && branch) {
                    if (!open) toggle(node.key, true);
                    else focus(rows[index + 1].node.key);
                  } else if (event.key === 'ArrowLeft') {
                    if (branch && open) toggle(node.key, false);
                    else {
                      const parent = rows
                        .slice(0, index)
                        .reverse()
                        .find((r) => r.depth < depth);
                      if (parent) focus(parent.node.key);
                    }
                  } else return;
                  event.preventDefault();
                }}
              >
                <Icon size={14} />
                <span>{node.label}</span>
                {node.count !== undefined && <small>{node.count}</small>}
              </button>
            </div>
          );
        })}
        {!rows.length && <p className="tree-empty">No matching assets or motion.</p>}
      </div>
    </div>
  );
}
