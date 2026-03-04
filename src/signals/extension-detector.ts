const AI_EXTENSION_PATTERNS = [
  'github.copilot', 'continue.continue', 'cursor.',
  'saoudrizwan.claude-dev', 'cline.', 'codeium.',
  'tabnine.', 'amazonq.', 'sourcegraph.cody',
  'windsurf.', 'aider.', 'supermaven.',
];

export interface ExtensionActivity {
  extensionId: string;
  commandId: string;
  timestamp: number;
}

export class ExtensionDetector {
  private recentCommands: ExtensionActivity[] = [];

  recordCommand(extensionId: string, commandId: string, timestamp: number): void {
    const isAi = AI_EXTENSION_PATTERNS.some(
      p => extensionId.startsWith(p) || commandId.startsWith(p)
    );
    if (isAi) {
      this.recentCommands.push({ extensionId, commandId, timestamp });
      if (this.recentCommands.length > 50) this.recentCommands.shift();
    }
  }

  wasAiCommandRecent(editTimestamp: number, withinMs = 1000): boolean {
    return this.recentCommands.some(
      c => Math.abs(c.timestamp - editTimestamp) < withinMs
    );
  }

  getScore(editTimestamp: number): number {
    if (this.wasAiCommandRecent(editTimestamp, 500)) return 0.95;
    if (this.wasAiCommandRecent(editTimestamp, 2000)) return 0.75;
    return 0.5;
  }

  reset(): void { this.recentCommands = []; }
}
