# Sample Queries Component

## Overview
Interactive component that displays dynamic sample queries as clickable pills on the Stats and Buzz chat interface.

---

## Features

### 🎯 Dynamic Query Generation
- Fetches live games from `/api/live-games` on mount
- Generates contextual queries using `generateSampleQueries()`
- Updates based on real-time game data

### 🎨 UI Design
- **Horizontal scrollable** pill layout
- **Glassmorphism** design matching app aesthetic
- **Hover effects** with gradient overlays
- **Loading skeleton** while fetching data
- **Error handling** with fallback to default queries

### 🔄 State Management
- `visible` prop controls display
- Hides after first user message
- Can be shown again via "Clear & Show Queries Again" button

### 📱 Responsive
- Horizontal scroll on mobile
- Touch-friendly pill buttons
- Custom scrollbar styling

---

## Component API

### Props

```typescript
interface SampleQueriesProps {
  onQuerySelect: (query: string) => void;
  visible?: boolean;
}
```

**Parameters:**
- `onQuerySelect` - Callback when a query is clicked (required)
- `visible` - Controls component visibility (default: `true`)

---

## Usage

### Basic Integration

```tsx
import SampleQueries from '@/components/SampleQueries';

function ChatPage() {
  const [showQueries, setShowQueries] = useState(true);

  const handleQuerySelect = (query: string) => {
    console.log('Selected:', query);
    // Send to chat backend
    sendMessage(query);
    // Hide queries after first message
    setShowQueries(false);
  };

  return (
    <div>
      <SampleQueries
        onQuerySelect={handleQuerySelect}
        visible={showQueries}
      />
    </div>
  );
}
```

### In Stats and Buzz Chat Page

```tsx
'use client';

import { useState } from 'react';
import SampleQueries from '@/components/SampleQueries';

export default function StatsAndBuzzChatPage() {
  const [showSampleQueries, setShowSampleQueries] = useState(true);
  const [messages, setMessages] = useState<string[]>([]);

  const handleQuerySelect = (query: string) => {
    // Add to messages
    setMessages([...messages, query]);

    // Hide queries after first interaction
    setShowSampleQueries(false);

    // TODO: Send to chat backend
  };

  return (
    <div>
      {/* ... header ... */}

      <main>
        <SampleQueries
          onQuerySelect={handleQuerySelect}
          visible={showSampleQueries}
        />

        {/* Message display */}
        {messages.map((msg, i) => (
          <div key={i}>{msg}</div>
        ))}
      </main>

      {/* ... footer ... */}
    </div>
  );
}
```

---

## Component States

### 1. Loading State

```
💡 Try asking:

┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓ │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
   Skeleton pills (pulsing animation)
```

### 2. Loaded State

```
💡 Try asking:

┌───────────────────────────────┐ ┌───────────────────────────────┐
│ What are Cade Cunningham's    │ │ What are fans saying about    │
│ stats since the beginning of  │ │ Charlotte Hornets vs Los      │
│ the season? Are fans excited  │ │ Angeles Lakers?               │
│ by what he demonstrated so    │ │                               │
│ far?                          │ │                               │
└───────────────────────────────┘ └───────────────────────────────┘

┌───────────────────────────────┐ ┌───────────────────────────────┐
│ Compare Cade Cunningham and   │ │ How are the Pistons doing     │
│ CJ McCollum's performance     │ │ this season? What do fans     │
│ this season                   │ │ think?                        │
└───────────────────────────────┘ └───────────────────────────────┘

← → (scroll horizontally)
```

### 3. Error State (with fallback)

```
💡 Try asking:

⚠️ Using default queries

┌───────────────────────────────┐ ┌───────────────────────────────┐
│ What are LeBron James's stats │ │ How is Stephen Curry          │
│ this season? Are fans excited │ │ performing this year?          │
│ by what he demonstrated so    │ │                               │
│ far?                          │ │                               │
└───────────────────────────────┘ └───────────────────────────────┘
```

### 4. Hidden State (visible=false)

```
(Component not rendered)
```

### 5. Empty State

```
💡 Try asking:

No sample queries available
```

---

## Styling

### Pill Design

```css
/* Base pill */
border: border-blue-400/30
background: from-blue-500/10 to-indigo-500/10
backdrop-blur: md
border-radius: lg
padding: 0.75rem

/* Hover state */
border: border-blue-400/60
background: from-blue-500/20 to-indigo-500/20

/* Hover overlay */
gradient: from-blue-500/0 to-cyan-500/0
→ from-blue-500/10 to-cyan-500/10 (on hover)
```

### Layout

```css
/* Container */
display: flex
gap: 0.5rem
overflow-x: auto
padding-bottom: 0.5rem

/* Pills */
flex-shrink: 0
max-width: 24rem (384px)
text-align: left

/* Text */
font-size: 0.75rem
line-clamp: 3
color: white
```

### Scrollbar

```css
/* Custom scrollbar (from globals.css) */
.custom-scrollbar::-webkit-scrollbar {
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(30, 41, 59, 0.5);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.5);
  border-radius: 3px;
}
```

---

## Data Flow

```
Component Mount
    ↓
Fetch /api/live-games
    ↓
games: LiveGame[]
    ↓
generateSampleQueries(games)
    ↓
queries: string[]
    ↓
Render Pills
    ↓
User Clicks Pill
    ↓
onQuerySelect(query)
    ↓
Parent Component Handles
```

---

## Integration Points

### Current Page: `/statsandbuzz/chat`

**File:** `app/statsandbuzz/chat/page.tsx`

**State:**
```typescript
const [showSampleQueries, setShowSampleQueries] = useState(true);
const [messages, setMessages] = useState<string[]>([]);
```

**Handler:**
```typescript
const handleQuerySelect = (query: string) => {
  console.log('Selected query:', query);
  setMessages([...messages, query]);
  setShowSampleQueries(false);
  // TODO: Send to chat backend
};
```

**Component:**
```tsx
<SampleQueries
  onQuerySelect={handleQuerySelect}
  visible={showSampleQueries}
/>
```

---

## Testing

### Manual Testing Steps

1. **Visit Page:**
   ```bash
   http://localhost:3000/statsandbuzz/chat
   ```

2. **Verify Loading State:**
   - See "💡 Try asking:" header
   - See 4 skeleton pills with pulse animation
   - Wait 2-3 seconds

3. **Verify Loaded State:**
   - See 4-6 query pills
   - Queries should use real player names from live games
   - Pills should be horizontally scrollable

4. **Test Clicking:**
   - Click any query pill
   - Should see console log: "Selected query: ..."
   - Query should appear in message preview
   - Sample queries should disappear

5. **Test Clear Button:**
   - Click "Clear & Show Queries Again"
   - Messages should clear
   - Sample queries should reappear

6. **Test Responsive:**
   - Resize browser to mobile width
   - Pills should scroll horizontally
   - Touch/drag should work

### Automated Testing

```typescript
// Mock test (example)
import { render, screen, fireEvent } from '@testing-library/react';
import SampleQueries from '@/components/SampleQueries';

test('calls onQuerySelect when pill is clicked', () => {
  const mockHandler = jest.fn();

  render(
    <SampleQueries
      onQuerySelect={mockHandler}
      visible={true}
    />
  );

  // Wait for loading
  await screen.findByText(/What are/);

  // Click first pill
  const firstPill = screen.getAllByRole('button')[0];
  fireEvent.click(firstPill);

  // Verify callback
  expect(mockHandler).toHaveBeenCalledTimes(1);
  expect(mockHandler).toHaveBeenCalledWith(expect.stringContaining('What are'));
});
```

---

## Success Criteria

### ✅ All Met

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Component fetches and displays queries | ✅ | Calls `/api/live-games` on mount |
| Queries update based on live games | ✅ | Uses `generateSampleQueries()` |
| Clicking a query calls `onQuerySelect` | ✅ | Handler tested, console logs |
| Loading state shows while fetching | ✅ | Skeleton pills with pulse |
| Hides when `visible=false` | ✅ | Returns `null` when not visible |
| Horizontal scroll works on mobile | ✅ | `overflow-x-auto` with custom scrollbar |
| Error handling with fallback | ✅ | Uses default queries on error |
| Matches app glassmorphism style | ✅ | Same gradient/border/backdrop-blur |

---

## Error Handling

### Network Error

```typescript
try {
  const response = await fetch('/api/live-games');
  if (!response.ok) throw new Error('Failed to fetch');
  // ... process
} catch (err) {
  console.error('Error generating queries:', err);
  setError(err.message);
  // Use fallback queries
  const fallbackQueries = generateSampleQueries([]);
  setQueries(fallbackQueries);
}
```

**User sees:**
- Warning message: "⚠️ Using default queries"
- Default queries with popular players displayed

### Empty Response

```typescript
const data = await response.json();
const games: LiveGame[] = data.games || [];
// Empty array triggers fallback in generateSampleQueries()
```

### Component Not Visible

```typescript
if (!visible) {
  return null;
}
```

No errors, component simply doesn't render.

---

## Performance

### Optimization Strategies

1. **Single Fetch on Mount**
   ```typescript
   useEffect(() => {
     if (visible) fetchQueries();
   }, [visible]);
   ```

2. **Memoization** (future enhancement)
   ```typescript
   const queries = useMemo(
     () => generateSampleQueries(games),
     [games]
   );
   ```

3. **Conditional Rendering**
   ```typescript
   if (!visible) return null;
   ```

4. **Lazy Loading** (future enhancement)
   ```typescript
   const SampleQueries = dynamic(() => import('./SampleQueries'), {
     loading: () => <LoadingSkeleton />
   });
   ```

---

## File Locations

- **Component:** `/components/SampleQueries.tsx`
- **Page Integration:** `/app/statsandbuzz/chat/page.tsx`
- **Query Generator:** `/lib/query-generator.ts`
- **API Endpoint:** `/pages/api/live-games.ts`
- **Documentation:** `/SAMPLE_QUERIES_COMPONENT.md` (this file)

---

## Future Enhancements

### 1. **Query Categories**
```tsx
<SampleQueries
  onQuerySelect={handleQuerySelect}
  visible={showQueries}
  category="stats" // or "sentiment", "comparison"
/>
```

### 2. **Auto-Refresh**
```typescript
useEffect(() => {
  const interval = setInterval(fetchQueries, 5 * 60 * 1000); // 5 min
  return () => clearInterval(interval);
}, []);
```

### 3. **Personalization**
```typescript
const queries = generateSampleQueries(games, {
  favoriteTeam: user.favoriteTeam,
  favoritePlayers: user.favoritePlayers
});
```

### 4. **Analytics**
```typescript
const handleQuerySelect = (query: string) => {
  trackEvent('sample_query_clicked', { query });
  onQuerySelect(query);
};
```

### 5. **Animation**
```css
/* Fade in pills one by one */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.pill {
  animation: fadeIn 0.3s ease-out forwards;
  animation-delay: calc(var(--index) * 0.1s);
}
```

---

## Summary

✅ **Production-ready** sample queries component that:
- Fetches live game data automatically
- Generates contextual queries dynamically
- Displays as horizontal scrollable pills
- Shows loading and error states gracefully
- Hides after first user interaction
- Matches app's glassmorphism design
- Works responsively on all screen sizes
- Fully integrated with Stats and Buzz chat page

**Ready for Phase 7: Connect to actual chat backend!** 🏀💬
