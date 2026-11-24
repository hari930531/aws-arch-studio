import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Line, Grid } from '@react-three/drei';
import { useArchStore, BOUNDARY_TYPES } from '../store/useArchStore';

const COLORS_3D: Record<string, string> = {
  Region: '#10b981',
  AZ: '#94a3b8',
  VPC: '#8b5cf6',
  Subnet: '#06b6d4',
  SecurityGroup: '#f43f5e',
  WAF: '#ef4444',
  CloudFront: '#ec4899',
  Route53: '#8b5cf6',
  ALB: '#3b82f6',
  NLB: '#2563eb',
  NAT: '#eab308',
  EC2: '#f97316',
  ASG: '#d97706',
  Lambda: '#f59e0b',
  EKS: '#0ea5e9',
  RDS: '#3b82f6',
  Aurora: '#1d4ed8',
  S3: '#10b981'
};

export const Canvas3D: React.FC = () => {
  const { nodes, edges, selectNode, selectedNodeId } = useArchStore();

  const scale = 0.025;
  const to3D = (pos: { x: number; y: number }, size: { width: number; height: number }) => ({
    x: (pos.x + size.width / 2 - 420) * scale,
    z: (pos.y + size.height / 2 - 260) * scale
  });

  const nodeMap = useMemo(() => {
    const m = new Map<string, { x: number; z: number }>();
    for (const n of nodes) m.set(n.id, to3D(n.position2D, n.size));
    return m;
  }, [nodes]);

  return (
    <div style={{ flex: 1, height: '100%', background: '#090d16', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 16,
          zIndex: 10,
          background: 'rgba(15,23,42,0.88)',
          padding: '6px 12px',
          borderRadius: 6,
          color: '#38bdf8',
          fontSize: 12,
          border: '1px solid #1e293b'
        }}
      >
        3D Isometric View — Left-drag: Rotate | Scroll: Zoom | Right-drag: Pan
      </div>

      <Canvas camera={{ position: [12, 13, 12], fov: 42 }}>
        <color attach="background" args={['#090d16']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[12, 22, 14]} intensity={1.1} />

        <Grid
          infiniteGrid
          cellSize={0.5}
          sectionSize={2.5}
          cellColor="#1e293b"
          sectionColor="#334155"
          fadeDistance={40}
        />

        {nodes.map((node) => {
          const { x, z } = to3D(node.position2D, node.size);
          const w3d = Math.max(1.1, node.size.width * scale);
          const d3d = Math.max(0.9, node.size.height * scale);
          const isSelected = node.id === selectedNodeId;
          const color = node.config.customColor || COLORS_3D[node.service] || '#38bdf8';

          // Boundary Platforms (Region / VPC / AZ / Subnet)
          if (BOUNDARY_TYPES.has(node.service)) {
            const elevation =
              node.service === 'Region' ? 0.02 : node.service === 'VPC' ? 0.05 : node.service === 'AZ' ? 0.08 : 0.11;
            return (
              <group key={node.id} position={[x, elevation, z]} onClick={() => selectNode(node.id)}>
                <mesh>
                  <boxGeometry args={[w3d, 0.03, d3d]} />
                  <meshStandardMaterial color={color} transparent opacity={node.service === 'Region' ? 0.12 : 0.22} />
                </mesh>
                <Text
                  position={[-w3d / 2 + 0.6, 0.08, -d3d / 2 + 0.35]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  fontSize={0.28}
                  color="#f8fafc"
                >
                  {node.label}
                </Text>
              </group>
            );
          }

          // Cloudcraft ASG Orange Platform Strip + Multiple EC2 Chips
          if (node.service === 'ASG') {
            const count = Math.min(6, Math.max(2, node.config.instanceCount || 4));
            return (
              <group key={node.id} position={[x, 0.25, z]} onClick={() => selectNode(node.id)}>
                <mesh>
                  <boxGeometry args={[w3d, 0.18, d3d]} />
                  <meshStandardMaterial color={isSelected ? '#facc15' : color} />
                </mesh>
                {Array.from({ length: count }).map((_, idx) => {
                  const chipX = -w3d * 0.35 + (idx * (w3d * 0.7)) / Math.max(1, count - 1);
                  return (
                    <mesh key={idx} position={[chipX, 0.24, 0]}>
                      <boxGeometry args={[0.45, 0.28, 0.45]} />
                      <meshStandardMaterial color="#f97316" />
                    </mesh>
                  );
                })}
                <Text position={[0, 0.65, 0]} fontSize={0.28} color="#ffffff">
                  {`${node.label} (${count}x)`}
                </Text>
              </group>
            );
          }

          // 3D Database Cylinders (RDS / Aurora)
          if (node.service === 'RDS' || node.service === 'Aurora') {
            return (
              <group key={node.id} position={[x, 0.55, z]} onClick={() => selectNode(node.id)}>
                <mesh>
                  <cylinderGeometry args={[0.55, 0.55, 0.9, 24]} />
                  <meshStandardMaterial color={isSelected ? '#facc15' : color} />
                </mesh>
                <Text position={[0, 0.75, 0]} fontSize={0.28} color="#ffffff">
                  {`${node.label}\n($${node.monthlyCost.toFixed(0)}/mo)`}
                </Text>
              </group>
            );
          }

          // Standard 3D Service Cube (EC2, ALB, WAF, CloudFront, S3)
          return (
            <group key={node.id} position={[x, 0.5, z]} onClick={() => selectNode(node.id)}>
              <mesh>
                <boxGeometry args={[0.95, 0.75, 0.95]} />
                <meshStandardMaterial color={isSelected ? '#facc15' : color} />
              </mesh>
              <Text position={[0, 0.72, 0]} fontSize={0.27} color="#ffffff" anchorX="center">
                {`${node.label}\n($${node.monthlyCost.toFixed(0)}/mo)`}
              </Text>
            </group>
          );
        })}

        {/* 3D Connection Lines */}
        {edges.map((edge) => {
          const from = nodeMap.get(edge.source);
          const to = nodeMap.get(edge.target);
          if (!from || !to) return null;
          return (
            <Line
              key={edge.id}
              points={[
                [from.x, 0.45, from.z],
                [to.x, 0.45, to.z]
              ]}
              color={edge.linkType === 'two-way' ? '#a855f7' : '#38bdf8'}
              lineWidth={2.5}
            />
          );
        })}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};