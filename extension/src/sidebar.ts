import * as vscode from 'vscode';
import type { AuthorshipMap } from '../../src/authorship-map';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _map?: AuthorshipMap;
  private _filePath?: string;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    this._render();
  }

  updateResults(map: AuthorshipMap | undefined, filePath: string): void {
    this._map = map;
    this._filePath = filePath;
    this._render();
  }

  private _render(): void {
    if (!this._view) return;

    let totalLines = 0, aiLines = 0, humanLines = 0, aiPct = '0.0', humanPct = '0.0', confidence = '0';
    let fileName = this._filePath ? this._filePath.split(/[\/\\]/).pop() || this._filePath : 'No file open';

    if (this._map) {
      const summary = this._map.getSummary();
      totalLines = summary.totalLines;
      aiLines = summary.aiLines;
      humanLines = summary.humanLines;
      aiPct = summary.aiPercentage.toFixed(1);
      humanPct = summary.humanPercentage.toFixed(1);

      const allLines = this._map.getAllLines();
      if (allLines.length > 0) {
        const totalConf = allLines.reduce((sum, line) => sum + line.confidence, 0);
        confidence = ((totalConf / allLines.length) * 100).toFixed(0);
      }
    }

    const aiPctNum = parseFloat(aiPct);

    this._view.webview.html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    padding: 16px 14px;
    animation: fadeIn 0.4s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulseGlow {
    0%, 100% { filter: drop-shadow(0 0 4px rgba(255, 107, 138, 0.3)); }
    50%      { filter: drop-shadow(0 0 8px rgba(255, 107, 138, 0.5)); }
  }

  /* ── Header ─────────────────────────── */
  .header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .header svg {
    flex-shrink: 0;
    animation: pulseGlow 3s ease-in-out infinite;
  }

  .header-text h2 {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.4px;
    background: linear-gradient(135deg, #FF6B8A, #FFB347);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .file-name {
    font-size: 11px;
    opacity: 0.5;
    word-break: break-all;
    margin-top: 2px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  /* ── Donut Chart ────────────────────── */
  .chart-wrap {
    display: flex;
    justify-content: center;
    margin: 18px 0;
    position: relative;
  }

  .donut {
    width: 130px;
    height: 130px;
    border-radius: 50%;
    position: relative;
    background: conic-gradient(
      #FF6B8A 0% ${aiPct}%,
      #5DDEB4 ${aiPct}% 100%
    );
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 0 20px rgba(255, 107, 138, 0.15),
      0 0 20px rgba(93, 222, 180, 0.15);
    transition: box-shadow 0.3s ease;
  }

  .donut:hover {
    box-shadow:
      0 0 28px rgba(255, 107, 138, 0.25),
      0 0 28px rgba(93, 222, 180, 0.25);
  }

  .donut-hole {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--vscode-sideBar-background, #1e1e1e);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .donut-icon { font-size: 18px; line-height: 1; }
  .donut-pct {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: ${aiPctNum > 50 ? '#FF6B8A' : '#5DDEB4'};
  }
  .donut-sub {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.5;
    margin-top: 1px;
  }

  /* ── Stat Scoops ────────────────────── */
  .scoops {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 14px;
  }

  .scoop {
    border-radius: 20px;
    padding: 14px 10px;
    text-align: center;
    position: relative;
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .scoop:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(0,0,0,0.3);
  }

  .scoop-ai {
    background: linear-gradient(145deg, rgba(255,107,138,0.15), rgba(255,107,138,0.05));
    border: 1px solid rgba(255,107,138,0.2);
  }

  .scoop-human {
    background: linear-gradient(145deg, rgba(93,222,180,0.15), rgba(93,222,180,0.05));
    border: 1px solid rgba(93,222,180,0.2);
  }

  .scoop-emoji { font-size: 16px; margin-bottom: 4px; }

  .scoop-value {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .scoop-value.ai   { color: #FF6B8A; }
  .scoop-value.human { color: #5DDEB4; }

  .scoop-label {
    font-size: 10px;
    opacity: 0.55;
    margin-top: 3px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }

  /* ── Confidence Bar ─────────────────── */
  .confidence-section {
    background: rgba(255,255,255,0.03);
    border-radius: 12px;
    padding: 12px 14px;
    border: 1px solid rgba(255,255,255,0.05);
  }

  .conf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .conf-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.5;
  }

  .conf-value {
    font-size: 12px;
    font-weight: 700;
    color: #FFB347;
  }

  .conf-track {
    height: 6px;
    background: rgba(255,255,255,0.06);
    border-radius: 3px;
    overflow: hidden;
  }

  .conf-fill {
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg, #FFB347, #FF6B8A);
    transition: width 0.6s ease;
  }

  .lines-info {
    text-align: center;
    font-size: 10px;
    opacity: 0.4;
    margin-top: 10px;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="32" cy="22" rx="18" ry="14" fill="#FF8FA3"/>
      <ellipse cx="24" cy="18" rx="10" ry="10" fill="#FFD6E0"/>
      <ellipse cx="40" cy="18" rx="10" ry="10" fill="#A7F3D0"/>
      <ellipse cx="32" cy="14" rx="8" ry="8" fill="#FDE68A"/>
      <path d="M18 28 L32 58 L46 28" fill="#F4D29C" stroke="#D4A574" stroke-width="1.5"/>
      <path d="M18 28 L32 58 L46 28" fill="url(#cone)" stroke="none"/>
      <defs>
        <linearGradient id="cone" x1="32" y1="28" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F4D29C"/>
          <stop offset="100%" stop-color="#D4A574"/>
        </linearGradient>
      </defs>
      <line x1="22" y1="34" x2="42" y2="42" stroke="#D4A574" stroke-width="0.8" opacity="0.5"/>
      <line x1="42" y1="34" x2="22" y2="42" stroke="#D4A574" stroke-width="0.8" opacity="0.5"/>
      <circle cx="28" cy="12" r="2" fill="#FF6B8A" opacity="0.7"/>
      <circle cx="38" cy="10" r="1.5" fill="#6EE7B7" opacity="0.7"/>
      <circle cx="33" cy="8" r="1" fill="#FCD34D" opacity="0.8"/>
    </svg>
    <div class="header-text">
      <h2>Code Crawler</h2>
    </div>
  </div>
  <div class="file-name">${fileName}</div>

  <!-- Donut Chart -->
  <div class="chart-wrap">
    <div class="donut">
      <div class="donut-hole">
        <div class="donut-icon">🍦</div>
        <div class="donut-pct">${aiPctNum > 50 ? aiPct : humanPct}%</div>
        <div class="donut-sub">${aiPctNum > 50 ? 'AI' : 'Human'}</div>
      </div>
    </div>
  </div>

  <!-- Stat Scoops -->
  <div class="scoops">
    <div class="scoop scoop-ai">
      <div class="scoop-emoji">🍓</div>
      <div class="scoop-value ai">${aiPct}%</div>
      <div class="scoop-label">AI · ${aiLines} lines</div>
    </div>
    <div class="scoop scoop-human">
      <div class="scoop-emoji">🍨</div>
      <div class="scoop-value human">${humanPct}%</div>
      <div class="scoop-label">Human · ${humanLines} lines</div>
    </div>
  </div>

  <!-- Confidence Bar -->
  <div class="confidence-section">
    <div class="conf-header">
      <span class="conf-label">Confidence</span>
      <span class="conf-value">${confidence}%</span>
    </div>
    <div class="conf-track">
      <div class="conf-fill" style="width: ${confidence}%;"></div>
    </div>
  </div>

  <div class="lines-info">🍦 ${totalLines} lines analyzed</div>

</body>
</html>`;
  }
}
