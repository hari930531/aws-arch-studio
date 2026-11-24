import React from 'react';
import { useArchStore, type LinkDirection } from '../store/useArchStore';
import { generateFinOpsRecommendations } from '../engines/finopsRules';

export const PropertyDrawer: React.FC = () => {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    updateNodeConfig,
    updateEdge,
    deleteEdge,
    pricing,
    region
  } = useArchStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const recommendations = generateFinOpsRecommendations(nodes, region, pricing);

  const handleOptimizeAll = () => {
    for (const rec of recommendations) {
      updateNodeConfig(rec.nodeId, rec.nodeLabel, rec.patch);
    }
  };

  return (
    <aside
      style={{
        width: 270,
        background: '#0f172a',
        borderLeft: '1px solid #1e293b',
        padding: 12,
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        overflowY: 'auto'
      }}
    >
      {selectedEdge ? (
        <div style={{ background: '#1e293b', padding: 10, borderRadius: 8, border: '1px solid #38bdf8' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 8 }}>
            CONNECTION / LINK SETTINGS
          </div>

          <label style={{ fontSize: 11, color: '#94a3b8' }}>Link Direction</label>
          <select
            value={selectedEdge.linkType}
            onChange={(e) => updateEdge(selectedEdge.id, { linkType: e.target.value as LinkDirection })}
            style={{
              width: '100%',
              marginTop: 4,
              marginBottom: 10,
              padding: 6,
              background: '#0f172a',
              color: '#fff',
              border: '1px solid #334155',
              borderRadius: 4
            }}
          >
            <option value="one-way">→ One-Way Link (Directional)</option>
            <option value="two-way">↔ Two-Way Link (Bidirectional)</option>
            <option value="dashed">⇢ Async / Event Link (Dashed)</option>
          </select>

          <label style={{ fontSize: 11, color: '#94a3b8' }}>Protocol / Port Label</label>
          <input
            type="text"
            placeholder="e.g. HTTPS:443, TCP:3306"
            value={selectedEdge.label || ''}
            onChange={(e) => updateEdge(selectedEdge.id, { label: e.target.value })}
            style={{
              width: '100%',
              marginTop: 4,
              marginBottom: 10,
              padding: 6,
              background: '#0f172a',
              color: '#fff',
              border: '1px solid #334155',
              borderRadius: 4
            }}
          />

          <button
            onClick={() => deleteEdge(selectedEdge.id)}
            style={{
              width: '100%',
              padding: '6px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 5,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Delete Link
          </button>
        </div>
      ) : selectedNode ? (
        <div style={{ background: '#1e293b', padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#22d3ee', marginBottom: 8 }}>
            RESOURCE INSPECTOR
          </div>

          <label style={{ fontSize: 11, color: '#94a3b8' }}>Label</label>
          <input
            value={selectedNode.label}
            onChange={(e) => updateNodeConfig(selectedNode.id, e.target.value, {})}
            style={{
              width: '100%',
              marginTop: 4,
              marginBottom: 8,
              padding: 6,
              background: '#0f172a',
              color: '#fff',
              border: '1px solid #334155',
              borderRadius: 4
            }}
          />

          {(selectedNode.service === 'EC2' || selectedNode.service === 'ASG') && (
            <>
              <label style={{ fontSize: 11, color: '#94a3b8' }}>Instance Type</label>
              <select
                value={selectedNode.config.instanceType}
                onChange={(e) => updateNodeConfig(selectedNode.id, selectedNode.label, { instanceType: e.target.value })}
                style={{
                  width: '100%',
                  marginTop: 4,
                  marginBottom: 8,
                  padding: 6,
                  background: '#0f172a',
                  color: '#fff',
                  border: '1px solid #334155',
                  borderRadius: 4
                }}
              >
                <option value="t3.micro">t3.micro</option>
                <option value="t3.small">t3.small</option>
                <option value="t3.medium">t3.medium</option>
                <option value="t4g.medium">t4g.medium (Graviton)</option>
                <option value="m6i.large">m6i.large</option>
              </select>

              <label style={{ fontSize: 11, color: '#94a3b8' }}>Volume Type</label>
              <select
                value={selectedNode.config.volumeType}
                onChange={(e) =>
                  updateNodeConfig(selectedNode.id, selectedNode.label, { volumeType: e.target.value as 'gp2' | 'gp3' })
                }
                style={{
                  width: '100%',
                  marginTop: 4,
                  marginBottom: 8,
                  padding: 6,
                  background: '#0f172a',
                  color: '#fff',
                  border: '1px solid #334155',
                  borderRadius: 4
                }}
              >
                <option value="gp2">gp2 (General Purpose SSD)</option>
                <option value="gp3">gp3 (Next-Gen SSD)</option>
              </select>
            </>
          )}

          {selectedNode.config.storageGb !== undefined && (
            <>
              <label style={{ fontSize: 11, color: '#94a3b8' }}>Storage (GB)</label>
              <input
                type="number"
                value={selectedNode.config.storageGb}
                onChange={(e) =>
                  updateNodeConfig(selectedNode.id, selectedNode.label, { storageGb: Number(e.target.value) })
                }
                style={{
                  width: '100%',
                  marginTop: 4,
                  marginBottom: 8,
                  padding: 6,
                  background: '#0f172a',
                  color: '#fff',
                  border: '1px solid #334155',
                  borderRadius: 4
                }}
              />
            </>
          )}

          <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginTop: 4 }}>
            Monthly Cost: ${selectedNode.monthlyCost.toFixed(2)}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#64748b' }}>
          Drag from any of the 4 side dots on a service to create links, or click a component to inspect.
        </div>
      )}

      {/* FinOps Recommendations */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>
            FINOPS ({recommendations.length})
          </span>
          {recommendations.length > 0 && (
            <button
              onClick={handleOptimizeAll}
              style={{
                background: '#f59e0b',
                color: '#0f172a',
                border: 'none',
                borderRadius: 4,
                padding: '3px 7px',
                fontSize: 10.5,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Optimize All
            </button>
          )}
        </div>

        {recommendations.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Add compute/DB/network services to see cost optimizations.
          </div>
        ) : (
          recommendations.map((rec) => (
            <div
              key={rec.id}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: 10,
                marginBottom: 8
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{rec.title}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                  Save ${rec.estimatedMonthlySavings.toFixed(2)}/mo
                </span>
                <button
                  onClick={() => updateNodeConfig(rec.nodeId, rec.nodeLabel, rec.patch)}
                  style={{
                    background: '#10b981',
                    color: '#064e3b',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  1-Click Fix
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};