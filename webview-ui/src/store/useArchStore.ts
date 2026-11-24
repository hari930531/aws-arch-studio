import { create } from 'zustand';
import { calculateNodeMonthlyCost, type NodeConfig } from '../engines/costCalculator';

export type LinkDirection = 'one-way' | 'two-way' | 'dashed';
export type LinkRouting = 'step' | 'curved' | 'straight';

export interface ExtendedConfig extends NodeConfig {
  platform?: 'Linux' | 'Windows';
  billingOption?: 'On-Demand' | 'Spot' | 'Reserved-1Yr';
  instanceCount?: number;
  lcus?: number;
  lbType?: 'Application' | 'Network';
  vpcName?: string;
  subnetName?: string;
  sgName?: string;
  customColor?: string;
}

export interface ArchNode {
  id: string;
  service: string;
  category: 'boundary' | 'service';
  label: string;
  position2D: { x: number; y: number };
  size: { width: number; height: number };
  config: ExtendedConfig;
  monthlyCost: number;
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  linkType: LinkDirection;
  routing?: LinkRouting;
  bendOffset?: number;
  label?: string;
}

interface ArchState {
  region: string;
  monthlyBudget: number;
  viewMode: '2D' | '3D';
  pricing: any;
  nodes: ArchNode[];
  edges: ArchEdge[];
  currentFilePath: string | null;
  currentFileName: string;
  isDirty: boolean;
  recentFiles: string[];
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  clipboardNodes: ArchNode[];
  activeLinkType: LinkDirection;
  activeRouting: LinkRouting;
  draggingService: string | null;
  visibleOutlines: Record<string, boolean>;
  setRecentFiles: (files: string[]) => void;
  markSaved: (filePath: string, fileName: string) => void;
  loadArchitecture: (filePath: string, fileName: string, data: any) => void;
  newArchitecture: () => void;
  toggleOutlineVisibility: (type: string) => void;
  setDraggingService: (s: string | null) => void;
  setActiveLinkType: (t: LinkDirection) => void;
  setActiveRouting: (r: LinkRouting) => void;
  setPricing: (p: any) => void;
  setRegion: (r: string) => void;
  setMonthlyBudget: (b: number) => void;
  setViewMode: (m: '2D' | '3D') => void;
  selectNode: (id: string | null) => void;
  selectAllNodes: () => void;
  copySelectedNodes: () => void;
  pasteClipboardNodes: () => void;
  deleteSelected: () => void;
  selectEdge: (id: string | null) => void;
  addNode: (service: string, x?: number, y?: number) => void;
  duplicateNode: (id: string) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  resizeNode: (id: string, width: number, height: number) => void;
  updateNodeConfig: (id: string, label: string, patch: Partial<ExtendedConfig>) => void;
  assignNodeToVpc: (nodeId: string, vpcName: string) => void;
  deleteNode: (id: string) => void;
  clearCanvas: () => void;
  addEdge: (source: string, target: string, sourceHandle?: string | null, targetHandle?: string | null) => void;
  updateEdge: (id: string, patch: Partial<ArchEdge>) => void;
  reverseEdge: (id: string) => void;
  deleteEdge: (id: string) => void;
}

export const BOUNDARY_TYPES = new Set(['Region', 'AZ', 'VPC', 'Subnet', 'SecurityGroup', 'TextNote']);

const defaultConfigs: Record<string, ExtendedConfig> = {
  WAF: { hours: 730 },
  CloudFront: {},
  Route53: {},
  IGW: {},
  VPCEndpoint: { hours: 730 },
  APIGateway: { hours: 730 },
  ALB: { hours: 730, lbType: 'Application', lcus: 1 },
  NLB: { hours: 730, lbType: 'Network', lcus: 1 },
  NAT: { hours: 730 },
  EC2: {
    instanceType: 'm5.large',
    platform: 'Linux',
    billingOption: 'On-Demand',
    storageGb: 50,
    volumeType: 'gp2',
    hours: 730
  },
  ASG: {
    instanceType: 't3.medium',
    platform: 'Linux',
    billingOption: 'On-Demand',
    instanceCount: 4,
    storageGb: 30,
    volumeType: 'gp3',
    hours: 730
  },
  Lambda: {},
  ECS: { hours: 730 },
  EKS: { hours: 730 },
  RDS: { instanceType: 'db.t3.medium', storageGb: 100, volumeType: 'gp2', hours: 730 },
  Aurora: { instanceType: 'db.r6g.large', storageGb: 100, volumeType: 'gp3', hours: 730 },
  DynamoDB: { storageGb: 50 },
  ElastiCache: { instanceType: 't3.micro', hours: 730 },
  Redshift: { hours: 730 },
  Athena: {},
  S3: { storageGb: 200 },
  EFS: { storageGb: 100 },
  SQS: {},
  SNS: {},
  CloudWatch: {},
  CloudTrail: {},
  KMS: {},
  SecretsManager: {}
};

const REGION_MULTIPLIER: Record<string, number> = {
  'ap-south-1': 1.08,
  'ap-south-2': 1.08,
  'us-east-1': 1.0,
  'us-east-2': 1.0,
  'us-west-2': 1.0,
  'eu-west-1': 1.11,
  'eu-west-2': 1.14,
  'eu-central-1': 1.16,
  'ap-southeast-1': 1.15,
  'ap-northeast-1': 1.18,
  'ap-southeast-2': 1.16
};

export const INSTANCE_HOURLY: Record<string, number> = {
  't3.micro': 0.0104,
  't3.small': 0.0208,
  't3.medium': 0.0416,
  't4g.medium': 0.0336,
  'm5.large': 0.096,
  'm7i.large': 0.1008,
  'm7g.large': 0.0816,
  'c6i.large': 0.085,
  'db.t3.micro': 0.017,
  'db.t3.medium': 0.068,
  'db.r6g.large': 0.26
};

const fallbackMonthlyCosts: Record<string, number> = {
  WAF: 10.0,
  CloudFront: 5.0,
  Route53: 1.5,
  IGW: 0.0,
  VPCEndpoint: 7.3,
  APIGateway: 3.5,
  ALB: 22.27,
  NLB: 20.1,
  NAT: 32.85,
  Lambda: 1.0,
  ECS: 28.0,
  EKS: 73.0,
  DynamoDB: 6.25,
  ElastiCache: 12.4,
  Redshift: 180.0,
  Athena: 5.0,
  S3: 4.6,
  EFS: 30.0,
  SQS: 0.5,
  SNS: 0.5,
  CloudWatch: 3.0,
  CloudTrail: 2.0,
  KMS: 1.0,
  SecretsManager: 0.4
};

function computeCost(service: string, config: ExtendedConfig, region: string, pricing: any): number {
  if (BOUNDARY_TYPES.has(service)) return 0;

  const mult = REGION_MULTIPLIER[region] || 1.0;
  const hours = config.hours ?? 730;
  const storageGb = config.storageGb ?? 0;
  const volRate = config.volumeType === 'gp3' ? 0.08 : 0.1;
  const billingMult =
    config.billingOption === 'Spot' ? 0.35 : config.billingOption === 'Reserved-1Yr' ? 0.65 : 1.0;
  const platformMult = config.platform === 'Windows' ? 1.45 : 1.0;

  if (service === 'EC2' || service === 'RDS' || service === 'Aurora') {
    const rate = INSTANCE_HOURLY[config.instanceType || 't3.medium'] || 0.0416;
    return (rate * hours * billingMult * platformMult + storageGb * volRate) * mult;
  }

  if (service === 'ASG') {
    const count = config.instanceCount || 4;
    const rate = INSTANCE_HOURLY[config.instanceType || 't3.medium'] || 0.0416;
    return count * (rate * hours * billingMult * platformMult + storageGb * volRate) * mult;
  }

  if (service === 'ALB' || service === 'NLB') {
    const lcus = config.lcus || 1;
    return (0.0225 * hours + lcus * 5.84) * mult;
  }

  if (service === 'NAT') return 0.045 * hours * mult;
  if (service === 'S3') return storageGb * 0.023 * mult;

  try {
    if (pricing && pricing.services) {
      const base = calculateNodeMonthlyCost(service, config, region, pricing);
      if (typeof base === 'number' && !Number.isNaN(base) && base > 0) return base;
    }
  } catch {
    // ignore
  }

  return (fallbackMonthlyCosts[service] || 0) * mult;
}

const defaultSizes: Record<string, { width: number; height: number }> = {
  Region: { width: 640, height: 460 },
  AZ: { width: 250, height: 360 },
  VPC: { width: 540, height: 390 },
  Subnet: { width: 220, height: 170 },
  SecurityGroup: { width: 190, height: 140 },
  TextNote: { width: 170, height: 42 },
  ASG: { width: 420, height: 68 }
};

export const useArchStore = create<ArchState>((set, get) => ({
  region: 'ap-south-1',
  monthlyBudget: 250,
  viewMode: '2D',
  pricing: null,
  nodes: [],
  edges: [],
  currentFilePath: null,
  currentFileName: 'untitled-architecture.arch.json',
  isDirty: false,
  recentFiles: [],
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  clipboardNodes: [],
  activeLinkType: 'one-way',
  activeRouting: 'step',
  draggingService: null,
  visibleOutlines: {
    Region: true,
    VPC: true,
    AZ: true,
    Subnet: true,
    SecurityGroup: true,
    TextNote: true
  },

  setRecentFiles: (recentFiles) => set({ recentFiles }),

  markSaved: (filePath, fileName) =>
    set({ currentFilePath: filePath, currentFileName: fileName, isDirty: false }),

  loadArchitecture: (filePath, fileName, data) => {
    const { pricing } = get();
    const loadedRegion = data.region || 'ap-south-1';
    const loadedNodes: ArchNode[] = (data.nodes || []).map((n: ArchNode) => ({
      ...n,
      monthlyCost: computeCost(n.service, n.config || {}, loadedRegion, pricing)
    }));

    set({
      region: loadedRegion,
      monthlyBudget: data.monthlyBudget ?? 250,
      nodes: loadedNodes,
      edges: data.edges || [],
      currentFilePath: filePath,
      currentFileName: fileName,
      isDirty: false,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null
    });
  },

  newArchitecture: () =>
    set({
      nodes: [],
      edges: [],
      currentFilePath: null,
      currentFileName: 'untitled-architecture.arch.json',
      isDirty: false,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null
    }),

  toggleOutlineVisibility: (type) =>
    set((s) => ({
      visibleOutlines: { ...s.visibleOutlines, [type]: !s.visibleOutlines[type] }
    })),

  setDraggingService: (draggingService) => set({ draggingService }),

  setActiveLinkType: (activeLinkType) => {
    const { selectedEdgeId, edges } = get();
    set({
      activeLinkType,
      isDirty: selectedEdgeId ? true : get().isDirty,
      edges: selectedEdgeId
        ? edges.map((e) => (e.id === selectedEdgeId ? { ...e, linkType: activeLinkType } : e))
        : edges
    });
  },

  setActiveRouting: (activeRouting) => {
    const { selectedEdgeId, edges } = get();
    set({
      activeRouting,
      isDirty: selectedEdgeId ? true : get().isDirty,
      edges: selectedEdgeId
        ? edges.map((e) => (e.id === selectedEdgeId ? { ...e, routing: activeRouting } : e))
        : edges
    });
  },

  setPricing: (pricing) => {
    const { nodes, region } = get();
    set({
      pricing,
      nodes: nodes.map((n) => ({
        ...n,
        monthlyCost: computeCost(n.service, n.config, region, pricing)
      }))
    });
  },

  setRegion: (region) => {
    const { nodes, pricing } = get();
    set({
      region,
      isDirty: true,
      nodes: nodes.map((n) => ({
        ...n,
        label: n.service === 'Region' ? region : n.label,
        monthlyCost: computeCost(n.service, n.config, region, pricing)
      }))
    });
  },

  setMonthlyBudget: (monthlyBudget) => set({ monthlyBudget, isDirty: true }),
  setViewMode: (viewMode) => set({ viewMode }),

  selectNode: (id) =>
    set({
      selectedNodeId: id,
      selectedNodeIds: id ? [id] : [],
      selectedEdgeId: id ? null : get().selectedEdgeId
    }),

  selectAllNodes: () => {
    const allIds = get().nodes.map((n) => n.id);
    set({
      selectedNodeIds: allIds,
      selectedNodeId: allIds.length > 0 ? allIds[allIds.length - 1] : null,
      selectedEdgeId: null
    });
  },

  copySelectedNodes: () => {
    const { nodes, selectedNodeIds, selectedNodeId } = get();
    const targetIds = selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : [];
    const copied = nodes.filter((n) => targetIds.includes(n.id));
    if (copied.length > 0) {
      set({ clipboardNodes: copied });
    }
  },

  pasteClipboardNodes: () => {
    const { clipboardNodes, nodes } = get();
    if (clipboardNodes.length === 0) return;

    const now = Date.now();
    const pasted: ArchNode[] = clipboardNodes.map((n, idx) => ({
      ...n,
      id: `node-${now}-${idx}-${Math.floor(Math.random() * 1000)}`,
      label: `${n.label}-copy`,
      position2D: { x: n.position2D.x + 35, y: n.position2D.y + 35 },
      config: { ...n.config }
    }));

    const newIds = pasted.map((p) => p.id);
    set({
      nodes: [...nodes, ...pasted],
      selectedNodeIds: newIds,
      selectedNodeId: newIds[newIds.length - 1],
      clipboardNodes: pasted,
      isDirty: true
    });
  },

  deleteSelected: () => {
    const { selectedEdgeId, selectedNodeIds, selectedNodeId, nodes, edges } = get();
    if (selectedEdgeId) {
      set({
        edges: edges.filter((e) => e.id !== selectedEdgeId),
        selectedEdgeId: null,
        isDirty: true
      });
      return;
    }

    const toDelete = new Set(
      selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : []
    );
    if (toDelete.size === 0) return;

    set({
      nodes: nodes.filter((n) => !toDelete.has(n.id)),
      edges: edges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target)),
      selectedNodeId: null,
      selectedNodeIds: [],
      isDirty: true
    });
  },

  selectEdge: (selectedEdgeId) =>
    set({
      selectedEdgeId,
      selectedNodeId: selectedEdgeId ? null : get().selectedNodeId,
      selectedNodeIds: selectedEdgeId ? [] : get().selectedNodeIds
    }),

  addNode: (service, x, y) => {
    const { nodes, region, pricing } = get();
    const id = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const isBoundary = BOUNDARY_TYPES.has(service);
    const config = { ...(defaultConfigs[service] || {}) };
    const size = { ...(defaultSizes[service] || { width: 136, height: 78 }) };
    const monthlyCost = computeCost(service, config, region, pricing);

    const step = (nodes.length % 7) * 25;
    const posX = typeof x === 'number' && !Number.isNaN(x) ? x : 140 + step;
    const posY = typeof y === 'number' && !Number.isNaN(y) ? y : 90 + step;

    const label =
      service === 'Region'
        ? region
        : service === 'AZ'
        ? `${region}${nodes.filter((n) => n.service === 'AZ').length % 2 === 0 ? 'a' : 'b'}`
        : service === 'TextNote'
        ? 'Architecture Note'
        : service === 'ASG'
        ? 'App Server ASG'
        : `${service}-${nodes.length + 1}`;

    set({
      nodes: [
        ...nodes,
        {
          id,
          service,
          category: isBoundary ? 'boundary' : 'service',
          label,
          position2D: { x: posX, y: posY },
          size,
          config,
          monthlyCost
        }
      ],
      selectedNodeId: id,
      selectedNodeIds: [id],
      selectedEdgeId: null,
      isDirty: true
    });
  },

  duplicateNode: (id) => {
    const target = get().nodes.find((n) => n.id === id);
    if (!target) return;
    const newId = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    set({
      nodes: [
        ...get().nodes,
        {
          ...target,
          id: newId,
          label: `${target.label}-copy`,
          position2D: { x: target.position2D.x + 30, y: target.position2D.y + 30 },
          config: { ...target.config }
        }
      ],
      selectedNodeId: newId,
      selectedNodeIds: [newId],
      isDirty: true
    });
  },

  updateNodePosition: (id, x, y) => {
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, position2D: { x, y } } : n)),
      isDirty: true
    });
  },

  resizeNode: (id, width, height) => {
    if (width < 40 || height < 30) return;
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, size: { width, height } } : n)),
      isDirty: true
    });
  },

  updateNodeConfig: (id, label, patch) => {
    const { nodes, region, pricing } = get();
    set({
      isDirty: true,
      nodes: nodes.map((n) => {
        if (n.id !== id) return n;
        const config = { ...n.config, ...patch };
        return {
          ...n,
          label,
          config,
          monthlyCost: computeCost(n.service, config, region, pricing)
        };
      })
    });
  },

  assignNodeToVpc: (nodeId, vpcName) => {
    const cleanName = vpcName.trim();
    if (!cleanName) return;
    const { nodes } = get();
    let existingVpc = nodes.find((n) => n.service === 'VPC' && n.label.toLowerCase() === cleanName.toLowerCase());
    const targetNode = nodes.find((n) => n.id === nodeId);

    let nextNodes = [...nodes];
    if (!existingVpc && targetNode) {
      const newVpcId = `node-vpc-${Date.now()}`;
      existingVpc = {
        id: newVpcId,
        service: 'VPC',
        category: 'boundary',
        label: cleanName,
        position2D: { x: Math.max(30, targetNode.position2D.x - 160), y: Math.max(30, targetNode.position2D.y - 120) },
        size: { width: 520, height: 380 },
        config: {},
        monthlyCost: 0
      };
      nextNodes.push(existingVpc);
    }

    nextNodes = nextNodes.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            config: { ...n.config, vpcName: cleanName },
            position2D: existingVpc
              ? { x: existingVpc.position2D.x + 180, y: existingVpc.position2D.y + 130 }
              : n.position2D
          }
        : n
    );

    set({ nodes: nextNodes, isDirty: true });
  },

  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
      selectedNodeIds: get().selectedNodeIds.filter((sid) => sid !== id),
      isDirty: true
    });
  },

  clearCanvas: () =>
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedEdgeId: null,
      isDirty: true
    }),

  addEdge: (source, target, sourceHandle, targetHandle) => {
    const id = `edge-${Date.now()}`;
    const linkType = get().activeLinkType;
    const routing = get().activeRouting;
    set({
      edges: [
        ...get().edges,
        { id, source, target, sourceHandle, targetHandle, linkType, routing, bendOffset: 0, label: '' }
      ],
      selectedEdgeId: id,
      selectedNodeId: null,
      selectedNodeIds: [],
      isDirty: true
    });
  },

  updateEdge: (id, patch) => {
    set({
      edges: get().edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      isDirty: true
    });
  },

  reverseEdge: (id) => {
    set({
      isDirty: true,
      edges: get().edges.map((e) =>
        e.id === id
          ? {
              ...e,
              source: e.target,
              target: e.source,
              sourceHandle: e.targetHandle,
              targetHandle: e.sourceHandle
            }
          : e
      )
    });
  },

  deleteEdge: (id) => {
    set({
      edges: get().edges.filter((e) => e.id !== id),
      selectedEdgeId: get().selectedEdgeId === id ? null : get().selectedEdgeId,
      isDirty: true
    });
  }
}));