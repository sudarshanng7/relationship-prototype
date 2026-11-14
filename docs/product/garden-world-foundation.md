# Living 2.5D Garden World Foundation (Phase 1)

This architecture note documents the bounded, renderer-independent foundation for Purple Garden's future living 2.5D Garden and ecosystem, implemented on `feature/next-development`.

---

## 1. Architectural Overview & Boundaries

The foundation introduces a clean pipeline separating business care data from procedural generation, 2.5D world representation, camera projection, and presentation rendering:

```
[Authoritative Care Events & Growth Units]
                   │
                   ▼ (Pure Deterministic Generator)
       [GeneratedGardenSVGScene]
                   │
                   ▼ (Adapter / Model Normalizer)
           [GardenWorld Model]
           ├── Stable Nodes Hierarchy
           ├── Semantic Earned Feature Groups
           ├── Depth Layer Ordering (2.5D)
           └── Living Ecosystem State (Habitats & Fauna)
                   │
                   ▼ (Pure Projection / Camera Engine)
         [Screen Space / Hit Regions]
                   │
                   ▼ (Current Renderer)
           [GardenVisualizer (SVG)]
```

### Strict Architectural Boundaries
- **No Database / RPC / Schema Changes:** Operates on existing authorized care snapshots and growth units.
- **Pure Data Types:** The world model contains zero React components, JSX, platform image handles, or database clients.
- **Zero Privacy Disclosure:** Contains zero raw reflections, moment notes, partner names, or personal identities.
- **Ecological Neutrality:** Wildlife represents a hospitable temperate habitat—never relationship scores, streaks, or judgment.

---

## 2. Coordinate and Layer Conventions

### World Coordinates
- **Logical Bounds:** $X \in [0, 800]$, $Y \in [0, 500]$. Ground baseline rests at $Y \approx 440$.
- **Camera2D:** `{ target: { x, y }, zoom: number }`.
- **Viewport:** `{ width, height }`.
- **Projection Invariant:** `screenToWorld(worldToScreen(P))` equals $P$ within float precision.

### 2.5D Depth Ordering
Explicit integer depth layers define the layering order independent of SVG document ordering:

| Depth Layer | Category | Elements |
| :--- | :--- | :--- |
| **-100** | Sky & Atmosphere | Sky gradient, celestial orb |
| **-80 to -30** | Landscape & Meadow | Distant hills (-80), rear grass (-60), mid grass (-40), front grass (-30) |
| **-20 to -15** | Ground Bed & Substrate | Soil bed (-20), root shadows (-18), pre-tree embedded stones & soil flecks (-15) |
| **-10 to -2** | Ground Habitat | Moss bed (-10), deep root shelter (-2) |
| **-5 to 0** | Tree Core | Roots (-5), trunk base & flare (0) |
| **+10 to +15** | Companion Flora & Landmarks | Moss, clover, ferns, meadow flowers (+10), landmarks (+15) |
| **+20** | Structural Branches | Primary and secondary branches |
| **+25** | Canopy Habitat | Branch perches, canopy shelter |
| **+30 to +40** | Foliage & Shoots | Pointed foliage clusters (+30), canopy shoots, buds, berries (+40) |
| **+50** | Blossoms & Pods | Reconnection blossoms, seed pods |
| **+60 to +65** | Living Fauna | Visiting butterflies (+60), songbirds (+62), resting creatures (+65) |
| **+90** | Temporary Feedback | Reveal halo aura during story playback |

---

## 3. Identity and Attachment Contract

### Collision-Safe Semantic Identity
Current procedural feature IDs (`care-${kind}-${hash}`) are preserved for 100% backward compatibility. In addition, every earned node and group stores a collision-safe canonical identity:

- **Canonical Node IDs:** `earned:${kind}:${eventId}` (e.g., `earned:reconnection:uuid-1234`).
- **Child Primitives:** Multi-element child primitives use structured delimiter-safe keys: `earned:${kind}:${eventId}::child::${suffix}` (e.g., `earned:positive_moment:uuid-5678::child::leaf-0`).
- **Structural Node IDs:** Decorative and architectural nodes use `structural:${role}:${id}` (e.g., `structural:trunk:tree-trunk`).

### Zero Map Overwriting & Legacy Mapping
To guarantee that hash collisions in legacy 32-bit hashes never cause silent node overwriting:
- Primary dictionary `world.nodes` is keyed by canonical IDs.
- `world.renderIdToNodeIds` maps legacy visual IDs (e.g., `care-reconnection-3f4a`) to an array of matching canonical node IDs.
- Two events with identical legacy visual hash or prefix exist simultaneously and independently in `world.nodes`, resolving to their exact distinct source events.

### Delimiter-Safe Child Grouping
Child matching requires exact delimiter boundaries:
- Matches exact target: `candidateId === targetId`
- Matches structured child: `candidateId.startsWith(`${targetId}::child::`)`
- Matches legacy child components: `candidateId.startsWith(`${targetId}-`)` where the remainder specifies a structural component (`floret`, `leaf`, `bud`, `shoot`, `berry`, `stem`, `grain`, `petal`, `sub`).
- **Invariant:** Unrestricted substring matching is prohibited; `ev-1` cannot match `ev-10` or `ev-100`.

### One Event, One Semantic Group
One shared care event may produce multiple visual child elements (e.g., a paired shoot produces a stem path, two leaf blades, and two leaf veins). All visual child nodes reference the parent event and group into one `EarnedFeatureGroup`.

### Pure Event Resolvers
- `resolveEventFromNode(nodeId, world)`: Returns the authoritative `{ kind, id, semanticKey, timestamp }`. Returns `null` for decorative stones, trunk, or background flora. Supports canonical IDs, semantic keys, and legacy render IDs via `renderIdToNodeIds`.
- `resolveNodesForEvent(sourceKind, sourceId, world)`: Returns all child botanical nodes created by an event.

---

## 4. Universal Highlight Coverage & Path Bounds Precision

### Contract A: Approximate Visual Bounds
`resolveFeatureBoundsFromScene` and `resolveFeatureBoundsFromWorld` compute conservative visual bounding boxes across **all** primitive families:
- Blossoms (`cx, cy, r`)
- Foliage clusters and path-based leaves (`createPointedLeafD`)
- Canopy details (`leaves`, `buds`, `berries`, `stemPath`)
- Seed pods (`cx, cy, rx, ry`)
- Ground flora (`petals`, `stemPath`, `leafPaths`, `florets`, `seedGrains`, `d`)
- Habitat details (`cx, cy, scale`, `stemPath`)
- Multi-element child groups

**SVG Path Bounds Evaluator:**
`computeApproximatePathBounds` tokenizes SVG path strings into commands and numeric arguments (supporting absolute `M, L, H, V, C, S, Q, T, A, Z`, relative `m, l, h, v, c, s, q, t, a, z`, scientific notation, negative decimals, and stroke width expansion).

**Honest Precision Boundary:**
- The algorithm tracks the **convex hull of Bézier control points** and **arc bounding boxes**. Because Bézier curves are variation-diminishing and strictly contained within the convex hull of their control points, this guarantees conservative visual bounds enclosing all curve extrema.
- The algorithm does **not** numerically solve cubic inflection roots or compute exact pixel rasters. Therefore, these bounds are documented as **approximate visual bounds**, suitable for reveal halo placement and camera framing.
- Precise interactive selection must not rely on reverse-parsed SVG path geometry; it relies on the authored **Semantic Hit-Region Contract**.

### Highlight Properties:
- **Temporary:** Exists only during reveal playback.
- **Suppressed Outside Playback:** Renders zero halo during normal live garden viewing.
- **Reduced Motion:** Halo is omitted when system reduced-motion is enabled.

---

## 4b. Semantic Hit-Region Contract

To provide reliable, accessible interaction without depending on reverse-parsed visual geometry, the foundation defines the **Semantic Hit-Region Contract** (`calculateSemanticHitRegions`):

### Separation of Concerns
1. **Render Bounds:** Raw visual coordinates in the SVG scene graph.
2. **Highlight Bounds:** Conservative enclosing visual halo box (`FeatureHighlightResult`).
3. **Interactive Hit Regions:** Screen-space targets with accessibility guarantees and priority ordering (`SemanticHitRegion`).

### Accessibility Target Sizing
- Touch targets on mobile must meet accessibility standards: $\text{width} \ge 44\text{ pt}$ and $\text{height} \ge 44\text{ pt}$ (iOS HIG / Android Material guidelines).
- Interaction bounds expand symmetrically around the node's anchor point to guarantee a touchable area even for tiny buds, florets, or thin stems.

### Deterministic Depth and Priority Ordering
When botanical elements overlap on screen, selection resolves via deterministic ordering:
1. **Depth Layer (Descending):** Elements on higher 2.5D layers resolve before background layers.
2. **Interaction Priority (Descending):**
   - Earned memories (`priority: 100`): Highest interactive priority.
   - Wildlife creatures (`priority: 60`): Interactive when present.
   - Habitat anchors (`priority: 40`): Habitat inspection.
   - Tree limbs and trunk (`priority: 20`): Architectural framework.
   - Terrain hills and soil (`priority: 10`): Background canvas.
3. **Node ID (Ascending):** Stable lexicographical tie-breaker for identical depth and priority.

---

## 5. Living Ecosystem Foundation (Fauna & Habitat)

### Node Distinctions
1. **Flora Nodes:** Foliage, branches, flowers, moss, and roots.
2. **Habitat Nodes:** Canopy shelter, branch perch, nest site, hollow, root shelter, moss bed, pollinator patch, and stone shelter.
3. **Creature Nodes:** Temperate garden wildlife (European robin, goldfinch, peacock butterfly, bumblebee, hedgehog, ladybird).

A creature is an ecological occupant of a mature habitat—not an earned event trophy.

### Ecological Eligibility Invariants
- **Habitat Prerequisite:** A creature **cannot** exist without a compatible, established habitat node.
- **Deterministic Maturity:** Habitat availability is tied directly to botanical growth units:
  - $\ge 16$ units: Pollinator patches open for visiting butterflies and bees.
  - $\ge 36$ units: Branch perches establish for visiting songbirds.
  - $\ge 76$ units: Deep root shelters establish for resident woodland hedgehogs.
- **Couple Seed Selection:** The couple seed deterministically chooses species variants (e.g., Robin vs. Goldfinch). Both partners receive the identical ecosystem state.
- **Zero Runtime Randomness:** Zero `Math.random()` or device-local clocks.
- **Bounded Motion:** Movement bounds are strictly clamped within the parent habitat. Under reduced-motion settings, creatures return a peaceful still resting state.

### Rendered vs. Model-Only Ecosystem Status
To ensure full transparency between the current SVG scene output and the living world foundation:
- **Rendered in SVG Scene:** Structural habitat detail anchors (e.g., branch perches, moss patches, nest material tufts) are generated as visual SVG primitives in `GeneratedGardenSVGScene` and rendered in the DOM/SVG canvas.
- **Model-Only in World Foundation:** Living wildlife and creature nodes (`world.ecosystem.creatures`) are currently modeled in the headless 2.5D world graph (`GardenWorld.ecosystem`). The model fully computes species eligibility, habitat anchoring, movement bounding boxes, and reduced-motion resting states. Animated 2.5D sprite/quad rendering of fauna is designated for Phase 3/4 renderer implementation.
- **Privacy Guarantee:** Habitat derivation receives only total growth units, care growth units, and couple seed—never care event titles, private reflections, or partner identities. If a care event is removed or unshared, the event node is purged immediately and zero metadata is leaked via ecosystem state.

### Non-Judgmental Product Copy
Fauna copy describes ecological settling, not relationship scores:
- *Approved:* *"As the tree branched out and flowers blossomed, gentle songbirds and pollinators began to visit the garden."*
- *Prohibited:* *"You communicated well this week, so you earned a bird."*

---

## 6. Verification Standards & Visual Claim Honesty

To prevent inaccurate claims, all verification across the Garden World foundation adheres to strict definitions:

1. **Structural / Object Equality:**
   - *Verified:* Repeated generation with identical couple seed and care inputs produces byte-identical JSON serialized worlds (`JSON.stringify(world1) === JSON.stringify(world2)`), identical total node counts, identical acyclic parent-child trees, and identical finite coordinates.
2. **SVG Scene-Data Equality:**
   - *Verified:* Procedural SVG generation produces identical SVG element attributes, path strings, and anchor points across identical seeds and themes.
3. **Screenshot / Pixel Comparison:**
   - *Honest Status:* Golden screenshot comparisons and pixel-diffing are **not** performed in this unit testing pass. Different OS graphics drivers, font scalers, and Skia/Cairo rasterizers may anti-alias vector curves with minor sub-pixel variations.
4. **Manual Device Inspection:**
   - *Honest Status:* Pending UI mounting; interactive pan/zoom viewport mounting and gesture responders will undergo manual device inspection during Phase 3.
5. **No "Pixel-Identical" Claims:**
   - Claims of "pixel identical" rendering across devices, screen scales, or platforms are strictly avoided. All determinism claims refer to structural model and SVG scene data equality.

---

## 7. Known Legacy Continuity Gaps

1. **Morphological Stage Transitions:** The current procedural generator uses distinct mathematical models for early stages (`first_seedling`, `tender_sapling`, `branching_out`). Early seedling stems transition discretely rather than morphing continuous spline control points. This is explicitly tracked via `metadata.stageMappingGaps`.
2. **Snapshot Reconstruction vs. Audit Ledger:** The garden is reconstructed from currently qualified care events. If an event is deleted or made private, its botanical representation departs. Exact historical playback requires capturing snapshots at evaluation time.
3. **2.5D vs. True 3D:** This foundation provides layered depth, camera framing, hit-testing, and coordinate transformations in a 2.5D plane. Navigating in 3D (walking around or orbiting behind the trunk) requires full 3D polygon meshes and a 3D engine.

---

## 8. Asset Authoring Contract for Phase 2

For future painterly 2.5D assets:
- **Transparent Alpha:** Clean PNG/WebP cutouts with feathered natural contours.
- **Consistent Lighting:** Warm, high-overhead 11 o'clock diffuse daylight.
- **Layer Separation:** Trunks, primary limbs, secondary twigs, foliage clusters, and earned flowers must remain on separate transparent layers.
- **Attachment Anchors:** Every asset manifest must define `{ x, y }` attachment pivots and bounding boxes.
- **No Baked Memories:** Background trees must never have blossoms baked into the raster artwork.

---

## 9. Next Phase Roadmap

- **Phase 2:** Author painterly temperate botanical assets conforming to the `BotanicalAssetManifest` specification.
- **Phase 3:** Interactive pan/zoom camera controls with gesture smoothing.
- **Phase 4:** Node tap selection routing to authorized memory detail views with verified access re-check.
