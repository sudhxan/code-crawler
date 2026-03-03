# Code Crawler

Detect AI-written vs human-written code in your codebase.

Code Crawler analyzes code using multiple heuristics to estimate what percentage was written by AI tools (Copilot, Claude, Cursor, etc.) vs written by humans.

## How It Works

Code Crawler uses 5 detection heuristics:

| Heuristic | Weight | What it detects |
|-----------|--------|-----------------|
| **Naming** | 20% | Generic variable names (`data`, `result`, `item`) vs domain-specific names |
| **Comments** | 25% | Obvious "what" comments (AI) vs "why"/TODO comments (human) |
| **Structure** | 20% | Uniform function sizes and perfect formatting (AI) vs natural variation (human) |
| **Entropy** | 15% | Low token entropy (predictable AI patterns) vs high entropy (human variation) |
| **Git Signals** | 20% | Large single-commit additions, new files with complete code |

Each line gets an AI probability score (0-1), then results are aggregated per file.

## Usage

### CLI

```bash
npx code-crawler src/
npx code-crawler myfile.ts --json
```

### GitHub Action

Add to `.github/workflows/code-crawler.yml`:

```yaml
name: Code Crawler
on: [pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: sudhxan/code-crawler@main
        with:
          threshold: '0.5'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This will post a comment on PRs showing AI vs human code percentages.

### VS Code Extension

Install `code-crawler-vscode` from the marketplace. It highlights AI-detected lines in your editor with color-coded backgrounds and shows a sidebar with percentages.

## Supported Languages

TypeScript, JavaScript, Python, Ruby, Go, Rust, Java, C, C++, C#, PHP, Swift

## License

MIT
