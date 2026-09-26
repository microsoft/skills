---
description: Package generated wiki pages into a VitePress site with dark theme, dark-mode Mermaid diagrams, and click-to-zoom
---

# Deep Wiki: Build VitePress Site

Package the generated wiki markdown files into a complete VitePress site with a Daytona-inspired dark theme, dark-mode Mermaid diagrams, and click-to-zoom for diagrams and images.

## Prerequisites

The wiki markdown files should already exist (from `/deep-wiki:generate` or manual creation). This command scaffolds the VitePress project around them.

## Step 1: Scaffold VitePress Project

Create a `wiki/` directory with this structure:

```
wiki/
├── package.json
├── .gitignore
├── AGENTS.md                          # Agent instructions for wiki folder
├── CLAUDE.md                          # Companion pointer to AGENTS.md
├── index.md                          # Wiki home page (NOT a placeholder — see below)
├── llms.txt                          # LLM-friendly links + descriptions
├── llms-full.txt                     # LLM-friendly full inlined content
├── onboarding/                        # Audience-tailored onboarding guides
│   ├── index.md                       # Onboarding hub with guide selector
│   ├── contributor-guide.md           # For new contributors (assumes Python/JS)
│   ├── staff-engineer-guide.md        # For staff/principal engineers
│   ├── executive-guide.md             # For VP/director-level leaders
│   └── product-manager-guide.md       # For product managers
├── {NN}-{section-name}/              # Numbered section folders
│   ├── {page-name}.md
│   └── ...
├── .vitepress/
│   ├── config.mts                    # Full VitePress config
│   ├── public/
│   │   ├── logo.svg                  # Brand logo
│   │   ├── llms.txt                  # Served at /llms.txt on deployed site
│   │   └── llms-full.txt             # Served at /llms-full.txt on deployed site
│   └── theme/
│       ├── index.ts                  # Theme setup (zoom handlers)
│       └── custom.css                # Complete dark theme + Mermaid + zoom CSS
```

### index.md — Wiki Landing Page (CRITICAL)

The `index.md` MUST be a developer-focused wiki home page — **NOT a marketing landing page**. No `hero:` frontmatter blocks, no taglines, no call-to-action buttons. This is a technical wiki, not a product page.

Generate `index.md` with this structure:

```markdown
---
title: Project Name — Documentation
description: Technical documentation for Project Name
---

# Project Name

Brief 1–2 sentence description of what the project does technically.

## Quick Start

\`\`\`bash
# Clone, install, run (actual commands from the repo)
git clone <repo-url>
cd <repo>
npm install && npm run dev
\`\`\`

## Architecture Overview

\`\`\`mermaid
graph LR
  A[Component A] --> B[Component B]
  B --> C[Component C]
\`\`\`
<!-- Sources: src/app.ts:1, src/server.ts:1 -->

## Documentation Map

| Section | Description |
|---------|-------------|
| [Onboarding](./onboarding/) | Guides for contributors, staff engineers, executives, and PMs |
| [Getting Started](./01-getting-started/) | Setup, configuration, first steps |
| [Architecture](./02-architecture/) | System design, data flow, components |
| ... | ... |

## Key Files

| File | Purpose | Source |
|------|---------|--------|
| `src/main.ts` | Application entry point | [src/main.ts:1](REPO_URL/blob/BRANCH/src/main.ts#L1) |
| `src/config.ts` | Configuration loader | [src/config.ts:1](REPO_URL/blob/BRANCH/src/config.ts#L1) |
| ... | ... | ... |

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| TypeScript | Primary language |
| FastAPI | API framework |
| ... | ... |
```

**DO NOT include:**
- VitePress `hero:` frontmatter (no hero banners, no action buttons)
- Marketing copy ("powerful", "blazing fast", "enterprise-grade")
- Feature highlight cards or badges
- "Get Started" call-to-action buttons
- Any content that feels like a product landing page

**DO include:**
- Actual runnable commands in Quick Start
- Architecture diagram with source citations
- Documentation map table linking to all wiki sections
- Key files table with source citations
- Tech stack summary table

### package.json

```json
{
  "name": "wiki",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vitepress dev",
    "build": "vitepress build",
    "preview": "vitepress preview"
  },
  "devDependencies": {
    "medium-zoom": "^1.1.0",
    "mermaid": "^11.12.2",
    "vitepress": "^1.6.4",
    "vitepress-plugin-mermaid": "^2.0.17"
  }
}
```

### .gitignore

```
node_modules/
.vitepress/cache/
.vitepress/dist/
```

## Step 2: VitePress Config (config.mts)

The config MUST:
- Use `withMermaid()` wrapper from `vitepress-plugin-mermaid`
- Set `ignoreDeadLinks: true` (wiki pages reference internal source paths)
- Load Inter + JetBrains Mono fonts via head link
- Set `appearance: 'dark'` for dark-only mode
- Configure sidebar dynamically from generated section structure
- Include ONBOARDING section first (uncollapsed) with both guides
- Set `outline: { level: [2, 3] }`
- Enable `markdown: { lineNumbers: true }`
- Include `vite: { optimizeDeps: { include: ['mermaid'] } }`
- Set comprehensive Mermaid dark-mode `themeVariables`:

```typescript
mermaid: {
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: '#0d1117',
    primaryColor: '#2d333b',
    primaryTextColor: '#e6edf3',
    primaryBorderColor: '#6d5dfc',
    secondaryColor: '#1c2333',
    secondaryTextColor: '#e6edf3',
    secondaryBorderColor: '#6d5dfc',
    tertiaryColor: '#161b22',
    tertiaryTextColor: '#e6edf3',
    tertiaryBorderColor: '#30363d',
    lineColor: '#8b949e',
    textColor: '#e6edf3',
    mainBkg: '#2d333b',
    nodeBkg: '#2d333b',
    nodeBorder: '#6d5dfc',
    nodeTextColor: '#e6edf3',
    clusterBkg: '#161b22',
    clusterBorder: '#30363d',
    titleColor: '#e6edf3',
    edgeLabelBackground: '#1c2333',
    actorBkg: '#2d333b',
    actorTextColor: '#e6edf3',
    actorBorder: '#6d5dfc',
    actorLineColor: '#8b949e',
    signalColor: '#e6edf3',
    signalTextColor: '#e6edf3',
    labelBoxBkgColor: '#2d333b',
    labelBoxBorderColor: '#6d5dfc',
    labelTextColor: '#e6edf3',
    loopTextColor: '#e6edf3',
    activationBorderColor: '#6d5dfc',
    activationBkgColor: '#1c2333',
    sequenceNumberColor: '#e6edf3',
    noteBkgColor: '#2d333b',
    noteTextColor: '#e6edf3',
    noteBorderColor: '#6d5dfc',
    classText: '#e6edf3',
    labelColor: '#e6edf3',
    altBackground: '#161b22',
  },
},
```

### Dynamic Sidebar Generation

Scan the generated markdown files and build sidebar config:
- ONBOARDING section always first (uncollapsed) with four audience-tailored guides: Contributor, Staff Engineer, Executive, Product Manager
- Then numbered sections: `01-getting-started`, `02-architecture`, etc.
- Each section becomes a collapsible group
- First 3-4 sections uncollapsed, rest collapsed

## Step 3: Theme Setup (theme/index.ts)

Implement two zoom systems and a focus mode toggle:

### Image Zoom (medium-zoom)
```typescript
import mediumZoom from 'medium-zoom'
// Apply to all images: mediumZoom('.vp-doc img:not(.no-zoom)', { background: 'rgba(0, 0, 0, 0.92)' })
```

### Mermaid Diagram Zoom (custom SVG overlay — CRITICAL)

Mermaid renders `<svg>`, not `<img>`, so medium-zoom won't work. You MUST implement a custom fullscreen overlay. **This is the most common source of bugs — follow this implementation exactly.**

```typescript
// In setup() within enhanceApp or theme index.ts
import { onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import mediumZoom from 'medium-zoom'
import './custom.css'

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()

    const initZoom = () => {
      // Image zoom
      mediumZoom('.vp-doc img:not(.no-zoom)', {
        background: 'rgba(0, 0, 0, 0.92)',
      })

      // Mermaid diagram zoom — poll for async-rendered SVGs
      const attachMermaidZoom = (retries = 0) => {
        const diagrams = document.querySelectorAll('.mermaid')
        if (diagrams.length === 0 && retries < 20) {
          setTimeout(() => attachMermaidZoom(retries + 1), 500)
          return
        }

        diagrams.forEach((container) => {
          // Skip if already has zoom handler
          if (container.getAttribute('data-zoom-attached')) return
          container.setAttribute('data-zoom-attached', 'true')
          container.style.cursor = 'pointer'

          container.addEventListener('click', () => {
            const svg = container.querySelector('svg')
            if (!svg) return
            openDiagramModal(svg)
          })
        })
      }
      attachMermaidZoom()
    }

    const openDiagramModal = (svg: SVGSVGElement) => {
      // Create overlay
      const overlay = document.createElement('div')
      overlay.className = 'diagram-zoom-overlay'

      // Create container with controls
      const wrapper = document.createElement('div')
      wrapper.className = 'diagram-zoom-wrapper'

      // Controls bar
      const controls = document.createElement('div')
      controls.className = 'diagram-zoom-controls'
      controls.innerHTML = `
        <button class="zoom-btn" data-action="zoom-in" title="Zoom in (+)">+</button>
        <button class="zoom-btn" data-action="zoom-out" title="Zoom out (-)">−</button>
        <button class="zoom-btn" data-action="zoom-reset" title="Reset (0)">Reset</button>
        <button class="zoom-btn zoom-close" data-action="close" title="Close (Esc)">✕</button>
      `

      // Clone SVG into scrollable content area
      const content = document.createElement('div')
      content.className = 'diagram-zoom-content'
      const cloned = svg.cloneNode(true) as SVGSVGElement

      // Fix viewBox if missing
      if (!cloned.getAttribute('viewBox')) {
        const bbox = svg.getBBox()
        cloned.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)
      }
      cloned.style.width = '100%'
      cloned.style.height = 'auto'
      cloned.style.maxHeight = 'none'

      content.appendChild(cloned)
      wrapper.appendChild(controls)
      wrapper.appendChild(content)
      overlay.appendChild(wrapper)
      document.body.appendChild(overlay)
      document.body.style.overflow = 'hidden'

      // Zoom state
      let scale = 1
      let translateX = 0
      let translateY = 0
      const applyTransform = () => {
        content.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
      }

      // Control buttons
      controls.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).closest('[data-action]')?.getAttribute('data-action')
        if (action === 'zoom-in') { scale = Math.min(scale * 1.3, 5); applyTransform() }
        if (action === 'zoom-out') { scale = Math.max(scale / 1.3, 0.2); applyTransform() }
        if (action === 'zoom-reset') { scale = 1; translateX = 0; translateY = 0; applyTransform() }
        if (action === 'close') closeOverlay()
      })

      // Scroll wheel zoom
      overlay.addEventListener('wheel', (e) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? 0.9 : 1.1
        scale = Math.min(Math.max(scale * delta, 0.2), 5)
        applyTransform()
      }, { passive: false })

      // Pan with mouse drag
      let isPanning = false
      let startX = 0, startY = 0
      content.addEventListener('mousedown', (e) => {
        isPanning = true; startX = e.clientX - translateX; startY = e.clientY - translateY
        content.style.cursor = 'grabbing'
      })
      document.addEventListener('mousemove', (e) => {
        if (!isPanning) return
        translateX = e.clientX - startX; translateY = e.clientY - startY
        applyTransform()
      })
      document.addEventListener('mouseup', () => {
        isPanning = false; content.style.cursor = 'grab'
      })

      // Keyboard shortcuts
      const keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeOverlay()
        if (e.key === '+' || e.key === '=') { scale = Math.min(scale * 1.3, 5); applyTransform() }
        if (e.key === '-') { scale = Math.max(scale / 1.3, 0.2); applyTransform() }
        if (e.key === '0') { scale = 1; translateX = 0; translateY = 0; applyTransform() }
      }
      document.addEventListener('keydown', keyHandler)

      // Backdrop click to close
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeOverlay()
      })

      const closeOverlay = () => {
        document.removeEventListener('keydown', keyHandler)
        document.body.style.overflow = ''
        overlay.remove()
      }
    }

    onMounted(() => initZoom())
    watch(() => route.path, () => nextTick(() => initZoom()))
  },
}
```

**CRITICAL implementation notes:**
- Use `setup()` with `onMounted` + route watcher — NOT `enhanceApp()` (DOM doesn't exist during SSR)
- **Poll for Mermaid SVGs** with retry (up to 20 × 500ms) — `vitepress-plugin-mermaid` renders asynchronously, SVGs don't exist when `onMounted` fires
- **Clone the SVG** (don't move it) — moving it breaks the page layout
- **Fix missing viewBox** — compute from `getBBox()` so scaling works correctly
- **Mark containers** with `data-zoom-attached` to prevent duplicate handlers on route changes

### Focus Mode Toggle

Add a reading focus mode that hides sidebar and navbar for distraction-free reading:

```typescript
// Add this inside setup(), after initZoom
const initFocusMode = () => {
  // Don't add if already exists
  if (document.getElementById('focus-mode-toggle')) return

  const btn = document.createElement('button')
  btn.id = 'focus-mode-toggle'
  btn.className = 'focus-mode-btn'
  btn.title = 'Toggle focus mode (F)'
  btn.textContent = '👁'
  btn.addEventListener('click', toggleFocusMode)
  document.body.appendChild(btn)

  // Keyboard shortcut: F key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey
      && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
      e.preventDefault()
      toggleFocusMode()
    }
  })
}

const toggleFocusMode = () => {
  document.body.classList.toggle('focus-mode')
  const btn = document.getElementById('focus-mode-toggle')
  if (btn) btn.textContent = document.body.classList.contains('focus-mode') ? '👁‍🗨' : '👁'
}

onMounted(() => { initZoom(); initFocusMode() })
```

## Step 4: Dark Theme CSS (theme/custom.css)

### Typography
- `--vp-font-family-base: 'Inter'`
- `--vp-font-family-mono: 'JetBrains Mono'`

### Color Palette
| Element | Background | Border | Text |
|---------|-----------|--------|------|
| Page background | `#0d1117` | — | `#e6edf3` |
| Elevated surface | `#161b22` | `#30363d` | `#e6edf3` |
| Card/node | `#2d333b` | `#6d5dfc` | `#e6edf3` |
| Secondary surface | `#1c2333` | `#6d5dfc` | `#e6edf3` |
| Lines/arrows | — | `#8b949e` | — |
| Brand accent | — | `#6d5dfc` | — |
| Muted text | — | — | `#8b949e` |

### Required CSS Sections
1. Dark-mode VitePress variables (backgrounds, surfaces, text, brand, code blocks, scrollbar)
2. Layout — wider content area (`max-width: 820px`)
3. Navbar — border, background fixes
4. Sidebar — uppercase section titles, active item with left border accent
5. Content typography — h1-h3, p, li, strong sizing
6. Inline code — soft background, brand color text
7. Code blocks — dark background, rounded, language labels
8. Tables — alternating row colors, uppercase headers
9. Mermaid containers — centered, padded, bordered, dark background

### Mermaid Dark-Mode CSS Overrides (CRITICAL)

Theme variables don't cover everything. Force dark fills on all SVG shapes:

```css
.mermaid .node rect, .mermaid .node circle, .mermaid .node ellipse,
.mermaid .node polygon, .mermaid .node path, .mermaid .label-container {
  fill: #2d333b !important;
  stroke: #6d5dfc !important;
}
.mermaid .nodeLabel, .mermaid .node text, .mermaid text, .mermaid span {
  color: #e6edf3 !important;
  fill: #e6edf3 !important;
}
.mermaid .cluster rect { fill: #161b22 !important; stroke: #30363d !important; }
.mermaid .actor { fill: #2d333b !important; stroke: #6d5dfc !important; }
.mermaid .edgeLabel rect { fill: #1c2333 !important; }
.mermaid .flowchart-link, .mermaid .messageLine0, .mermaid .messageLine1, .mermaid line {
  stroke: #8b949e !important;
}
.mermaid marker path { fill: #8b949e !important; }
```

### Zoom CSS
- Mermaid hover hint: glow border + "🔍 Click to zoom" badge on hover
- Fullscreen overlay: backdrop blur, centered container, zoom controls, pan cursor
- Image hover: subtle glow + scale on hover
- medium-zoom overlay: dark background with blur

```css
/* === Mermaid Hover Hint === */
.mermaid {
  cursor: pointer;
  transition: box-shadow 0.2s ease;
  position: relative;
}
.mermaid:hover {
  box-shadow: 0 0 0 2px #6d5dfc40, 0 0 20px #6d5dfc20;
}
.mermaid::after {
  content: '🔍 Click to zoom';
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: #2d333b;
  color: #8b949e;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}
.mermaid:hover::after { opacity: 1; }

/* === Diagram Zoom Overlay === */
.diagram-zoom-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.diagram-zoom-wrapper {
  display: flex;
  flex-direction: column;
  width: 90vw;
  height: 90vh;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 12px;
  overflow: hidden;
}
.diagram-zoom-controls {
  position: relative;
  z-index: 10000;
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
}
.zoom-btn {
  background: #2d333b;
  color: #e6edf3;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 14px;
}
.zoom-btn:hover { background: #3d434b; border-color: #6d5dfc; }
.zoom-close { margin-left: auto; }
.diagram-zoom-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  transform-origin: center center;
}
.diagram-zoom-content svg { max-width: none; }

/* === Focus Mode Button === */
.focus-mode-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 100;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #2d333b;
  border: 1px solid #30363d;
  color: #e6edf3;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.focus-mode-btn:hover {
  background: #3d434b;
  border-color: #6d5dfc;
  transform: scale(1.1);
}

/* === Focus Mode Active State === */
.focus-mode .VPSidebar,
.focus-mode .VPNav,
.focus-mode .VPLocalNav,
.focus-mode .VPFooter,
.focus-mode .VPDocAside {
  display: none !important;
}
.focus-mode .VPDoc {
  padding: 0 !important;
}
.focus-mode .VPDoc .container {
  max-width: 900px !important;
  margin: 0 auto !important;
}
.focus-mode .vp-doc {
  padding: 40px 20px !important;
}
```

## Step 5: Post-Processing (Markdown Fixes)

Before building, fix common issues in generated markdown:

### Fix Mermaid Inline Styles
Scan for light-mode `style` directives in Mermaid blocks and replace with dark equivalents:
- `#e1f5ff` → `#1a3a4a`, `#e8f5e9` → `#1a3a20`, `#fff3e0` → `#3a3020`
- `#f3e5f5` → `#2a1a3a`, `#f5f5f5` → `#2d333b`, `#ffffff` → `#2d333b`
- Add `,color:#e6edf3` for text visibility

### Escape Generics Outside Code Fences
Wrap bare generics (`Task<string>`, `List<T>`) in backticks outside code fences. Vue's template compiler treats bare `<T>` as HTML tags.

### Fix `<br/>` in Mermaid
Replace `<br/>` with `<br>` in Mermaid blocks (self-closing tags cause Vue compilation errors).

### Validate Hex Colors
Check all hex colors in Mermaid blocks are valid (3 or 6 digits, not 4 or 5).

## Step 6: Build

```bash
cd wiki && npm install && npm run build
```

Output goes to `wiki/.vitepress/dist/`. For preview: `npm run preview`.

## Logo SVG

```svg
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="8" fill="#6d5dfc"/>
  <path d="M8 22V10l8-4 8 4v12l-8 4-8-4z" fill="#0d1117" fill-opacity="0.3"/>
  <path d="M16 6l8 4v12l-8 4-8-4V10l8-4z" stroke="white" stroke-width="1.5" fill="none"/>
  <circle cx="16" cy="14" r="3" fill="white"/>
  <path d="M12 20l4-3 4 3" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
</svg>
```

$ARGUMENTS
