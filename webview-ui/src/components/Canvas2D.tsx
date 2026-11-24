import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  Background,
  Controls,
  MiniMap,
  NodeResizer,
  BackgroundVariant,
  type Node,
  type OnNodesChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  useArchStore,
  BOUNDARY_TYPES,
  INSTANCE_HOURLY,
  type ArchNode,
  type LinkDirection,
  type LinkRouting
} from '../store/useArchStore';

const COLORS: Record<string, string> = {
  Region: '#10b981',
  AZ: '#94a3b8',
  VPC: '#8b5cf6',
  Subnet: '#06b6d4',
  SecurityGroup: '#f43f5e',
  TextNote: '#e2e8f0',
  WAF: '#ef4444',
  CloudFront: '#ec4899',
  Route53: '#8b5cf6',
  KMS: '#e11d48',
  SecretsManager: '#be123c',
  IGW: '#0ea5e9',
  ALB: '#3b82f6',
  NLB: '#2563eb',
  APIGateway: '#d946ef',
  NAT: '#eab308',
  VPCEndpoint: '#6366f1',
  EC2: '#f97316',
  ASG: '#d97706',
  Lambda: '#f59e0b',
  ECS: '#0284c7',
  EKS: '#0ea5e9',
  RDS: '#3b82f6',
  Aurora: '#1d4ed8',
  DynamoDB: '#6366f1',
  ElastiCache: '#06b6d4',
  Redshift: '#7c3aed',
  Athena: '#8b5cf6',
  S3: '#10b981',
  EFS: '#22c55e',
  SQS: '#ec4899',
  SNS: '#db2777',
  CloudWatch: '#f43f5e',
  CloudTrail: '#e11d48'
};

const PALETTE_SWATCHES = [
  '#0f172a',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#ffffff'
];

const Z_INDEX: Record<string, number> = {
  Region: 1,
  VPC: 2,
  AZ: 3,
  Subnet: 4,
  SecurityGroup: 5,
  ASG: 30,
  TextNote: 60
};

type PortSide = 'top' | 'right' | 'bottom' | 'left';

function getPortCoords(node: ArchNode, side?: string | null): { x: number; y: number } {
  const { x, y } = node.position2D;
  const { width: w, height: h } = node.size;
  switch (side) {
    case 'top':
      return { x: x + w / 2, y };
    case 'bottom':
      return { x: x + w / 2, y: y + h };
    case 'left':
      return { x, y: y + h / 2 };
    case 'right':
    default:
      return { x: x + w, y: y + h / 2 };
  }
}

function getBestTargetSide(sourcePt: { x: number; y: number }, target: ArchNode): PortSide {
  const sides: PortSide[] = ['top', 'right', 'bottom', 'left'];
  let best: PortSide = 'left';
  let bestDist = Infinity;
  for (const s of sides) {
    const pt = getPortCoords(target, s);
    const d = Math.hypot(pt.x - sourcePt.x, pt.y - sourcePt.y);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

function buildFlexiblePath(
  p1: { x: number; y: number },
  s1: PortSide,
  p2: { x: number; y: number },
  s2: PortSide,
  routing: LinkRouting = 'step',
  bendOffset = 0
): { path: string; midX: number; midY: number; isHorizontalAxis: boolean } {
  const isHoriz1 = s1 === 'left' || s1 === 'right';
  const isHoriz2 = s2 === 'left' || s2 === 'right';

  if (routing === 'straight') {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2 + bendOffset;
    if (Math.abs(bendOffset) > 2) {
      return {
        path: `M ${p1.x} ${p1.y} L ${midX} ${midY} L ${p2.x} ${p2.y}`,
        midX,
        midY,
        isHorizontalAxis: isHoriz1
      };
    }
    return {
      path: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
      midX,
      midY,
      isHorizontalAxis: isHoriz1
    };
  }

  if (routing === 'curved') {
    const dx = Math.abs(p2.x - p1.x) * 0.45 + 30;
    const dy = Math.abs(p2.y - p1.y) * 0.45 + 30;
    const c1x = s1 === 'right' ? p1.x + dx : s1 === 'left' ? p1.x - dx : p1.x;
    const c1y = s1 === 'bottom' ? p1.y + dy : s1 === 'top' ? p1.y - dy : p1.y + bendOffset;
    const c2x = s2 === 'right' ? p2.x + dx : s2 === 'left' ? p2.x - dx : p2.x;
    const c2y = s2 === 'bottom' ? p2.y + dy : s2 === 'top' ? p2.y - dy : p2.y + bendOffset;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2 + bendOffset * 0.75;
    return {
      path: `M ${p1.x} ${p1.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`,
      midX,
      midY,
      isHorizontalAxis: isHoriz1
    };
  }

  // Orthogonal Step Routing with Adjustable Bend Offset
  if (isHoriz1 && isHoriz2) {
    const midX = (p1.x + p2.x) / 2 + bendOffset;
    const midY = (p1.y + p2.y) / 2;
    return {
      path: `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`,
      midX,
      midY,
      isHorizontalAxis: true
    };
  }
  if (!isHoriz1 && !isHoriz2) {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2 + bendOffset;
    return {
      path: `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`,
      midX,
      midY,
      isHorizontalAxis: false
    };
  }
  if (isHoriz1 && !isHoriz2) {
    const cornerX = p2.x + bendOffset;
    return {
      path: `M ${p1.x} ${p1.y} L ${cornerX} ${p1.y} L ${cornerX} ${p2.y} L ${p2.x} ${p2.y}`,
      midX: cornerX,
      midY: (p1.y + p2.y) / 2,
      isHorizontalAxis: true
    };
  }
  const cornerY = p2.y + bendOffset;
  return {
    path: `M ${p1.x} ${p1.y} L ${p1.x} ${cornerY} L ${p2.x} ${cornerY} L ${p2.x} ${p2.y}`,
    midX: (p1.x + p2.x) / 2,
    midY: cornerY,
    isHorizontalAxis: false
  };
}

const AwsCustomNode = ({ id, data, selected }: any) => {
  const deleteNode = useArchStore((s) => s.deleteNode);
  const duplicateNode = useArchStore((s) => s.duplicateNode);
  const resizeNode = useArchStore((s) => s.resizeNode);
  const color = data.customColor || COLORS[data.service] || '#38bdf8';
  const isBoundary = BOUNDARY_TYPES.has(data.service);

  const startManualResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = data.width || 200;
    const startH = data.height || 150;
    const minW = isBoundary ? 90 : 110;
    const minH = isBoundary ? 36 : 56;

    const onMove = (ev: MouseEvent) => {
      const nextW = Math.max(minW, Math.round((startW + (ev.clientX - startX)) / 15) * 15);
      const nextH = Math.max(minH, Math.round((startH + (ev.clientY - startY)) / 15) * 15);
      resizeNode(id, nextW, nextH);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const renderPorts = (dotColor: string) => {
    const ports: { side: PortSide; style: React.CSSProperties }[] = [
      { side: 'top', style: { top: -7, left: '50%', transform: 'translateX(-50%)' } },
      { side: 'right', style: { right: -7, top: '50%', transform: 'translateY(-50%)' } },
      { side: 'bottom', style: { bottom: -7, left: '50%', transform: 'translateX(-50%)' } },
      { side: 'left', style: { left: -7, top: '50%', transform: 'translateY(-50%)' } }
    ];

    return ports.map((p) => (
      <div
        key={p.side}
        className="nodrag nopan"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          data.onStartPortDrag?.(id, p.side, e);
        }}
        title={`Drag from ${p.side} port to connect`}
        style={{
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: p.side === 'right' || p.side === 'bottom' ? '#ff9900' : dotColor,
          border: '2px solid #ffffff',
          boxShadow: '0 0 6px rgba(0,0,0,0.6)',
          cursor: 'crosshair',
          zIndex: 150,
          ...p.style
        }}
      />
    ));
  };

  const resizerProps = {
    color: '#ffffff',
    isVisible: selected && !data.locked,
    minWidth: isBoundary ? 90 : 110,
    minHeight: isBoundary ? 36 : 56,
    handleStyle: {
      width: 10,
      height: 10,
      backgroundColor: color,
      border: '2px solid #ffffff',
      borderRadius: 2
    },
    lineStyle: {
      borderColor: '#38bdf8',
      borderWidth: 1.5
    }
  };

  if (data.service === 'ASG') {
    const count = Math.min(8, Math.max(1, data.instanceCount || 4));
    const chipLabel = (data.instanceType || 't3.medium').split('.')[0].toUpperCase();

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: `${color}dd`,
          border: `2px solid ${selected ? '#facc15' : '#fbbf24'}`,
          borderRadius: 8,
          padding: '4px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          boxSizing: 'border-box',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
        }}
      >
        <NodeResizer {...resizerProps} />
        {renderPorts('#38bdf8')}

        <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>◀</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {Array.from({ length: count }).map((_, idx) => (
            <div
              key={idx}
              style={{
                background: '#1e293b',
                border: '1.5px solid #f97316',
                color: '#fff',
                borderRadius: 4,
                padding: '3px 7px',
                fontSize: 10,
                fontWeight: 800
              }}
            >
              {chipLabel}
            </div>
          ))}
          <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginLeft: 4 }}>
            {data.label} (${data.monthlyCost.toFixed(0)}/mo)
          </span>
        </div>
        <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>▶</span>
      </div>
    );
  }

  if (isBoundary) {
    const isAZ = data.service === 'AZ';
    const isRegion = data.service === 'Region';
    const isText = data.service === 'TextNote';

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: isText
            ? 'transparent'
            : isAZ
            ? 'rgba(148, 163, 184, 0.16)'
            : isRegion
            ? 'rgba(16, 185, 129, 0.05)'
            : `${color}16`,
          border: isText
            ? selected
              ? '1px dashed #38bdf8'
              : 'none'
            : isRegion
            ? '2px solid #10b981'
            : isAZ
            ? '1.5px dashed #94a3b8'
            : `2px dashed ${selected ? '#facc15' : color}`,
          borderRadius: isAZ ? 3 : 6,
          padding: '6px 10px',
          position: 'relative',
          boxSizing: 'border-box',
          cursor: data.locked ? 'default' : 'grab'
        }}
      >
        <NodeResizer {...resizerProps} />
        {!isText && renderPorts(color)}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: isText ? 14 : 11.5,
              fontWeight: 800,
              color: data.customColor || (isRegion ? '#10b981' : isText ? (data.darkTheme ? '#f8fafc' : '#0f172a') : color),
              background: isRegion ? (data.darkTheme ? '#0b1120' : '#f8fafc') : 'transparent',
              padding: isRegion ? '0 5px' : 0
            }}
          >
            {data.label} {data.locked ? '🔒' : ''}
          </span>
          {selected && !data.locked && (
            <div className="nodrag" style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateNode(id);
                }}
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 10,
                  padding: '1px 5px',
                  cursor: 'pointer'
                }}
              >
                ⧉
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNode(id);
                }}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  fontSize: 10,
                  padding: '1px 6px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {selected && !data.locked && (
          <div
            className="nodrag"
            onMouseDown={startManualResize}
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 15,
              height: 15,
              background: color,
              border: '2px solid #fff',
              borderRadius: 3,
              cursor: 'nwse-resize',
              zIndex: 40
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: data.darkTheme ? '#1e293b' : '#ffffff',
        border: `2px solid ${data.isConnectSource ? '#f59e0b' : selected ? '#facc15' : color}`,
        borderRadius: 8,
        padding: '6px 8px',
        color: data.darkTheme ? '#f8fafc' : '#0f172a',
        boxShadow: data.isConnectSource ? '0 0 14px #f59e0b' : '0 4px 12px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxSizing: 'border-box',
        cursor: data.locked ? 'default' : 'grab'
      }}
    >
      <NodeResizer {...resizerProps} />
      {renderPorts('#38bdf8')}

      {selected && !data.locked && (
        <>
          <div className="nodrag" style={{ position: 'absolute', top: -10, right: -8, display: 'flex', gap: 3, zIndex: 30 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                duplicateNode(id);
              }}
              style={{
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 18,
                height: 18,
                fontSize: 10,
                cursor: 'pointer'
              }}
            >
              ⧉
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteNode(id);
              }}
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 18,
                height: 18,
                fontSize: 10,
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
          <div
            className="nodrag"
            onMouseDown={startManualResize}
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 13,
              height: 13,
              background: color,
              border: '2px solid #fff',
              borderRadius: 3,
              cursor: 'nwse-resize',
              zIndex: 40
            }}
          />
        </>
      )}

      <div
        style={{
          background: color,
          color: '#fff',
          fontWeight: 800,
          fontSize: 9.5,
          padding: '2px 7px',
          borderRadius: 4,
          marginBottom: 3
        }}
      >
        {data.service}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
        {data.label} {data.locked ? '🔒' : ''}
      </div>
      <div style={{ fontSize: 9.5, color: '#10b981', fontWeight: 700, marginTop: 2 }}>
        ${data.monthlyCost.toFixed(2)}/mo
      </div>
    </div>
  );
};

const nodeTypes = { awsNode: AwsCustomNode };

const FlowBoard: React.FC = () => {
  const {
    region,
    nodes,
    edges,
    selectedNodeId,
    selectedNodeIds,
    selectedEdgeId,
    activeLinkType,
    activeRouting,
    setActiveLinkType,
    setActiveRouting,
    draggingService,
    setDraggingService,
    visibleOutlines,
    toggleOutlineVisibility,
    addNode,
    duplicateNode,
    deleteNode,
    updateNodePosition,
    resizeNode,
    updateNodeConfig,
    assignNodeToVpc,
    addEdge,
    updateEdge,
    reverseEdge,
    selectNode,
    selectAllNodes,
    copySelectedNodes,
    pasteClipboardNodes,
    deleteSelected,
    selectEdge
  } = useArchStore();
  const { screenToFlowPosition } = useReactFlow();
  const viewport = useViewport();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const screenToFlowRef = useRef(screenToFlowPosition);
  screenToFlowRef.current = screenToFlowPosition;

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [portDrag, setPortDrag] = useState<{
    sourceId: string;
    sourceSide: PortSide;
    cursorFlow: { x: number; y: number };
  } | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [lockedIds, setLockedIds] = useState<Record<string, boolean>>({});
  const [darkTheme, setDarkTheme] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showDisplayMenu, setShowDisplayMenu] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [shortcutToast, setShortcutToast] = useState<string | null>(null);
  const [vpcInput, setVpcInput] = useState('');

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const existingVpcs = nodes.filter((n) => n.service === 'VPC');

  const notifyShortcut = useCallback((msg: string) => {
    setShortcutToast(msg);
    setTimeout(() => {
      setShortcutToast((prev) => (prev === msg ? null : prev));
    }, 1500);
  }, []);

  useEffect(() => {
    setVpcInput(selectedNode?.config.vpcName || '');
  }, [selectedNode?.id, selectedNode?.config.vpcName]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTyping) return;

      const isCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (isCtrl && key === 'a') {
        e.preventDefault();
        selectAllNodes();
        notifyShortcut(`Selected All (${nodesRef.current.length} items)`);
        return;
      }

      if (isCtrl && key === 'c') {
        e.preventDefault();
        copySelectedNodes();
        notifyShortcut('Copied to clipboard');
        return;
      }

      if (isCtrl && key === 'v') {
        e.preventDefault();
        pasteClipboardNodes();
        notifyShortcut('Pasted component(s)');
        return;
      }

      if (isCtrl && key === 'd') {
        e.preventDefault();
        if (selectedNodeId) {
          duplicateNode(selectedNodeId);
          notifyShortcut('Duplicated');
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        notifyShortcut('Deleted');
        return;
      }

      if (e.key === 'Escape') {
        selectNode(null);
        selectEdge(null);
        setConnectMode(false);
        setConnectFromId(null);
        setShowDisplayMenu(false);
        setShowShortcutHelp(false);
        return;
      }

      if (!isCtrl && !e.altKey) {
        if (key === 'l') {
          e.preventDefault();
          setConnectMode((m) => {
            const next = !m;
            notifyShortcut(next ? 'Link Mode: ON (Click Source → Target)' : 'Link Mode: OFF');
            return next;
          });
          setConnectFromId(null);
        } else if (e.key === '1') {
          e.preventDefault();
          setActiveLinkType('one-way');
          notifyShortcut('Link Style: → One-Way');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveLinkType('two-way');
          notifyShortcut('Link Style: ↔ Two-Way');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveLinkType('dashed');
          notifyShortcut('Link Style: ⇢ Dashed');
        } else if (key === 'r' && selectedEdgeId) {
          e.preventDefault();
          reverseEdge(selectedEdgeId);
          notifyShortcut('Reversed Link Direction');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    selectedNodeId,
    selectedEdgeId,
    selectAllNodes,
    copySelectedNodes,
    pasteClipboardNodes,
    duplicateNode,
    deleteSelected,
    selectNode,
    selectEdge,
    setActiveLinkType,
    reverseEdge,
    notifyShortcut
  ]);

  // Direct Port-to-Port Drag Handler
  const handleStartPortDrag = useCallback((sourceId: string, sourceSide: PortSide, e: React.MouseEvent) => {
    const startFlow = screenToFlowRef.current({ x: e.clientX, y: e.clientY });
    setPortDrag({ sourceId, sourceSide, cursorFlow: startFlow });

    const onMove = (ev: MouseEvent) => {
      const flowPt = screenToFlowRef.current({ x: ev.clientX, y: ev.clientY });
      setPortDrag({ sourceId, sourceSide, cursorFlow: flowPt });
    };

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);

      const dropFlow = screenToFlowRef.current({ x: ev.clientX, y: ev.clientY });
      const candidates = nodesRef.current.filter((n) => n.id !== sourceId && n.service !== 'TextNote');

      const ordered = [
        ...candidates.filter((n) => !BOUNDARY_TYPES.has(n.service)),
        ...candidates.filter((n) => BOUNDARY_TYPES.has(n.service))
      ];

      const hit = ordered.find(
        (n) =>
          dropFlow.x >= n.position2D.x - 18 &&
          dropFlow.x <= n.position2D.x + n.size.width + 18 &&
          dropFlow.y >= n.position2D.y - 18 &&
          dropFlow.y <= n.position2D.y + n.size.height + 18
      );

      if (hit) {
        const srcNode = nodesRef.current.find((n) => n.id === sourceId);
        const srcPt = srcNode ? getPortCoords(srcNode, sourceSide) : dropFlow;
        const targetSide = getBestTargetSide(srcPt, hit);
        addEdge(sourceId, hit.id, sourceSide, targetSide);
      }

      setPortDrag(null);
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
  }, [addEdge]);

  // Flexible Bend Offset Drag Handler (Drag middle circle to curve/shift arrow path!)
  const startBendDrag = (
    edgeId: string,
    initialOffset: number,
    isHorizontalAxis: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    selectEdge(edgeId);
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let moved = false;

    const onMove = (ev: MouseEvent) => {
      const delta = isHorizontalAxis
        ? (ev.clientX - startClientX) / viewport.zoom
        : (ev.clientY - startClientY) / viewport.zoom;
      if (Math.abs(delta) > 3) moved = true;
      updateEdge(edgeId, { bendOffset: Math.round(initialOffset + delta) });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      if (!moved) {
        // Simple click cycles One-Way -> Two-Way -> Dashed
        const edge = useArchStore.getState().edges.find((ed) => ed.id === edgeId);
        if (edge) {
          const next: LinkDirection =
            edge.linkType === 'one-way' ? 'two-way' : edge.linkType === 'two-way' ? 'dashed' : 'one-way';
          updateEdge(edgeId, { linkType: next });
        }
      }
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
  };

  // Sidebar Drag-and-Drop Handler
  useEffect(() => {
    if (!draggingService) {
      setGhostPos(null);
      return;
    }

    const serviceToDrop = draggingService;

    const onMouseMove = (e: MouseEvent) => {
      setGhostPos({ x: e.clientX, y: e.clientY });
    };

    const onMouseUp = (e: MouseEvent) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const flowPos = screenToFlowRef.current({ x: e.clientX, y: e.clientY });
        addNode(serviceToDrop, flowPos.x - 60, flowPos.y - 30);
      } else if (rect) {
        const centerPos = screenToFlowRef.current({
          x: rect.left + rect.width * 0.45,
          y: rect.top + rect.height * 0.4
        });
        addNode(serviceToDrop, centerPos.x - 75, centerPos.y - 45);
      }
      setDraggingService(null);
      setGhostPos(null);
    };

    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);
    return () => {
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', onMouseUp, true);
    };
  }, [draggingService, addNode, setDraggingService]);

  const rfNodes: Node[] = nodes
    .filter((n) => !BOUNDARY_TYPES.has(n.service) || visibleOutlines[n.service] !== false)
    .map((n) => {
      const isLocked = !!lockedIds[n.id];
      const layerZ = BOUNDARY_TYPES.has(n.service) ? Z_INDEX[n.service] || 1 : n.service === 'ASG' ? 30 : 50;
      const isSelected = selectedNodeIds.includes(n.id) || n.id === selectedNodeId;
      return {
        id: n.id,
        type: 'awsNode',
        position: n.position2D,
        selected: isSelected,
        draggable: !isLocked,
        zIndex: layerZ,
        width: n.size.width,
        height: n.size.height,
        style: {
          width: n.size.width,
          height: n.size.height,
          zIndex: layerZ
        },
        data: {
          service: n.service,
          label: n.label,
          monthlyCost: n.monthlyCost,
          width: n.size.width,
          height: n.size.height,
          locked: isLocked,
          darkTheme,
          isConnectSource: connectFromId === n.id,
          instanceCount: n.config.instanceCount,
          instanceType: n.config.instanceType,
          customColor: n.config.customColor,
          onStartPortDrag: handleStartPortDrag
        }
      };
    });

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const ch of changes) {
        if (ch.type === 'position' && ch.position) {
          updateNodePosition(ch.id, ch.position.x, ch.position.y);
        } else if (ch.type === 'dimensions' && ch.dimensions) {
          resizeNode(ch.id, ch.dimensions.width, ch.dimensions.height);
        } else if (ch.type === 'select' && ch.selected) {
          selectNode(ch.id);
        }
      }
    },
    [updateNodePosition, resizeNode, selectNode]
  );

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    if (connectMode) {
      if (!connectFromId) {
        setConnectFromId(node.id);
      } else if (connectFromId !== node.id) {
        const src = nodes.find((n) => n.id === connectFromId);
        const tgt = nodes.find((n) => n.id === node.id);
        const isVertical =
          src &&
          tgt &&
          Math.abs(tgt.position2D.y - src.position2D.y) > Math.abs(tgt.position2D.x - src.position2D.x);
        addEdge(connectFromId, node.id, isVertical ? 'bottom' : 'right', isVertical ? 'top' : 'left');
        setConnectFromId(null);
      }
      return;
    }
    selectNode(node.id);
  };

  const linkOptions: { type: LinkDirection; label: string; keyHint: string }[] = [
    { type: 'one-way', label: '→ One-Way [1]', keyHint: 'Shortcut: 1' },
    { type: 'two-way', label: '↔ Two-Way [2]', keyHint: 'Shortcut: 2' },
    { type: 'dashed', label: '⇢ Dashed [3]', keyHint: 'Shortcut: 3' }
  ];

  const routingOptions: { type: LinkRouting; label: string }[] = [
    { type: 'step', label: '┌ Step' },
    { type: 'curved', label: '∿ Curve' },
    { type: 'straight', label: '— Direct' }
  ];

  const activeDragSource = portDrag ? nodes.find((n) => n.id === portDrag.sourceId) : null;
  const activeDragStartPt = activeDragSource && portDrag ? getPortCoords(activeDragSource, portDrag.sourceSide) : null;

  return (
    <div
      ref={wrapperRef}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
        background: darkTheme ? '#0b1120' : '#f1f5f9',
        overflow: 'hidden'
      }}
    >
      {/* Cloudcraft Floating Top Context Bar */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 14,
          right: 245,
          zIndex: 600,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 5,
          background: '#0f172af5',
          border: '1px solid #334155',
          padding: '6px 10px',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
          color: '#f8fafc',
          fontSize: 11
        }}
      >
        {linkOptions.map((opt) => (
          <button
            key={opt.type}
            title={opt.keyHint}
            onClick={() => setActiveLinkType(opt.type)}
            style={{
              background: activeLinkType === opt.type ? '#22d3ee' : '#1e293b',
              color: activeLinkType === opt.type ? '#0f172a' : '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 5,
              padding: '4px 7px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {opt.label}
          </button>
        ))}

        {/* Routing Shape Switcher: Step / Curved / Straight */}
        <span style={{ color: '#475569' }}>|</span>
        {routingOptions.map((rt) => (
          <button
            key={rt.type}
            onClick={() => setActiveRouting(rt.type)}
            title="Switch arrow shape"
            style={{
              background: activeRouting === rt.type ? '#38bdf8' : '#1e293b',
              color: activeRouting === rt.type ? '#0f172a' : '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 5,
              padding: '4px 7px',
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {rt.label}
          </button>
        ))}

        <button
          onClick={() => {
            setConnectMode((m) => !m);
            setConnectFromId(null);
          }}
          title="Shortcut: L"
          style={{
            background: connectMode ? '#f59e0b' : '#1e293b',
            color: connectMode ? '#0f172a' : '#38bdf8',
            border: '1px solid #38bdf8',
            borderRadius: 5,
            padding: '4px 8px',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          {connectMode ? (connectFromId ? '2️⃣ Target' : '1️⃣ Source') : '🔗 Link [L]'}
        </button>

        {selectedNode && !connectMode && (
          <>
            <span style={{ color: '#475569' }}>|</span>
            <span
              style={{
                background: COLORS[selectedNode.service] || '#38bdf8',
                color: '#fff',
                fontWeight: 800,
                padding: '3px 7px',
                borderRadius: 4
              }}
            >
              {selectedNode.service}
            </span>
            <span style={{ color: '#94a3b8' }}>📍 {region.toUpperCase()}</span>

            {(selectedNode.service === 'EC2' || selectedNode.service === 'ASG') && (
              <>
                <select
                  value={selectedNode.config.platform || 'Linux'}
                  onChange={(e) =>
                    updateNodeConfig(selectedNode.id, selectedNode.label, {
                      platform: e.target.value as 'Linux' | 'Windows'
                    })
                  }
                  style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4, padding: '3px 5px' }}
                >
                  <option value="Linux">Linux</option>
                  <option value="Windows">Windows</option>
                </select>

                <select
                  value={selectedNode.config.instanceType || 'm5.large'}
                  onChange={(e) =>
                    updateNodeConfig(selectedNode.id, selectedNode.label, { instanceType: e.target.value })
                  }
                  style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4, padding: '3px 5px' }}
                >
                  {Object.keys(INSTANCE_HOURLY)
                    .filter((k) => !k.startsWith('db.'))
                    .map((inst) => (
                      <option key={inst} value={inst}>
                        {inst}
                      </option>
                    ))}
                </select>

                <select
                  value={selectedNode.config.billingOption || 'On-Demand'}
                  onChange={(e) =>
                    updateNodeConfig(selectedNode.id, selectedNode.label, {
                      billingOption: e.target.value as 'On-Demand' | 'Spot' | 'Reserved-1Yr'
                    })
                  }
                  style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4, padding: '3px 5px' }}
                >
                  <option value="On-Demand">On-Demand</option>
                  <option value="Reserved-1Yr">Reserved (1Yr)</option>
                  <option value="Spot">Spot (-65%)</option>
                </select>
              </>
            )}

            {selectedNode.service === 'ASG' && (
              <select
                value={selectedNode.config.instanceCount || 4}
                onChange={(e) =>
                  updateNodeConfig(selectedNode.id, selectedNode.label, { instanceCount: Number(e.target.value) })
                }
                style={{ background: '#1e293b', color: '#fbbf24', border: '1px solid #f59e0b', borderRadius: 4, padding: '3px 5px', fontWeight: 700 }}
              >
                {[2, 3, 4, 6, 8].map((cnt) => (
                  <option key={cnt} value={cnt}>
                    {cnt} EC2s
                  </option>
                ))}
              </select>
            )}

            {(selectedNode.service === 'ALB' || selectedNode.service === 'NLB') && (
              <select
                value={selectedNode.config.lcus || 1}
                onChange={(e) =>
                  updateNodeConfig(selectedNode.id, selectedNode.label, { lcus: Number(e.target.value) })
                }
                style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4, padding: '3px 5px' }}
              >
                {[1, 2, 5, 10].map((lcu) => (
                  <option key={lcu} value={lcu}>
                    {lcu} LCU{lcu > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            )}

            {!BOUNDARY_TYPES.has(selectedNode.service) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <input
                  list="vpc-list"
                  placeholder="Add to VPC..."
                  value={vpcInput}
                  onChange={(e) => setVpcInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') assignNodeToVpc(selectedNode.id, vpcInput);
                  }}
                  style={{
                    width: 85,
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #475569',
                    borderRadius: 4,
                    padding: '3px 6px',
                    fontSize: 10.5
                  }}
                />
                <datalist id="vpc-list">
                  {existingVpcs.map((v) => (
                    <option key={v.id} value={v.label} />
                  ))}
                </datalist>
                <button
                  onClick={() => assignNodeToVpc(selectedNode.id, vpcInput || 'YTproject')}
                  style={{
                    background: '#8b5cf6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  +VPC
                </button>
              </div>
            )}

            {BOUNDARY_TYPES.has(selectedNode.service) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {PALETTE_SWATCHES.map((sw) => (
                  <div
                    key={sw}
                    onClick={() => updateNodeConfig(selectedNode.id, selectedNode.label, { customColor: sw })}
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: 3,
                      background: sw,
                      border: '1px solid #94a3b8',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            )}

            {selectedNode.monthlyCost > 0 && (
              <span style={{ color: '#10b981', fontWeight: 800 }}>
                ${selectedNode.monthlyCost.toFixed(2)}/mo
              </span>
            )}

            <button
              onClick={() => setLockedIds((p) => ({ ...p, [selectedNode.id]: !p[selectedNode.id] }))}
              style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 5, padding: '3px 6px', cursor: 'pointer' }}
            >
              {lockedIds[selectedNode.id] ? '🔓' : '🔒'}
            </button>
            <button
              onClick={() => duplicateNode(selectedNode.id)}
              title="Duplicate (Ctrl+D)"
              style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 5, padding: '3px 6px', cursor: 'pointer' }}
            >
              ⧉
            </button>
            <button
              onClick={() => deleteNode(selectedNode.id)}
              title="Delete (Del)"
              style={{ background: '#7f1d1d', color: '#fecaca', border: '1px solid #ef4444', borderRadius: 5, padding: '3px 6px', cursor: 'pointer' }}
            >
              🗑
            </button>
          </>
        )}
      </div>

      {/* Top-Right Shortcuts Guide + Display Options */}
      <div style={{ position: 'absolute', top: 12, right: 14, zIndex: 600, display: 'flex', gap: 6 }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowShortcutHelp((v) => !v);
              setShowDisplayMenu(false);
            }}
            style={{
              background: '#0f172af2',
              color: '#38bdf8',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '6px 9px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ⌨ Shortcuts
          </button>

          {showShortcutHelp && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                marginTop: 6,
                background: '#0f172a',
                border: '1px solid #38bdf8',
                borderRadius: 8,
                padding: 10,
                width: 235,
                color: '#f8fafc',
                fontSize: 11,
                boxShadow: '0 8px 20px rgba(0,0,0,0.55)'
              }}
            >
              <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: 6 }}>KEYBOARD & LINK CONTROLS</div>
              {[
                ['Drag Mid-Circle', 'Bend / shift arrow path'],
                ['Ctrl + A', 'Select All nodes'],
                ['Ctrl + C / V', 'Copy / Paste selected'],
                ['Ctrl + D', 'Duplicate node'],
                ['Del / Backspace', 'Delete node or link'],
                ['L', 'Toggle Click-to-Link mode'],
                ['1 / 2 / 3', 'One-Way / Two-Way / Dashed'],
                ['R', 'Reverse selected link arrow'],
                ['Esc', 'Clear selection / Exit link']
              ].map(([k, desc]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
                  <span style={{ fontWeight: 700, color: '#fbbf24' }}>{k}</span>
                  <span style={{ color: '#cbd5e1' }}>{desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setShowDisplayMenu((v) => !v);
              setShowShortcutHelp(false);
            }}
            style={{
              background: '#0f172af2',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ⚙ Display
          </button>

          {showDisplayMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                marginTop: 6,
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 10,
                width: 205,
                color: '#f8fafc',
                fontSize: 11.5,
                boxShadow: '0 8px 20px rgba(0,0,0,0.5)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Theme</span>
                <button
                  onClick={() => setDarkTheme((d) => !d)}
                  style={{
                    background: '#1e293b',
                    color: '#38bdf8',
                    border: '1px solid #334155',
                    borderRadius: 4,
                    padding: '2px 8px',
                    cursor: 'pointer'
                  }}
                >
                  {darkTheme ? '🌙 Dark' : '☀️ Light'}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span>Show Grid</span>
                <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
              </div>

              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                GROUP OUTLINES
              </div>
              {(['Region', 'VPC', 'AZ', 'Subnet', 'SecurityGroup'] as const).map((grp) => (
                <div
                  key={grp}
                  onClick={() => toggleOutlineVisibility(grp)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '3px 4px',
                    cursor: 'pointer',
                    color: visibleOutlines[grp] !== false ? '#f8fafc' : '#64748b'
                  }}
                >
                  <span>{grp}</span>
                  <span>{visibleOutlines[grp] !== false ? '👁️' : '🚫'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shortcut Feedback Toast */}
      {shortcutToast && (
        <div
          style={{
            position: 'absolute',
            bottom: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 800,
            background: '#0f172a',
            color: '#22d3ee',
            border: '1px solid #22d3ee',
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: 11.5,
            fontWeight: 800,
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)'
          }}
        >
          {shortcutToast}
        </div>
      )}

      {/* Viewport-Synced Flexible Connection Arrows Overlay */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 350,
          overflow: 'visible'
        }}
      >
        <defs>
          {/* orient="auto-start-reverse" makes start arrow point BACKWARD & end arrow point FORWARD! */}
          <marker
            id="arrow-cyan"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3.5"
            orient="auto-start-reverse"
          >
            <polygon points="0 0, 9 3.5, 0 7" fill="#38bdf8" />
          </marker>
          <marker
            id="arrow-purple"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3.5"
            orient="auto-start-reverse"
          >
            <polygon points="0 0, 9 3.5, 0 7" fill="#a855f7" />
          </marker>
          <marker
            id="arrow-yellow"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3.5"
            orient="auto-start-reverse"
          >
            <polygon points="0 0, 9 3.5, 0 7" fill="#facc15" />
          </marker>
        </defs>

        <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
          {edges.map((edge) => {
            const src = nodes.find((n) => n.id === edge.source);
            const tgt = nodes.find((n) => n.id === edge.target);
            if (!src || !tgt) return null;

            const s1 = (edge.sourceHandle as PortSide) || 'right';
            const s2 = (edge.targetHandle as PortSide) || 'left';
            const p1 = getPortCoords(src, s1);
            const p2 = getPortCoords(tgt, s2);
            const { path, midX, midY, isHorizontalAxis } = buildFlexiblePath(
              p1,
              s1,
              p2,
              s2,
              edge.routing || 'step',
              edge.bendOffset || 0
            );

            const isSelected = edge.id === selectedEdgeId;
            const strokeColor = isSelected ? '#facc15' : edge.linkType === 'two-way' ? '#a855f7' : '#38bdf8';
            const markerId = isSelected
              ? 'url(#arrow-yellow)'
              : edge.linkType === 'two-way'
              ? 'url(#arrow-purple)'
              : 'url(#arrow-cyan)';

            return (
              <g key={edge.id}>
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectEdge(edge.id);
                  }}
                />
                <path
                  d={path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3.5 : 2.6}
                  strokeDasharray={edge.linkType === 'dashed' ? '7 5' : undefined}
                  markerEnd={markerId}
                  markerStart={edge.linkType === 'two-way' ? markerId : undefined}
                  style={{ pointerEvents: 'none' }}
                />
                {/* Draggable + Clickable Midpoint Handle */}
                <g
                  transform={`translate(${midX}, ${midY})`}
                  style={{ pointerEvents: 'all', cursor: isHorizontalAxis ? 'ew-resize' : 'ns-resize' }}
                  onMouseDown={(e) => startBendDrag(edge.id, edge.bendOffset || 0, isHorizontalAxis, e)}
                >
                  <title>Click to toggle One-Way/Two-Way/Dashed • Drag to bend arrow path</title>
                  <circle r={11} fill={isSelected ? '#facc15' : '#0284c7'} stroke="#ffffff" strokeWidth={2} />
                  <text
                    textAnchor="middle"
                    dy="3.5"
                    fontSize="11"
                    fontWeight="bold"
                    fill={isSelected ? '#0f172a' : '#ffffff'}
                  >
                    {edge.linkType === 'two-way' ? '↔' : edge.linkType === 'dashed' ? '⇢' : '↗'}
                  </text>
                </g>
                {edge.label && (
                  <g transform={`translate(${midX}, ${midY - 18})`}>
                    <rect x={-36} y={-9} width={72} height={16} rx={4} fill="#0f172a" stroke={strokeColor} strokeWidth={1} />
                    <text textAnchor="middle" dy="3" fontSize="9.5" fontWeight="bold" fill="#f8fafc">
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {portDrag && activeDragStartPt && (
            <line
              x1={activeDragStartPt.x}
              y1={activeDragStartPt.y}
              x2={portDrag.cursorFlow.x}
              y2={portDrag.cursorFlow.y}
              stroke="#22d3ee"
              strokeWidth={3}
              strokeDasharray="6 4"
              markerEnd="url(#arrow-cyan)"
            />
          )}
        </g>
      </svg>

      <ReactFlow
        nodes={rfNodes}
        edges={[]}
        nodeTypes={nodeTypes}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        onNodesChange={onNodesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={() => {
          selectNode(null);
          selectEdge(null);
          setConnectFromId(null);
          setShowShortcutHelp(false);
          setShowDisplayMenu(false);
        }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        snapToGrid
        snapGrid={[15, 15]}
      >
        {showGrid && (
          <Background variant={BackgroundVariant.Lines} color={darkTheme ? '#1e293b' : '#cbd5e1'} gap={20} />
        )}
        <Controls showInteractive={false} />
        <MiniMap style={{ background: '#0f172a' }} nodeColor="#38bdf8" />
      </ReactFlow>

      {draggingService && ghostPos && (
        <div
          style={{
            position: 'fixed',
            left: ghostPos.x + 14,
            top: ghostPos.y + 14,
            background: '#22d3ee',
            color: '#0f172a',
            fontWeight: 800,
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: 6,
            boxShadow: '0 6px 16px rgba(0,0,0,0.55)',
            pointerEvents: 'none',
            zIndex: 99999
          }}
        >
          + Drop {draggingService}
        </div>
      )}
    </div>
  );
};

export const Canvas2D: React.FC = () => (
  <ReactFlowProvider>
    <FlowBoard />
  </ReactFlowProvider>
);