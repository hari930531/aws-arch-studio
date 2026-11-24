import type { ArchNode } from '../store/useArchStore';
import type { NodeConfig } from './costCalculator';

export interface FinOpsRecommendation {
  id: string;
  nodeId: string;
  nodeLabel: string;
  title: string;
  estimatedMonthlySavings: number;
  patch: Partial<NodeConfig>;
}

export function generateFinOpsRecommendations(
  nodes: ArchNode[],
  _region: string,
  _pricing: any
): FinOpsRecommendation[] {
  const recs: FinOpsRecommendation[] = [];

  for (const node of nodes) {
    if (node.category === 'boundary') continue;

    // 1. EBS gp2 -> gp3 migration
    if ((node.service === 'EC2' || node.service === 'ASG' || node.service === 'RDS') && node.config.volumeType === 'gp2') {
      const gb = node.config.storageGb || 50;
      recs.push({
        id: `rec-gp3-${node.id}`,
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Upgrade ${node.label} storage from gp2 to gp3 (20% cheaper + 3,000 IOPS)`,
        estimatedMonthlySavings: Math.max(1.0, gb * 0.02),
        patch: { volumeType: 'gp3' }
      });
    }

    // 2. EC2 / ASG x86 (t3) -> AWS Graviton (t4g)
    if ((node.service === 'EC2' || node.service === 'ASG') && node.config.instanceType?.startsWith('t3.')) {
      recs.push({
        id: `rec-graviton-${node.id}`,
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Migrate ${node.label} (${node.config.instanceType}) to t4g.medium (AWS Graviton ARM)`,
        estimatedMonthlySavings: 6.2,
        patch: { instanceType: 't4g.medium' }
      });
    }

    // 3. Off-hours Instance Scheduler (EC2, RDS, Aurora, EKS)
    if (
      (node.service === 'EC2' || node.service === 'RDS' || node.service === 'Aurora' || node.service === 'EKS') &&
      (node.config.hours || 730) >= 700
    ) {
      const savings = Math.max(4.5, node.monthlyCost * 0.35);
      recs.push({
        id: `rec-schedule-${node.id}`,
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Enable Off-Hours Scheduler on ${node.label} (730h → 450h/mo)`,
        estimatedMonthlySavings: savings,
        patch: { hours: 450 }
      });
    }

    // 4. NAT Gateway Gateway Endpoint Offload
    if (node.service === 'NAT' && (node.config.hours || 730) >= 700) {
      recs.push({
        id: `rec-nat-${node.id}`,
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Add S3/DynamoDB Gateway VPC Endpoint to offload ${node.label} traffic`,
        estimatedMonthlySavings: 12.5,
        patch: { hours: 480 }
      });
    }

    // 5. ALB / NLB idle connection consolidation
    if ((node.service === 'ALB' || node.service === 'NLB') && (node.config.hours || 730) >= 700) {
      recs.push({
        id: `rec-lb-${node.id}`,
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Use Host/Path-Based Routing on ${node.label} to consolidate multiple microservices`,
        estimatedMonthlySavings: 8.2,
        patch: { hours: 500 }
      });
    }

    // 6. S3 Intelligent-Tiering
    if (node.service === 'S3' && (node.config.storageGb || 0) >= 100) {
      const gb = node.config.storageGb || 200;
      recs.push({
        id: `rec-s3-${node.id}`,
        nodeId: node.id,
        nodeLabel: node.label,
        title: `Enable S3 Intelligent-Tiering lifecycle policy on ${node.label}`,
        estimatedMonthlySavings: Math.max(1.5, gb * 0.008),
        patch: { storageGb: Math.round(gb * 0.7) }
      });
    }
  }

  return recs;
}