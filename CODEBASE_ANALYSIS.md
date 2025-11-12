# CODEBASE ANALYSIS
*Generated: 2025-11-10*

## Project Overview
This is an NBA Commentary Companion application built with Next.js that integrates multiple data sources through MCP (Model Context Protocol) aggregation.

---

## 1. ROUTING SYSTEM

**Type**: **App Router** (Next.js 13+)

**Evidence**:
- `/app` directory with `page.tsx`, `layout.tsx`, and `globals.css`
- `/pages` directory also exists (hybrid setup for API routes and test pages)
- `pages/api/` contains API route handlers
- `pages/test.tsx` and `pages/sentiment-test.tsx` are legacy test pages

**Directory Structure**:
```
app/
├── page.tsx              # Homepage (renders ChatContainer)
├── layout.tsx            # Root layout with metadata
├── globals.css           # Global styles
└── favicon.ico

pages/
├── api/                  # API routes (hybrid pattern)
│   └── mcp/
│       ├── query.ts
│       └── health.ts
├── test.tsx              # MCP test page
└── sentiment-test.tsx    # Sentiment test page
```

**Key Insight**: The app uses App Router for main application pages but maintains the Pages Router for API routes and test utilities.

---

## 2. STYLING APPROACH

**Primary**: **Tailwind CSS v4**

**Supporting Libraries**:
- `clsx` - Conditional class composition
- `tailwind-merge` - Merge Tailwind classes intelligently
- Utility function: `cn()` in `/lib/utils.ts`

**Color Scheme**:
```css
/* Primary Colors */
- Background: Gradient from slate-900 → blue-900 → slate-900
- Accents: Blue (400-600), Indigo (400-600), Cyan (300)
- Text: White primary, Blue-100/200/300 for headings
- Borders: Blue-400/20 (semi-transparent)

/* Slate Scale (Extended) */
slate-50:  #f8fafc
slate-900: #0f172a
slate-950: #020617

/* Semantic Colors */
- Success: emerald-400
- Error: red-400/500
- Warning: yellow-500
- Info: blue-300
```

**Design Pattern**: **Glassmorphism**
- Heavy use of `backdrop-blur-md`
- Semi-transparent backgrounds with `/10`, `/20`, `/30`, `/40` opacity
- Gradient overlays with `from-{color}/10 to-{color}/10`
- Animated pulse effects with gradient orbs

**Typography**:
- Font: Inter (from Google Fonts)
- Font variable: `--font-inter`
- Sizes: text-xs (12px), text-sm (14px), text-base (16px), text-lg, text-3xl, text-4xl
- Weights: font-medium, font-bold, font-black (900)

**Spacing System**:
- Padding: p-2, p-3, p-4, p-6, p-8
- Margin: mb-2, mb-3, mb-6, mb-8
- Gap: gap-2, gap-3, space-y-1, space-y-2, space-y-6
- Max-width containers: max-w-4xl, max-w-6xl

**Scrollbar Styling**:
```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); }
::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.3); border-radius: 4px; }
```

---

## 3. COMPONENT PATTERNS

**Architecture**: **Functional Components with Hooks**

**Component Organization**:
```
components/
├── ChatContainer.tsx      # Main chat UI container
├── ChatInput.tsx          # Message input field
├── LoadingIndicator.tsx   # Loading spinner
├── MessageBubble.tsx      # Individual message display
├── MCPQueryTest.tsx       # MCP testing interface
└── SentimentTester.tsx    # Sentiment analysis tester
```

**Custom Hooks**:
```
hooks/
└── useChat.ts            # WebSocket chat connection management
```

**Libraries & Utilities**:
```
lib/
├── api.ts                # API client helpers
├── types.ts              # TypeScript type definitions
├── utils.ts              # Utility functions (cn, formatTime, generateId)
└── llm-summarizer.ts     # LLM summarization logic
```

**Component Patterns**:
1. **'use client' directive** - All interactive components are client components
2. **Composition over inheritance** - Small, focused components
3. **Custom hooks for logic** - `useChat` for WebSocket management
4. **Props drilling** - Callbacks passed down (onSend, disabled, etc.)
5. **Conditional rendering** - Extensive use of `&&`, ternary operators, and `cn()` for dynamic classes

**Example Pattern (Card/Tile)**:
```tsx
<button className="group relative p-4 rounded-lg border border-blue-400/30
  hover:border-blue-400/60 bg-gradient-to-br from-blue-500/10 to-indigo-500/10
  hover:from-blue-500/20 hover:to-indigo-500/20 backdrop-blur-md
  transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
  overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0
    to-cyan-500/0 group-hover:from-blue-500/10 group-hover:to-cyan-500/10
    transition-all" />
  <div className="relative">
    <div className="text-2xl mb-1">{icon}</div>
    <div className="text-xs font-bold text-white">{text}</div>
  </div>
</button>
```

---

## 4. HOMEPAGE STRUCTURE

**File**: `/app/page.tsx`

**Content**: Renders a single `<ChatContainer />` component

**ChatContainer Features**:
1. **Header Section**:
   - Basketball emoji + gradient title
   - Connection status indicator (animated pulse dot)
   - Glassmorphic backdrop blur design

2. **Empty State** (No messages):
   - Floating animated basketball icon (spinning gradient ring)
   - Welcome message with gradient text
   - 4 Quick Action Tiles in 2x2 grid:
     - 📊 Top Scorers
     - 🎮 Live Games
     - ⚖️ Compare
     - 🔮 Predict
   - Info card with tips

3. **Chat Messages Area**:
   - Scrollable message list
   - Message bubbles with streaming support
   - Loading indicator
   - Error display

4. **Input Area**:
   - Chat input component
   - Connection warning (if disconnected)
   - Clear conversation button

---

## 5. EXISTING TILE/CARD COMPONENTS

### Quick Action Tiles (ChatContainer.tsx:94-114)
**Structure**:
```tsx
{[
  { icon: '📊', text: 'Top Scorers', query: 'Show me the top 10 scorers this season' },
  { icon: '🎮', text: 'Live Games', query: 'What games are happening today?' },
  { icon: '⚖️', text: 'Compare', query: 'Compare Nikola Jokić vs LeBron James 2024-25 season' },
  { icon: '🔮', text: 'Predict', query: 'Predict the Lakers vs Celtics game outcome' },
].map((btn, i) => (
  <button key={i} onClick={() => sendMessage(btn.query)} disabled={!isConnected}
    className="group relative p-4 rounded-lg border border-blue-400/30
    hover:border-blue-400/60 bg-gradient-to-br from-blue-500/10 to-indigo-500/10
    hover:from-blue-500/20 hover:to-indigo-500/20 backdrop-blur-md
    transition-all duration-300 disabled:opacity-50">
    {/* Hover gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0
      to-cyan-500/0 group-hover:from-blue-500/10 group-hover:to-cyan-500/10" />

    {/* Content */}
    <div className="relative">
      <div className="text-2xl mb-1">{btn.icon}</div>
      <div className="text-xs font-bold text-white">{btn.text}</div>
    </div>
  </button>
))}
```

**Design Features**:
- Semi-transparent gradient backgrounds
- Hover state animations
- Group hover effects for nested elements
- Disabled state styling
- Backdrop blur effect
- 2x2 Grid layout with `grid-cols-2 gap-3`

### Info Card (ChatContainer.tsx:117-121)
**Structure**:
```tsx
<div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10
  backdrop-blur-md border border-blue-400/20 rounded-lg p-4 text-left">
  <p className="text-xs text-gray-300">
    <span className="font-bold text-blue-300">💡 Tips:</span>
    Ask about player performance, game predictions...
  </p>
</div>
```

### Server Status Cards (MCPQueryTest.tsx:98-127)
**Structure**:
```tsx
<div className="border border-gray-200 rounded-lg p-3">
  <div className="font-semibold mb-2 flex items-center gap-2">
    <span>Elastic Agent Builder</span>
    <span className="text-xs text-gray-500">
      {connected ? '✅ Connected' : '❌ Disconnected'}
    </span>
  </div>
  <div className="space-y-2">
    {tools.map((tool) => (
      <div key={tool.name}
        className="bg-white border border-gray-100 rounded p-2 text-xs">
        <div className="font-mono font-semibold text-blue-600">{tool.name}</div>
        <div className="text-gray-600 mt-1">{tool.description}</div>
      </div>
    ))}
  </div>
</div>
```

---

## 6. ANIMATION PATTERNS

**Used Animations**:
```css
animate-pulse     /* Pulsing opacity */
animate-spin      /* Rotation */
animate-bounce    /* Bouncing motion */
```

**Custom Animation Timings**:
- `transition-all duration-300` - Most hover effects
- `animationDuration: '3s'` - Slow spinning elements
- Smooth scroll behavior enabled globally

**Background Animations**:
```tsx
<div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20
  rounded-full blur-3xl animate-pulse" />
<div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/20
  rounded-full blur-3xl animate-pulse" />
```

---

## 7. STATE MANAGEMENT

**Approach**: **React Hooks (useState, useEffect, useRef)**

**No global state management** (Redux, Zustand, Context API for app-wide state)

**Custom Hook Pattern** (`useChat.ts`):
- Manages WebSocket connection
- Tracks messages, loading state, errors
- Exposes `sendMessage`, `clearChat` functions
- Connection status management

---

## 8. API INTEGRATION

**Backend**: WebSocket server on port 3001 (in `/nba-backend`)

**REST APIs**:
- `/api/mcp/query` (POST) - Execute MCP query
- `/api/mcp/health` (GET) - Health check

**Libraries**:
- `axios` - HTTP client
- `ws` - WebSocket client
- `react-markdown` - Markdown rendering

---

## 9. KEY DEPENDENCIES

**Production**:
```json
{
  "@anthropic-ai/sdk": "^0.68.0",      // Claude AI SDK
  "axios": "^1.6.7",                    // HTTP client
  "class-variance-authority": "^0.7.1", // CVA for variants
  "clsx": "^2.1.1",                     // Class composition
  "next": "^16.0.1",                    // Next.js framework
  "react": "^19.0.0",                   // React 19
  "react-markdown": "^10.1.0",          // Markdown rendering
  "tailwind-merge": "^2.6.0",           // Tailwind merging
  "ws": "^8.16.0"                       // WebSocket
}
```

**Dev Dependencies**:
```json
{
  "tailwindcss": "^4.1.16",             // Tailwind v4
  "typescript": "^5",                   // TypeScript
  "babel-plugin-react-compiler": "1.0.0" // React Compiler
}
```

---

## 10. FILE STRUCTURE SUMMARY

```
nba-commentary-web/
├── app/                          # App Router pages
│   ├── page.tsx                  # Homepage → ChatContainer
│   ├── layout.tsx                # Root layout with Inter font
│   └── globals.css               # Global styles + markdown styling
│
├── pages/                        # Pages Router (hybrid)
│   ├── api/mcp/                  # API routes
│   ├── test.tsx                  # MCP test page
│   └── sentiment-test.tsx        # Sentiment test page
│
├── components/                   # React components
│   ├── ChatContainer.tsx         # Main chat UI (quick action tiles)
│   ├── ChatInput.tsx             # Input field
│   ├── MessageBubble.tsx         # Message display
│   ├── MCPQueryTest.tsx          # Testing interface (server cards)
│   ├── LoadingIndicator.tsx      # Loading spinner
│   └── SentimentTester.tsx       # Sentiment tester
│
├── hooks/                        # Custom React hooks
│   └── useChat.ts                # WebSocket chat hook
│
├── lib/                          # Utilities and types
│   ├── utils.ts                  # cn(), formatTime(), generateId()
│   ├── types.ts                  # TypeScript definitions
│   ├── api.ts                    # API helpers
│   └── llm-summarizer.ts         # LLM summarization
│
├── public/                       # Static assets
├── nba-backend/                  # WebSocket backend server
└── tailwind.config.js            # Tailwind configuration
```

---

## 11. CARD/TILE DESIGN SYSTEM

### Design Tokens for Cards

**Border**:
- Default: `border border-blue-400/30`
- Hover: `hover:border-blue-400/60`
- Alternative: `border-gray-200` (light theme)

**Background Gradients**:
- Primary: `bg-gradient-to-br from-blue-500/10 to-indigo-500/10`
- Hover: `hover:from-blue-500/20 hover:to-indigo-500/20`
- Alternative: `from-red-500/20 to-orange-500/20` (error state)

**Effects**:
- Blur: `backdrop-blur-md`
- Shadow: `shadow-lg`, `shadow-2xl`
- Rounded: `rounded-lg` (8px)
- Transitions: `transition-all duration-300`

**Hover Overlays**:
```tsx
<div className="absolute inset-0 bg-gradient-to-r from-blue-500/0
  to-cyan-500/0 group-hover:from-blue-500/10 group-hover:to-cyan-500/10
  transition-all" />
```

**Content Layout**:
- Relative positioning for content: `relative`
- Padding: `p-4` or `p-3`
- Icon size: `text-2xl` (emoji) or `text-4xl` (large icons)
- Text size: `text-xs` or `text-sm`
- Text weight: `font-bold` or `font-semibold`

---

## 12. MARKDOWN RENDERING

**Library**: `react-markdown`

**Custom Styling** (in `globals.css`):
- Prose class applied with custom styles
- Headings: Blue gradient colors (h1: blue-300, h2: blue-200, h3: blue-100)
- Code blocks: Black background with blue-300 text
- Tables: Full-width with gray borders
- Blockquotes: Blue left border with italic text

---

## 13. RESPONSIVE DESIGN

**Containers**:
- `max-w-4xl` for test pages
- `max-w-6xl` for main chat
- `mx-auto` for centering

**Grid Layouts**:
- Quick actions: `grid grid-cols-2 gap-3`
- Mobile-first approach (no explicit breakpoints in reviewed code)

---

## 14. ACCESSIBILITY CONSIDERATIONS

- Semantic HTML elements (`button`, `input`, etc.)
- Disabled states: `disabled:opacity-50 disabled:cursor-not-allowed`
- ARIA attributes: Not extensively used (opportunity for improvement)
- Color contrast: Strong contrast with white text on dark backgrounds
- Focus states: Implicit via Tailwind (could be enhanced)

---

## 15. RECOMMENDATIONS FOR NEW FEATURES

### When Adding Tiles/Cards:

1. **Follow the Glassmorphism Pattern**:
   - Use `backdrop-blur-md`
   - Semi-transparent backgrounds (`/10`, `/20`, `/40`)
   - Blue/Indigo gradient combinations

2. **Use the Group Hover Pattern**:
   ```tsx
   <div className="group relative">
     <div className="absolute inset-0 ... group-hover:..." />
     <div className="relative">{content}</div>
   </div>
   ```

3. **Maintain Consistent Spacing**:
   - Use `p-4` or `p-6` for card padding
   - Use `gap-3` or `gap-6` for grid spacing
   - Use `space-y-2` or `space-y-4` for vertical stacking

4. **Color Palette**:
   - Stick to blue-400/500/600 and indigo-400/500/600
   - Use cyan-300 for accents
   - Use emerald-400 for success states
   - Use red-400/500 for errors

5. **Typography**:
   - Use `text-xs` or `text-sm` for card content
   - Use `font-bold` or `font-black` for emphasis
   - Use Inter font (already configured)

6. **Animations**:
   - Add `transition-all duration-300` for smooth interactions
   - Use `animate-pulse` for loading/attention states
   - Consider `group-hover:scale-105` for lift effect

---

## ✅ SUCCESS CRITERIA MET

✅ **Routing System**: App Router (Next.js 13+) with hybrid Pages Router for API routes
✅ **Styling Approach**: Tailwind CSS v4 with glassmorphism design pattern
✅ **Homepage File**: `/app/page.tsx` (renders ChatContainer)
✅ **Existing Tiles/Cards**: Quick action buttons (2x2 grid), info cards, and server status cards
✅ **Component Pattern**: Functional components with hooks, custom `useChat` hook for state management

---

## NEXT STEPS

To add new tiles or cards to the homepage or other pages:

1. Create a new component file in `/components`
2. Follow the glassmorphism design pattern with backdrop-blur and gradients
3. Use the `cn()` utility from `/lib/utils.ts` for conditional classes
4. Add hover effects using the `group` pattern
5. Ensure responsive design with Tailwind grid/flex utilities
6. Test with both connected and disconnected states (if applicable)
7. Consider accessibility (disabled states, keyboard navigation)

**Example Starting Template**:
```tsx
'use client';

export default function MyTileComponent() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.id}
          className="group relative p-4 rounded-lg border border-blue-400/30
          hover:border-blue-400/60 bg-gradient-to-br from-blue-500/10
          to-indigo-500/10 hover:from-blue-500/20 hover:to-indigo-500/20
          backdrop-blur-md transition-all duration-300 cursor-pointer">

          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0
            to-cyan-500/0 group-hover:from-blue-500/10
            group-hover:to-cyan-500/10 transition-all" />

          <div className="relative">
            <div className="text-2xl mb-2">{item.icon}</div>
            <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
            <p className="text-xs text-gray-300">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

**End of Analysis**
