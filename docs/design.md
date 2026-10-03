# Classy — UI Style Tile & Visual Identity Prompt

## Prompt

Create a polished, minimal **UI Style Tile and complete visual identity** for **Classy**, a modern educational platform serving students, teachers, and super administrators. The deliverable is a visual design-system overview, not a full product screen or a working interface. Show the visual language and representative components together in one carefully composed, presentation-ready style tile.

### Brand identity

Position Classy as clear, trustworthy, focused, and approachable. Its identity should feel professional enough for educators and administrators, while remaining welcoming and easy for students to use. Use a restrained **Blue + White + Slate** palette, generous whitespace, crisp typography, and simple geometric forms. Keep the design minimal and practical: avoid visual clutter, decorative gradients, excessive animation cues, playful childish motifs, and unnecessary ornament. Use blue purposefully for emphasis, navigation selection, actions, links, progress, and focus.

The brand name is **Classy**. Create a simple wordmark treatment and, if useful, a compact abstract mark suggesting learning, clarity, or progress. Keep the mark geometric, legible at small sizes, and independent of any specific school subject. Do not invent a slogan.

### Color system

Show labeled swatches with exact HEX values. Use these as the canonical palette and preserve their roles:

**Light Mode — default**
- Primary Blue: `#2563EB`
- Primary Blue Hover / Dark: `#1D4ED8`
- Page Background: `#FFFFFF`
- Secondary Background / Subtle Surface: `#F8FAFC`
- Card Surface: `#FFFFFF`
- Main Text: `#0F172A`
- Secondary Text: `#64748B`
- Borders and Dividers: `#E2E8F0`
- Success: `#16A34A`
- Warning: `#F59E0B`
- Error: `#DC2626`

**Dark Mode — optional alternative theme**
- Page Background: `#0F172A`
- Secondary Background: `#111827`
- Card Surface: `#1E293B`
- Main Text: `#F8FAFC`
- Secondary Text: `#94A3B8`
- Borders and Dividers: `#334155`
- Primary Blue: `#3B82F6`

Use semantic colors consistently and pair them with readable labels or icons, not color alone. Maintain strong text contrast. Do not add extra accent colors unless they are essential to the success, warning, or error semantics above.

### Typography

Use a modern, highly legible sans-serif family suitable for education software, such as **Inter** (or a visually similar neutral sans-serif if unavailable). Present a clear type scale with examples:
- Display / page title: bold, compact, confident
- Section heading: semibold
- Card or component title: medium or semibold
- Body text: regular, comfortable line height
- Labels, helper text, and metadata: smaller but still readable

Show a short sample headline, body paragraph, label, and numeric metric. Use consistent weights and avoid overly condensed, decorative, or extra-light styles. Ensure the system can support both Latin and Arabic text; show a brief Arabic sample such as **التعلّم بوضوح** with correct right-to-left shaping if the rendering tool supports Arabic.

### Layout and visual foundations

Use a spacing scale based on **4 px increments** (4, 8, 12, 16, 24, 32, 48, 64 px). Show a small spacing specimen or labeled scale. Favor open layouts and clear grouping; align components to a consistent grid. Keep comfortable internal padding in cards and controls.

Use subtle, consistent borders in `#E2E8F0` for Light Mode and `#334155` for Dark Mode. Prefer thin borders over heavy outlines. Use a restrained radius scale: **4 px** for compact controls, **8 px** for standard buttons and inputs, **12 px** for cards and larger panels, and **16 px** only for prominent containers. Avoid pill shapes except for small status badges where appropriate.

Shadows should be soft and rare: a subtle low-elevation shadow may distinguish a floating menu or raised card, but most surfaces should rely on whitespace and borders. Do not use dramatic drop shadows or glowing effects.

### Component specimens

Show realistic, consistently styled examples of each component, with concise labels and enough variation to communicate the system:

- **Buttons:** primary filled blue, secondary neutral, outlined, text/quiet, and disabled. Include default, hover, focus, pressed, and loading examples where space permits. Use clear labels such as “Create course” and “View details.”
- **Inputs:** text field, search field, select/dropdown, and a field with helper text. Include default, focused, filled, error, and disabled states. Use visible labels and a clear focus ring.
- **Cards:** a course card, a compact statistic card, and a simple content/list card. Keep hierarchy obvious through typography and spacing rather than decoration.
- **Badges and status:** neutral, in-progress, complete/success, attention/warning, and error. Use compact shapes, restrained fills, and readable text.
- **Icons:** use one consistent family of simple outline icons with consistent stroke weight, such as Lucide-style icons. Show a small sample set for home, courses, calendar, messages, settings, search, notifications, and user profile. Avoid mixing icon styles or using icons as decoration without meaning.
- **Progress:** a thin, clear progress bar with a percentage or completion label; show an accessible contrast between track and fill.
- **Navigation:** a compact sidebar or top navigation sample showing the Classy mark, a few destinations, selected state, notification indicator, and profile area. Make the active state recognizable through blue plus a secondary cue such as a light background or indicator bar.
- **Dashboard components:** representative course progress, upcoming lesson or task, a small activity/list row, and summary metrics. Keep charts simple and readable; use blue as the primary data color and avoid needless dashboard density.
- **Feedback states:** empty, success, warning, error, and loading examples. Keep messages concise, helpful, and paired with an appropriate icon when useful.

### Light and Dark Mode presentation

Make **Light Mode the primary and visually dominant presentation**, with a white page background and white cards. Include a smaller, clearly labeled **Dark Mode** preview or paired component strip to demonstrate how the same foundations adapt to the optional dark theme. Preserve hierarchy, semantic colors, readable contrast, and component behavior across both modes. Do not make Dark Mode look like a separate brand.

### Style Tile composition and order

Arrange the tile as a clean, editorial design-system board on a neutral canvas. Keep the board itself spacious, aligned, and easy to scan. Use a clear title at the top: **“Classy — UI Style Tile”**, with a small descriptor **“Minimal Educational Platform”**. Organize content into a deliberate visual sequence:

1. Brand wordmark and a one-line identity description.
2. Light Mode palette as the main color section, followed by the smaller Dark Mode palette.
3. Typography scale and Latin/Arabic text samples.
4. Spacing, border, radius, and shadow tokens.
5. Button and input specimens with state variations.
6. Cards, badges, progress, and icon samples.
7. Navigation and representative dashboard components.
8. A compact feedback-state row and a small Dark Mode component preview.

Use a grid with consistent alignment and section labels. Keep component examples large enough to judge their visual treatment. Give each swatch and component a short, readable label. Maintain a strong hierarchy between the board title, section headings, component names, and annotations. The final result should feel like a cohesive, practical UI identity reference that a product team could use to build Classy consistently.

### Output constraints

Produce **one high-quality UI Style Tile / design-system presentation board**, not a finished dashboard, website, app flow, or collection of unrelated mockups. Show the specified color values and component states accurately. Do not replace the system with a moodboard, stock imagery, 3D objects, or decorative illustrations. Keep the final visual minimal, precise, readable, and implementation-friendly.
