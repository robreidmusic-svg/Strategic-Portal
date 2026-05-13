# Archival Handcrafted Design System

## Core Philosophy
The portal should feel like a **Strategic Archive**—a physical vault of technical and commercial intelligence. It avoids the neon "AI-glow" in favor of textures and materials that feel permanent, deliberate, and high-precision.

## 1. Typography
- **Headings**: `Fraunces` (Soft Serif) - Elegant, authoritative, and handcrafted.
- **UI/Labels**: `Outfit` (Geometric Sans) - Clean, modern, highly legible.
- **Technical/Data**: `JetBrains Mono` (Monospace) - Precision, authenticity, developer-grade.

## 2. Color Palette (The Archival Suite)
| Token | Hex | Usage |
| :--- | :--- | :--- |
| **Canvas** | `#FCFBF9` | Main background (Soft paper texture). |
| **Ink** | `#1A1A1A` | Primary text and dark UI elements. |
| **Parchment** | `#F5F2EA` | Secondary backgrounds and cards. |
| **Terracotta** | `#D67B1B` | Primary accent (Broggo branding). |
| **Sage** | `#A3B18A` | Success states and active markers. |
| **Oxide** | `#7B8C7C` | Muted utility text. |

## 3. UI Components & Borders
- **Hairlines**: Use `0.5px` border width with `#E5E0D8` for a "paper-thin" look.
- **Stitched Dividers**: Use `border-dashed` or `border-dotted` with low opacity to separate sections without creating "boxes".
- **Layered Depth**: Avoid heavy box-shadows. Use a 1px shadow offset with 2px blur: `shadow-[1px_1px_2px_rgba(0,0,0,0.05)]`.

## 4. Iconography
- **Composition**: Avoid standalone icons. Use "Icon Stacks"—an icon within a specific geometric frame (square with rounded corner, or double-outline).
- **Stroke**: Consistently use `1.5px` stroke width.

## 5. Textures
- **Grain**: Add a subtle `grain-overlay` to paper-based cards.
- **Rule Lines**: Use thin horizontal lines in the background of long reports to simulate ledger paper.
