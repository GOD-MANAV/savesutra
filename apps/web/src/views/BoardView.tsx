import { useCallback, useMemo } from 'react';
import '@xyflow/react/dist/style.css';
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, type Node, type NodeProps, type NodeTypes } from '@xyflow/react';
import { CATEGORY_COLORS, type Category, type SaveItem } from '@savesutra/core';
import { library } from '@/lib/library';
import { navigate } from '@/lib/router';
import { categoryOf, itemTitle, Eyebrow } from '@/components/bits';

const CARD_W = 220;
const CARD_H = 86;
const GAP = 14;
const COLS = 2;
const PAD = 18;
const HEADER = 42;

type CardData = { item: SaveItem };
type GroupData = { category: Category; count: number };

function CardNode({ data }: NodeProps<Node<CardData>>) {
  const it = data.item;
  return (
    <div
      className="flex h-[86px] w-[220px] cursor-grab flex-col gap-1 rounded-xl border border-line bg-surface p-2.5 shadow-card active:cursor-grabbing"
      onDoubleClick={() => navigate({ name: 'item', id: it.id })}
    >
      <Eyebrow item={it} />
      <div className="line-clamp-2 text-[13px] leading-snug font-bold">{itemTitle(it)}</div>
      {it.note && <div className="truncate text-[11px] text-muted">📝 {it.note}</div>}
    </div>
  );
}

function GroupNode({ data, width, height }: NodeProps<Node<GroupData>>) {
  const c = CATEGORY_COLORS[data.category];
  return (
    <div className="rounded-[18px] border-[1.5px]" style={{ width, height, borderColor: c.border, background: `color-mix(in srgb, ${c.bg} 55%, transparent)` }}>
      <div className="px-4 pt-3 text-xs font-extrabold tracking-[0.04em] uppercase" style={{ color: c.fg }}>
        {data.category} · {data.count}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { card: CardNode as NodeTypes[string], frame: GroupNode as NodeTypes[string] };

/**
 * Whiteboard (React Flow): saves grouped by category in frames. Drag cards
 * to arrange them; positions are saved. Double-click a card to open it.
 */
function Board({ items }: { items: SaveItem[] }) {
  const isPhone = typeof window !== 'undefined' && window.innerWidth < 640;
  const nodes = useMemo(() => {
    const byCat = new Map<Category, SaveItem[]>();
    for (const it of items) {
      const c = categoryOf(it);
      byCat.set(c, [...(byCat.get(c) ?? []), it]);
    }
    const cats = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);
    const out: Node[] = [];
    let x = 0;
    let rowY = 0;
    let rowH = 0;
    const frameW = PAD * 2 + COLS * CARD_W + (COLS - 1) * GAP;
    const perRow = typeof window !== 'undefined' && window.innerWidth < 640 ? 1 : 3;
    cats.forEach(([cat, list], i) => {
      const rows = Math.ceil(list.length / COLS);
      const frameH = HEADER + PAD + rows * CARD_H + (rows - 1) * GAP;
      if (i > 0 && i % perRow === 0) {
        x = 0;
        rowY += rowH + 60;
        rowH = 0;
      }
      out.push({ id: `g-${cat}`, type: 'frame', position: { x, y: rowY }, data: { category: cat, count: list.length }, width: frameW, height: frameH, draggable: false, selectable: false, zIndex: -1 });
      list.forEach((it, j) => {
        const auto = { x: x + PAD + (j % COLS) * (CARD_W + GAP), y: rowY + HEADER + Math.floor(j / COLS) * (CARD_H + GAP) };
        out.push({ id: it.id, type: 'card', position: it.board ?? auto, data: { item: it } });
      });
      x += frameW + 60;
      rowH = Math.max(rowH, frameH);
    });
    return out;
  }, [items]);

  const onDragStop = useCallback((_: unknown, node: Node) => {
    if (node.type === 'card') void library.update(node.id, { board: { x: Math.round(node.position.x), y: Math.round(node.position.y) } });
  }, []);

  return (
    <ReactFlow
      defaultNodes={nodes}
      key={nodes.length}
      nodeTypes={nodeTypes}
      onNodeDragStop={onDragStop}
      // Phones start at the top-left frame at readable size; larger screens fit everything.
      fitView={!isPhone}
      defaultViewport={isPhone ? { x: 12, y: 12, zoom: 0.62 } : undefined}
      fitViewOptions={{ padding: 0.12 }}
      minZoom={0.2}
      maxZoom={1.6}
      proOptions={{ hideAttribution: false }}
      nodesConnectable={false}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--border-strong)" />
      <Controls showInteractive={false} position="bottom-right" />
      {!isPhone && <MiniMap pannable zoomable position="bottom-left" nodeColor={(n) => (n.type === 'frame' ? CATEGORY_COLORS[(n.data as GroupData).category].border : 'var(--ink-2)')} />}
    </ReactFlow>
  );
}

export function BoardView({ items }: { items: SaveItem[] }) {
  return (
    <div className="h-[calc(100dvh-280px)] min-h-[420px] overflow-hidden rounded-2xl border border-line bg-bg">
      <ReactFlowProvider>
        <Board items={items} />
      </ReactFlowProvider>
      <span className="sr-only">Board view. Use the Cards or Table view for a keyboard-friendly list.</span>
    </div>
  );
}
