import React, { useState } from 'react';
import { useArchStore } from '../store/useArchStore';

const AWS_REGIONS = [
  { id: 'ap-south-1', label: 'ap-south-1 (Mumbai)' },
  { id: 'ap-south-2', label: 'ap-south-2 (Hyderabad)' },
  { id: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
  { id: 'us-east-2', label: 'us-east-2 (Ohio)' },
  { id: 'us-west-2', label: 'us-west-2 (Oregon)' },
  { id: 'eu-west-1', label: 'eu-west-1 (Ireland)' },
  { id: 'eu-west-2', label: 'eu-west-2 (London)' },
  { id: 'eu-central-1', label: 'eu-central-1 (Frankfurt)' },
  { id: 'ap-southeast-1', label: 'ap-southeast-1 (Singapore)' },
  { id: 'ap-northeast-1', label: 'ap-northeast-1 (Tokyo)' },
  { id: 'ap-southeast-2', label: 'ap-southeast-2 (Sydney)' }
];

interface Props {
  onSaveJson: (forceSaveAs?: boolean) => void;
  onOpenJson: () => void;
  onOpenRecent: (filePath: string) => void;
  onExportTf: () => void;
  onExportSvg: () => void;
}

export const BudgetHeader: React.FC<Props> = ({
  onSaveJson,
  onOpenJson,
  onOpenRecent,
  onExportTf,
  onExportSvg
}) => {
  const {
    region,
    setRegion,
    monthlyBudget,
    setMonthlyBudget,
    viewMode,
    setViewMode,
    nodes,
    currentFileName,
    isDirty,
    recentFiles,
    newArchitecture
  } = useArchStore();

  const [showFileMenu, setShowFileMenu] = useState(false);

  const totalCost = nodes.reduce((sum, n) => sum + (n.monthlyCost || 0), 0);
  const overBudget = totalCost > monthlyBudget;

  return (
    <header
      style={{
        minHeight: 52,
        background: '#0b1120',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        color: '#f1f5f9',
        gap: 10,
        position: 'relative',
        zIndex: 900
      }}
    >
      {/* Left: Brand, File Menu, Active File Name & Region */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: '#38bdf8' }}>AWS Arch Studio</span>

        {/* File Dropdown (New / Open / Recent / Save / Save As / Export SVG) */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowFileMenu((v) => !v)}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            📁 File ▾
          </button>

          {showFileMenu && (
            <div
              style={{
                position: 'absolute',
                top: '115%',
                left: 0,
                background: '#0f172a',
                border: '1px solid #38bdf8',
                borderRadius: 8,
                padding: 6,
                width: 245,
                boxShadow: '0 10px 24px rgba(0,0,0,0.65)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 12,
                zIndex: 1000
              }}
            >
              <button
                onClick={() => {
                  newArchitecture();
                  setShowFileMenu(false);
                }}
                style={menuBtnStyle}
              >
                <span>📄 New Blueprint</span>
              </button>

              <button
                onClick={() => {
                  onOpenJson();
                  setShowFileMenu(false);
                }}
                style={menuBtnStyle}
              >
                <span>📂 Open Saved (.arch.json)...</span>
              </button>

              <button
                onClick={() => {
                  onSaveJson(false);
                  setShowFileMenu(false);
                }}
                style={menuBtnStyle}
              >
                <span>💾 Save</span>
                <span style={{ color: '#94a3b8', fontSize: 10 }}>Ctrl+S</span>
              </button>

              <button
                onClick={() => {
                  onSaveJson(true);
                  setShowFileMenu(false);
                }}
                style={menuBtnStyle}
              >
                <span>📝 Save As (Choose Folder)...</span>
              </button>

              <div style={{ height: 1, background: '#1e293b', margin: '3px 0' }} />

              <button
                onClick={() => {
                  onExportTf();
                  setShowFileMenu(false);
                }}
                style={menuBtnStyle}
              >
                <span>⚡ Generate Terraform (.tf)...</span>
              </button>

              <button
                onClick={() => {
                  onExportSvg();
                  setShowFileMenu(false);
                }}
                style={menuBtnStyle}
              >
                <span>🖼️ Export Diagram (.svg)...</span>
              </button>

              {recentFiles.length > 0 && (
                <>
                  <div style={{ height: 1, background: '#1e293b', margin: '3px 0' }} />
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', padding: '2px 8px' }}>
                    RECENT ARCHITECTURES
                  </div>
                  {recentFiles.map((fp) => {
                    const base = fp.split(/[/\\]/).pop() || fp;
                    return (
                      <button
                        key={fp}
                        title={fp}
                        onClick={() => {
                          onOpenRecent(fp);
                          setShowFileMenu(false);
                        }}
                        style={{
                          ...menuBtnStyle,
                          fontSize: 11,
                          color: '#38bdf8'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          🕒 {base}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Active File Badge */}
        <span
          title="Active Blueprint File"
          style={{
            background: '#162033',
            border: '1px solid #26354d',
            borderRadius: 5,
            padding: '4px 8px',
            fontSize: 11,
            color: '#cbd5e1',
            maxWidth: 185,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {currentFileName}
          {isDirty ? ' *' : ''}
        </span>

        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          style={{
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '5px 8px',
            fontSize: 12,
            cursor: 'pointer'
          }}
        >
          {AWS_REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Center: Live Cost vs Budget Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: overBudget ? '#450a0a' : '#064e3b',
          border: `1px solid ${overBudget ? '#ef4444' : '#10b981'}`,
          padding: '4px 12px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700
        }}
      >
        <span style={{ color: overBudget ? '#fca5a5' : '#6ee7b7' }}>
          Est: ${totalCost.toFixed(2)}/mo
        </span>
        <span style={{ color: '#64748b' }}>|</span>
        <span>Budget: $</span>
        <input
          type="number"
          value={monthlyBudget}
          onChange={(e) => setMonthlyBudget(Number(e.target.value))}
          style={{
            width: 58,
            background: '#0f172a',
            color: '#fff',
            border: '1px solid #334155',
            borderRadius: 4,
            padding: '2px 5px',
            fontSize: 12,
            fontWeight: 700
          }}
        />
      </div>

      {/* Right: 2D/3D Toggle, Quick Open/Save & Generate Terraform */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => setViewMode(viewMode === '2D' ? '3D' : '2D')}
          style={{
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          {viewMode === '2D' ? '3D View' : '2D View'}
        </button>

        <button
          onClick={onOpenJson}
          title="Open saved .arch.json file to view or edit"
          style={{
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '6px 9px',
            fontSize: 11.5,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Open
        </button>

        <button
          onClick={() => onSaveJson(false)}
          title="Save architecture to chosen location (Ctrl+S)"
          style={{
            background: '#10b981',
            color: '#064e3b',
            border: 'none',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11.5,
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          Save
        </button>

        <button
          onClick={onExportTf}
          title="Generate Terraform files (provider.tf, variables.tf, main.tf, outputs.tf)"
          style={{
            background: '#f59e0b',
            color: '#0f172a',
            border: 'none',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 11.5,
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          Generate Terraform
        </button>
      </div>
    </header>
  );
};

const menuBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#f8fafc',
  border: 'none',
  borderRadius: 5,
  padding: '6px 8px',
  textAlign: 'left',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  fontSize: 12
};