import React, { useState } from 'react';
import { useArchStore } from '../store/useArchStore';

const CATEGORIES = [
  {
    name: 'Boundaries & Shapes',
    items: [
      { type: 'Region', color: '#10b981', desc: 'AWS Region Boundary' },
      { type: 'AZ', color: '#94a3b8', desc: 'Availability Zone Column' },
      { type: 'VPC', color: '#8b5cf6', desc: 'Resizable VPC Boundary' },
      { type: 'Subnet', color: '#06b6d4', desc: 'Public / Private Subnet' },
      { type: 'SecurityGroup', color: '#f43f5e', desc: 'Security Group Box' },
      { type: 'TextNote', color: '#e2e8f0', desc: 'Diagram Text Label' }
    ]
  },
  {
    name: 'Edge & Security',
    items: [
      { type: 'WAF', color: '#ef4444', desc: 'Web Application Firewall' },
      { type: 'CloudFront', color: '#ec4899', desc: 'Global CDN Edge' },
      { type: 'Route53', color: '#8b5cf6', desc: 'DNS & Domain Routing' },
      { type: 'KMS', color: '#e11d48', desc: 'Key Management Service' },
      { type: 'SecretsManager', color: '#be123c', desc: 'Credential Vault' }
    ]
  },
  {
    name: 'Networking',
    items: [
      { type: 'IGW', color: '#0ea5e9', desc: 'Internet Gateway' },
      { type: 'ALB', color: '#3b82f6', desc: 'Application Load Balancer' },
      { type: 'NLB', color: '#2563eb', desc: 'Network Load Balancer' },
      { type: 'APIGateway', color: '#d946ef', desc: 'REST / WebSocket API' },
      { type: 'NAT', color: '#eab308', desc: 'NAT Gateway' },
      { type: 'VPCEndpoint', color: '#6366f1', desc: 'PrivateLink Endpoint' }
    ]
  },
  {
    name: 'Compute & Containers',
    items: [
      { type: 'EC2', color: '#f97316', desc: 'Virtual Server Instance' },
      { type: 'ASG', color: '#ea580c', desc: 'Auto Scaling Group' },
      { type: 'Lambda', color: '#f59e0b', desc: 'Serverless Function' },
      { type: 'ECS', color: '#0284c7', desc: 'Fargate Containers' },
      { type: 'EKS', color: '#0ea5e9', desc: 'Managed Kubernetes' }
    ]
  },
  {
    name: 'Database & Analytics',
    items: [
      { type: 'RDS', color: '#3b82f6', desc: 'Managed Relational DB' },
      { type: 'Aurora', color: '#1d4ed8', desc: 'Cloud-Native SQL DB' },
      { type: 'DynamoDB', color: '#6366f1', desc: 'NoSQL Key-Value DB' },
      { type: 'ElastiCache', color: '#06b6d4', desc: 'In-Memory Redis Cache' },
      { type: 'Redshift', color: '#7c3aed', desc: 'Data Warehouse' },
      { type: 'Athena', color: '#8b5cf6', desc: 'Serverless S3 SQL Query' }
    ]
  },
  {
    name: 'Storage, Queue & Monitoring',
    items: [
      { type: 'S3', color: '#10b981', desc: 'Simple Object Storage' },
      { type: 'EFS', color: '#22c55e', desc: 'Elastic File System' },
      { type: 'SQS', color: '#ec4899', desc: 'Message Queue' },
      { type: 'SNS', color: '#db2777', desc: 'Pub/Sub Notifications' },
      { type: 'CloudWatch', color: '#f43f5e', desc: 'Logs, Metrics & Alarms' },
      { type: 'CloudTrail', color: '#e11d48', desc: 'Audit & Governance' }
    ]
  }
];

export const ServicePalette: React.FC = () => {
  const { clearCanvas, setDraggingService } = useArchStore();
  const [search, setSearch] = useState('');
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({
    'Boundaries & Shapes': true,
    'Edge & Security': true,
    Networking: true,
    'Compute & Containers': true,
    'Database & Analytics': false,
    'Storage, Queue & Monitoring': false
  });

  const toggleCat = (name: string) => setOpenCats((p) => ({ ...p, [name]: !p[name] }));

  return (
    <aside
      style={{
        width: 230,
        height: '100%',
        background: '#0f172a',
        borderRight: '1px solid #1e293b',
        padding: 10,
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
        AWS Components (34)
      </div>

      <input
        type="text"
        placeholder="Search WAF, EC2, RDS, EKS..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 9px',
          marginBottom: 8,
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 6,
          color: '#f8fafc',
          fontSize: 12
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
        {CATEGORIES.map((cat) => {
          const filtered = cat.items.filter(
            (i) =>
              i.type.toLowerCase().includes(search.toLowerCase()) ||
              i.desc.toLowerCase().includes(search.toLowerCase())
          );
          if (filtered.length === 0) return null;

          const isExpanded = search.trim().length > 0 ? true : openCats[cat.name];

          return (
            <div key={cat.name} style={{ marginBottom: 7 }}>
              <div
                onClick={() => toggleCat(cat.name)}
                style={{
                  background: '#1e293b',
                  padding: '5px 8px',
                  borderRadius: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#38bdf8',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 5
                }}
              >
                <span>{cat.name}</span>
                <span>{isExpanded ? '▾' : '▸'}</span>
              </div>

              {isExpanded &&
                filtered.map((item) => (
                  <div
                    key={item.type}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setDraggingService(item.type);
                    }}
                    title="Drag onto canvas or Click to add"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 8px',
                      marginBottom: 4,
                      background: '#162033',
                      border: '1px solid #26354d',
                      borderRadius: 6,
                      cursor: 'grab'
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 24,
                        borderRadius: 5,
                        background: item.color,
                        color: '#fff',
                        fontSize: 8.5,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {item.type.slice(0, 3).toUpperCase()}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#f8fafc' }}>{item.type}</div>
                      <div style={{ fontSize: 9.5, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      <button
        onClick={clearCanvas}
        style={{
          width: '100%',
          marginTop: 6,
          padding: '7px',
          background: '#334155',
          color: '#f8fafc',
          border: 'none',
          borderRadius: 6,
          fontSize: 11.5,
          cursor: 'pointer'
        }}
      >
        Clear Canvas
      </button>
    </aside>
  );
};