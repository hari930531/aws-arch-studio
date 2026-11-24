import { useEffect } from 'react';
import { useArchStore } from './store/useArchStore';
import { BudgetHeader } from './components/BudgetHeader';
import { ServicePalette } from './components/ServicePalette';
import { Canvas2D } from './components/Canvas2D';
import { Canvas3D } from './components/Canvas3D';
import { PropertyDrawer } from './components/PropertyDrawer';

declare function acquireVsCodeApi(): { postMessage: (msg: any) => void };
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

function buildStandaloneSvg(): string {
  const { region, nodes, edges } = useArchStore.getState();
  const rects = nodes
    .map(
      (n) =>
        `<g transform="translate(${n.position2D.x}, ${n.position2D.y})">
          <rect width="${n.size.width}" height="${n.size.height}" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
          <text x="10" y="20" fill="#f8fafc" font-family="Arial" font-size="12" font-weight="bold">${n.label} (${n.service})</text>
        </g>`
    )
    .join('\n');

  const lines = edges
    .map((e) => {
      const s = nodes.find((n) => n.id === e.source);
      const t = nodes.find((n) => n.id === e.target);
      if (!s || !t) return '';
      const x1 = s.position2D.x + s.size.width / 2;
      const y1 = s.position2D.y + s.size.height / 2;
      const x2 = t.position2D.x + t.size.width / 2;
      const y2 = t.position2D.y + t.size.height / 2;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#38bdf8" stroke-width="2.5"/>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" style="background:#0b1120">
    <text x="20" y="28" fill="#38bdf8" font-family="Arial" font-size="16" font-weight="bold">AWS Arch Studio — ${region}</text>
    ${lines}
    ${rects}
  </svg>`;
}

export function App() {
  const {
    viewMode,
    region,
    monthlyBudget,
    nodes,
    edges,
    currentFilePath,
    currentFileName,
    markSaved,
    loadArchitecture,
    setRecentFiles
  } = useArchStore();

  const handleSaveJson = (forceSaveAs = false) => {
    vscode?.postMessage({
      type: 'saveArchitecture',
      forceSaveAs,
      filePath: currentFilePath,
      suggestedName: currentFileName,
      payload: { region, monthlyBudget, nodes, edges }
    });
  };

  const handleOpenJson = () => {
    vscode?.postMessage({ type: 'openArchitectureDialog' });
  };

  const handleOpenRecent = (filePath: string) => {
    vscode?.postMessage({ type: 'openRecentFile', filePath });
  };

  const handleExportTf = () => {
    vscode?.postMessage({
      type: 'exportTerraform',
      payload: { region, nodes, edges }
    });
  };

  const handleExportSvg = () => {
    vscode?.postMessage({
      type: 'exportDiagramSvg',
      svgContent: buildStandaloneSvg()
    });
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'initData' && msg.recentFiles) {
        setRecentFiles(msg.recentFiles);
      } else if (msg.type === 'recentFiles' && msg.files) {
        setRecentFiles(msg.files);
      } else if (msg.type === 'architectureSaved') {
        markSaved(msg.filePath, msg.fileName);
      } else if (msg.type === 'architectureLoaded') {
        loadArchitecture(msg.filePath, msg.fileName, msg.data);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [markSaved, loadArchitecture, setRecentFiles]);

  // Ctrl + S Keyboard Shortcut to Save Architecture
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveJson(e.shiftKey);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <BudgetHeader
        onSaveJson={handleSaveJson}
        onOpenJson={handleOpenJson}
        onOpenRecent={handleOpenRecent}
        onExportTf={handleExportTf}
        onExportSvg={handleExportSvg}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ServicePalette />
        {viewMode === '2D' ? <Canvas2D /> : <Canvas3D />}
        <PropertyDrawer />
      </div>
    </div>
  );
}

export default App;