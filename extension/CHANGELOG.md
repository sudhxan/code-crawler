# Changelog

## [0.1.0] - 2026-03-03

### Added
- Real-time keystroke tracking to distinguish AI-generated from human-written code
- 11-signal detection engine (typing rhythm, cursor movement, edit velocity, undo/redo patterns, paste detection, and more)
- Line-level color-coded decorations: red (AI), green (human), yellow (mixed)
- Confidence-based opacity: high (>80%), medium (50-80%), low (<50%)
- Hover tooltips showing authorship confidence and dominant detection signal
- Status bar indicator showing AI vs Human percentages
- Sidebar panel with pie chart visualization
- `Code Crawler: Show Report` command for full workspace analysis
- `Code Crawler: Reset Tracking` command to clear all tracking data
- Persistent authorship data saved per-workspace in `.code-crawler/` directory
- Configurable AI detection threshold and decoration toggle
