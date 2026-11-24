import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateTerraformBundle } from './services/terraformGen';

const RECENT_FILES_KEY = 'awsArchStudio.recentFiles';

export function activate(context: vscode.ExtensionContext) {
  const openDesigner = async (fileUri?: vscode.Uri) => {
    const panel = vscode.window.createWebviewPanel(
      'awsArchStudio',
      'AWS Arch Studio (2D/3D)',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'webview-ui', 'dist'))]
      }
    );

    const distPath = path.join(context.extensionPath, 'webview-ui', 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    html = html.replace(/(src|href)="\/?([^"]+)"/g, (_match, attr, filePath) => {
      const resourceUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(distPath, filePath)));
      return `${attr}="${resourceUri}"`;
    });

    panel.webview.html = html;

    const getRecentFiles = (): string[] => {
      return context.globalState.get<string[]>(RECENT_FILES_KEY, []).filter((p) => fs.existsSync(p));
    };

    const addRecentFile = async (filePath: string) => {
      const current = getRecentFiles().filter((p) => p !== filePath);
      const updated = [filePath, ...current].slice(0, 8);
      await context.globalState.update(RECENT_FILES_KEY, updated);
      panel.webview.postMessage({ type: 'recentFiles', files: updated });
    };

    const loadFileIntoWebview = async (targetPath: string) => {
      try {
        const raw = await fs.promises.readFile(targetPath, 'utf8');
        const parsed = JSON.parse(raw);
        panel.title = `AWS Arch Studio — ${path.basename(targetPath)}`;
        panel.webview.postMessage({
          type: 'architectureLoaded',
          filePath: targetPath,
          fileName: path.basename(targetPath),
          data: parsed
        });
        await addRecentFile(targetPath);
        vscode.window.showInformationMessage(`Loaded architecture: ${path.basename(targetPath)}`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to open architecture file: ${err?.message || err}`);
      }
    };

    panel.webview.postMessage({
      type: 'initData',
      recentFiles: getRecentFiles()
    });

    if (fileUri && fileUri.fsPath) {
      setTimeout(() => loadFileIntoWebview(fileUri.fsPath), 400);
    }

    panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'saveArchitecture') {
        let targetPath: string | undefined = msg.forceSaveAs ? undefined : msg.filePath;

        if (!targetPath) {
          const defaultFolder =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.env.USERPROFILE || '';
          const defaultUri = vscode.Uri.file(
            path.join(defaultFolder, msg.suggestedName || 'aws-architecture.arch.json')
          );

          const picked = await vscode.window.showSaveDialog({
            title: 'Save AWS Architecture Blueprint',
            defaultUri,
            filters: {
              'AWS Arch Studio Blueprint (*.arch.json)': ['arch.json', 'json']
            }
          });

          if (!picked) return;
          targetPath = picked.fsPath;
        }

        const payload = {
          version: '2.0',
          savedAt: new Date().toISOString(),
          region: msg.payload.region,
          monthlyBudget: msg.payload.monthlyBudget,
          nodes: msg.payload.nodes,
          edges: msg.payload.edges
        };

        await fs.promises.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
        panel.title = `AWS Arch Studio — ${path.basename(targetPath)}`;
        panel.webview.postMessage({
          type: 'architectureSaved',
          filePath: targetPath,
          fileName: path.basename(targetPath)
        });
        await addRecentFile(targetPath);
        vscode.window.showInformationMessage(`Architecture saved to ${targetPath}`);
      }

      if (msg.type === 'openArchitectureDialog') {
        const picked = await vscode.window.showOpenDialog({
          title: 'Open Saved AWS Architecture (.arch.json)',
          canSelectMany: false,
          filters: {
            'AWS Arch Studio Blueprint (*.arch.json, *.json)': ['arch.json', 'json']
          }
        });
        if (picked && picked[0]) {
          await loadFileIntoWebview(picked[0].fsPath);
        }
      }

      if (msg.type === 'openRecentFile' && msg.filePath) {
        await loadFileIntoWebview(msg.filePath);
      }

      if (msg.type === 'exportTerraform') {
        const defaultFolder =
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.env.USERPROFILE || '';

        const folderPicked = await vscode.window.showOpenDialog({
          title: 'Select Folder to Save Generated Terraform Files (provider.tf, variables.tf, main.tf, outputs.tf)',
          defaultUri: defaultFolder ? vscode.Uri.file(defaultFolder) : undefined,
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: 'Generate Terraform Here'
        });

        if (!folderPicked || !folderPicked[0]) return;

        const targetDir = folderPicked[0].fsPath;
        const bundle = generateTerraformBundle(
          msg.payload.region,
          msg.payload.nodes,
          msg.payload.edges
        );

        for (const [filename, content] of Object.entries(bundle)) {
          await fs.promises.writeFile(path.join(targetDir, filename), content, 'utf8');
        }

        const mainTfPath = path.join(targetDir, 'main.tf');
        const doc = await vscode.workspace.openTextDocument(mainTfPath);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

        vscode.window.showInformationMessage(
          `Terraform files (provider.tf, variables.tf, main.tf, outputs.tf) generated in ${targetDir}`
        );
      }

      if (msg.type === 'exportDiagramSvg' && msg.svgContent) {
        const defaultFolder =
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.env.USERPROFILE || '';
        const picked = await vscode.window.showSaveDialog({
          title: 'Export Architecture Diagram (SVG)',
          defaultUri: vscode.Uri.file(path.join(defaultFolder, 'aws-architecture.svg')),
          filters: { 'SVG Vector Diagram (*.svg)': ['svg'] }
        });

        if (!picked) return;
        await fs.promises.writeFile(picked.fsPath, msg.svgContent, 'utf8');
        vscode.window.showInformationMessage(`Diagram exported to ${picked.fsPath}`);
      }
    });
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('awsArchStudio.open', openDesigner),
    vscode.commands.registerCommand('aws-arch-studio.open', openDesigner)
  );
}

export function deactivate() {}