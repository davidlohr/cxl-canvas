# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static web application for designing CXL (Compute Express Link) topologies and generating QEMU commands. The application is a single-file HTML document with embedded CSS and JavaScript that creates an interactive visual editor for CXL hierarchies.

## Architecture

**Single-page application structure:**
- **Frontend**: Pure HTML/CSS/JavaScript with no build process
- **Dependencies**: All external dependencies loaded via CDN:
  - Tailwind CSS for styling
  - html2canvas for image export functionality
  - Inter font from Google Fonts
- **Deployment**: Static hosting (currently deployed to GitHub Pages)

**Core Components:**
- **Canvas System**: Drag-and-drop interface for placing and connecting CXL components
- **Component Types**: Host bridges, root ports, switches, Type2/Type3 devices, memory windows
- **Connection System**: Visual connections between components with validation rules
- **Properties Panel**: Dynamic form for editing component properties
- **QEMU Generator**: Real-time generation of QEMU command line arguments

**State Management:**
- All application state stored in JavaScript variables (components array, connections array)
- No external state management library
- Component properties stored as object properties with type-specific defaults

## Development Commands

**No build process required** - this is a static HTML file that can be opened directly in a browser.

**Local development:**
```bash
# Simple local server for development
python -m http.server 8000
# or
npx serve .
# or use the test server
npm run serve
```

**Testing:**
```bash
# Install dependencies first
npm install

# Run validation tests (fast, recommended)
npm test

# Run realistic test suite (comprehensive application testing)
npm run test:realistic

# Run full test suite with HTML reports
npm run test:full -- --report

# Run tests with visible browser (for debugging)
npm run test:realistic -- --no-headless

# Watch mode for development
npm run test:watch

# Validate QEMU syntax only
npm run validate-qemu

# Check browser compatibility
npm run test:browser-compat

# Lint JavaScript for compatibility issues
npm run lint
```

**Test Structure:**
- `tests/` - All test files and utilities
- `tests/test-scenarios.js` - Comprehensive test scenarios covering various CXL topologies
- `tests/qemu-validator.js` - QEMU command syntax validation
- `tests/cxl-test-runner.js` - Puppeteer-based browser automation
- `tests/run-tests.js` - Main test orchestrator with reporting
- `tests/browser-compatibility-test.js` - Cross-browser compatibility testing
- `tests/js-compatibility-check.js` - JavaScript compatibility analysis
- `.browserslistrc` - Target browser support definitions

## Key Implementation Details

**Component Creation:**
- Each component type has specific default properties and QEMU ID generation
- Components are positioned absolutely on canvas with 144px x 144px dimensions
- Port positioning calculated dynamically based on component type and port count

**Connection Validation:**
- Enforces CXL topology rules (host → rootport → switch/device)
- Prevents invalid connections (e.g., device-to-device)
- Upstream ports can only have one connection, downstream ports are source-only

**QEMU Command Generation:**
- Processes components in topological order to ensure proper bus references
- Handles different memory types (volatile, persistent, DCD)
- Generates appropriate object and device arguments based on component configuration

**Canvas Management:**
- Auto-resizing canvas based on component positions
- SVG overlay for connection lines with real-time updates during drag operations
- Selection system supports both single-click and box selection

## Important Patterns

- **Component State**: Each component stores its complete configuration as object properties
- **Event Handling**: Uses event delegation and careful event propagation control
- **Rendering**: Full re-render approach with requestAnimationFrame for connection updates
- **Property Updates**: Properties panel dynamically generates forms based on component type

## File Structure

```
/
├── index.html          # Complete application (HTML + CSS + JS)
├── README.md          # Project description and demo link
└── CLAUDE.md          # This file
```

All application logic, styling, and markup is contained within the single `index.html` file for maximum portability and simple deployment.