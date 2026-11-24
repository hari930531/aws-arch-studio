import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PricingService } from '../services/pricingService';
import { generateTerraform } from '../services/terraformGen';

export class ArchStudioPanel {
  public static currentPanel: ArchStudioPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
    if (ArchStudioPanel.currentPanel) {
      ArchStudioPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'awsArchStudio',
      'AWS Arch Studio (2D/3D)',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'webview-ui', 'dist')]
      }
    );

    ArchStudioPanel.currentPanel = new ArchStudioPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._panel.webview.html = this._getHtmlForWebview();

    this._panel.onDidDispose(() => {
      ArchStudioPanel.currentPanel = undefined;
    });

    this._panel.webview.onDidReceiveMessage(async (msg) => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      if (msg.command === 'GET_PRICING') {
        this._panel.webview.postMessage({
          command: 'PRICING_DATA',
          payload: PricingService.getPricingData()
        });
      } else if (msg.command === 'SAVE_JSON') {
        if (!workspaceFolder) {
          vscode.window.showWarningMessage('Open a folder in VS Code first to save files!');
          return;
        }
        const filePath = path.join(workspaceFolder, 'architecture.awsarch.json');
        fs.writeFileSync(filePath, JSON.stringify(msg.payload, null, 2));
        vscode.window.showInformationMessage('Saved architecture.awsarch.json!');
      } else if (msg.command === 'EXPORT_TERRAFORM') {
        if (!workspaceFolder) {
          vscode.window.showWarningMessage('Open a folder in VS Code first to export main.tf!');
          return;
        }
        const tfCode = generateTerraform(msg.payload);
        const tfPath = path.join(workspaceFolder, 'main.tf');
        fs.writeFileSync(tfPath, tfCode);
        const doc = await vscode.workspace.openTextDocument(tfPath);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        vscode.window.showInformationMessage('Generated main.tf!');
      }
    });
  }

  private _getHtmlForWebview(): string {
    const distPath = path.join(this._extensionUri.fsPath, 'webview-ui', 'dist');
    const indexPath = path.join(distPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      return `<html><body style="color:white;background:#0b1120;padding:2rem;">
        <h2>Build webview-ui first! Run: <code>npm run build</code></h2>
      </body></html>`;
    }

    let html = fs.readFileSync(indexPath, 'utf8');
    const baseUri = this._panel.webview.asWebviewUri(vscode.Uri.file(distPath));
    html = html.replace(/(href|src)="\/assets\//g, `$1="${baseUri}/assets/`);
    return html;
  }
}