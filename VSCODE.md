# Publishing Code Crawler to VS Code Marketplace

## Prerequisites

1. **Node.js** (v18+)
2. **vsce** - the VS Code Extension packaging tool:
   ```bash
   npm install -g @vscode/vsce
   ```
3. **Azure DevOps account** - required for publishing (free):
   - Go to https://dev.azure.com
   - Sign in with a Microsoft account
   - Create an organization if you don't have one

## Step 1: Create a Publisher

1. Go to https://marketplace.visualstudio.com/manage
2. Click "Create publisher"
3. Fill in:
   - **Publisher ID**: `sudhxan` (or your preferred ID)
   - **Display Name**: Your name
4. Click Create

## Step 2: Create a Personal Access Token (PAT)

1. Go to https://dev.azure.com
2. Click your profile icon (top right) → **Personal access tokens**
3. Click **New Token**
4. Configure:
   - **Name**: `vsce-publish`
   - **Organization**: Select "All accessible organizations"
   - **Expiration**: Set as needed
   - **Scopes**: Click "Custom defined", then find **Marketplace** → check **Manage**
5. Click Create and **copy the token immediately** (you won't see it again)

## Step 3: Prepare the Extension

```bash
cd extension/
```

### Update package.json

Your `extension/package.json` needs these fields:

```json
{
  "name": "code-crawler-vscode",
  "displayName": "Code Crawler - AI Code Detection",
  "description": "Detect AI-written vs human-written code in your editor",
  "version": "0.1.0",
  "publisher": "sudhxan",
  "repository": {
    "type": "git",
    "url": "https://github.com/sudhxan/code-crawler"
  },
  "engines": {
    "vscode": "^1.85.0"
  },
  "icon": "icon.png",
  "categories": ["Other", "Linters"],
  "keywords": ["ai", "detection", "code-analysis", "copilot", "cursor"]
}
```

### Add an icon

Create or add a 128x128 PNG at `extension/icon.png`.

### Bundle the extension

The extension needs to be self-contained (can't rely on `../../src/analyzer/`). You have two options:

**Option A: Copy analyzer into extension (simple)**
```bash
mkdir -p extension/src/analyzer
cp -r src/analyzer/* extension/src/analyzer/
```
Then update imports in extension source files from `../../src/analyzer/` to `./analyzer/`.

**Option B: Use esbuild to bundle (recommended for production)**

Install esbuild:
```bash
cd extension/
npm install --save-dev esbuild
```

Add to `extension/package.json` scripts:
```json
{
  "scripts": {
    "build": "esbuild src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --format=cjs --platform=node"
  }
}
```

Update `extension/package.json` main entry:
```json
{
  "main": "./dist/extension.js"
}
```

Then build:
```bash
npm run build
```

### Create .vscodeignore

Create `extension/.vscodeignore`:
```
src/
node_modules/
tsconfig.json
*.ts
!dist/**
```

## Step 4: Test Locally

Before publishing, test in VS Code:

```bash
cd extension/

# Package into a .vsix file
vsce package

# This creates code-crawler-vscode-0.1.0.vsix
```

Install it locally in VS Code:
1. Open VS Code
2. Press `Cmd+Shift+P` → "Extensions: Install from VSIX..."
3. Select the `.vsix` file
4. Reload VS Code
5. Open a code file and check if decorations appear

Or from terminal:
```bash
code --install-extension code-crawler-vscode-0.1.0.vsix
```

## Step 5: Publish

### Login with your PAT

```bash
vsce login sudhxan
# Paste your Personal Access Token when prompted
```

### Publish

```bash
cd extension/
vsce publish
```

That's it. Your extension will be live at:
`https://marketplace.visualstudio.com/items?itemName=sudhxan.code-crawler-vscode`

### Publishing updates

```bash
# Bump version and publish
vsce publish patch   # 0.1.0 → 0.1.1
vsce publish minor   # 0.1.0 → 0.2.0
vsce publish major   # 0.1.0 → 1.0.0
```

## Step 6: Automate with CI (Optional)

Add to `.github/workflows/publish-extension.yml`:

```yaml
name: Publish Extension
on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g @vscode/vsce
      - run: cd extension && npm install && npm run build
      - run: cd extension && vsce publish
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

Add your PAT as a GitHub secret named `VSCE_PAT` in your repo settings.

Then to publish a new version:
```bash
git tag v0.1.0
git push origin v0.1.0
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ERROR: Missing publisher name` | Add `"publisher": "sudhxan"` to package.json |
| `ERROR: Make sure to edit the README.md` | Add a real README.md in the extension/ folder |
| `ERROR: Missing repository` | Add `"repository"` field to package.json |
| PAT expired | Create a new one at https://dev.azure.com |
| Extension doesn't activate | Check `activationEvents` in package.json matches your file types |
| Imports broken after bundling | Make sure esbuild bundles everything except `vscode` |

## Useful Links

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Manifest (package.json)](https://code.visualstudio.com/api/references/extension-manifest)
- [vsce CLI reference](https://github.com/microsoft/vscode-vsce)
