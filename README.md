# Trihedron Crystal

A scroll-driven 3D story about Trihedron, built around the logo as a glass crystal.

## Run it

- **Visual Studio:** open `Trihedron Crystal.sln` and press **Ctrl+F5**. It opens http://localhost:8090.
- **Without Visual Studio:**

  ```
  powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8090 -Open
  ```

It uses port 8090, so it can run at the same time as the main website (8080).

## The story (one screen per chapter)

| # | Chapter | What the 3D does |
| --- | --- | --- |
| 0 | Intro | Plates fly in and assemble into the logo; the core pops in |
| 1 | Three facets | The crystal opens; labels pin to Metrology, Automation, Artisans and People first |
| 2 | Global footprint | Floating dust morphs into a dotted globe (real land outlines) around a shrunken crystal: 7 regions, HQ in Gqeberha, animated placement arcs |
| 3 | Track record | Counters (40+ / 9 / 6) and the ZEISS testimonial; crystal half-open to the side |
| 4 | Solutions | Consulting, Permanent Placements, In-house Support, Website Development |
| 5 | Contact | Crystal spins back to centre; call-to-action buttons |

## Interactions

| Do this | Effect |
| --- | --- |
| Scroll, or click the dots on the right | Move through the chapters |
| Hover a facet | It nudges out, glows and shows its label |
| Click a facet / Enter | Opens its panel: focus areas, the director(s) who lead it (with photos), a link to the live site. The facet slides forward and the others dim |
| Esc / × | Close the panel |
| Drag | Rotate the crystal, with momentum and a spring back |
| Mouse move | Camera parallax and a cursor-following light |

## Editing content

Everything is in `js/scene.js`, near the top:

- `FACET_INFO`: facet panel text, people and links.
- `CHAPTERS`: per-chapter 3D state (how open the crystal is, its position and size, how much of the globe shows, rotation).
- `REGIONS` / `HQ`: globe markers.

Chapter text is in `index.html`. Links point to the live site (`https://www.trihedron.co.za/...`).

For future features, there's a small script API: `window.trihedron.openFacet('left')`, `.closeFacet()` and `.goToChapter(2)`.

## Under the hood

- **Rendering:** Three.js r170 with a custom studio environment for reflections.
- **Glass:** physical glass with transmission, dispersion, attenuation, iridescence and clearcoat.
- **Post-processing:** bloom, chromatic aberration, vignette and film grain.
- **Floor:** glossy grid with a mirrored reflection and a contact shadow.
- **Particles:** a GPU shader morphs 3,200 dust particles into the globe. Land outlines come from world-atlas via d3-geo, falling back to a plain sphere if offline.
- **Phones:** the 3D sits above the text cards, with a lower pixel ratio, no MSAA, no floor reflection and fewer particles.
- **Accessibility:** reduced-motion users get no intro, no idle motion and instant transitions. Falls back to the flat logo without WebGL.
