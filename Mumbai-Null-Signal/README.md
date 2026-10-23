# Mumbai: Null Signal

**A solo 3D puzzle escape through a Mumbai caught in a reality glitch.**

A rain-darkened local station, the Haji Ali causeway, the lanes of Dharavi, and the Bandra–Worli Sea Link have slipped out of time. Restore the signal fragments, learn how each anomaly works, and find a way home.

## Play

The game is a static browser project. On Windows, double-click `Start Game.cmd` to start a local server and open the game. Keep the small server window open while playing. Don’t open `index.html` directly: browsers block the 3D modules on `file://` pages.

If you prefer to start the server yourself, run this from this folder:

    python -m http.server 8000

Then open http://localhost:8000. The 3D engine and post-processing modules load from jsDelivr, so an internet connection is needed.

To publish with GitHub Pages, place the contents of this folder at the repository root or in docs/, then select that location in the repository's Pages settings. The game itself needs no build step.

## Controls

### Desktop

- **W A S D** or arrow keys — move
- **Mouse** — look around
- **Space** — jump
- **E** — enter the signal gate
- **F** — freeze or release time
- **G** — reverse or restore gravity
- **Q** — switch between the solid city and Echo
- **P** or **Esc** — pause
- **R** — restart the chapter
- **Enter** or **Space** — advance a story scene
- **Esc** — skip the current story scene

Only the anomalies introduced in a chapter are available. The final chapter combines them. Each route now layers short-window pulse gates with staggered barricades, moving trains, gravity-only roof machinery or Echo-only crossings. Read the warning lamps, plan your jump, and choose when to use each anomaly; a hit costs one sync pip and sends you back to a safe approach. The later routes deliberately combine mechanics, so expect to retry and refine your timing.

### Touch

Use the on-screen directional pad and action buttons. Drag on the open part of the screen to look around. The **SHIFT** button activates the chapter's main anomaly; in the final chapter, repeated presses cycle through time, gravity, and Echo.

## The four chapters

1. **Dadar Station — The Stopped Minute.** Chain three jumps, read two pulsing arcs and freeze the passing local at the tracks.
2. **Haji Ali Causeway — Up Is Down.** Reverse gravity across the flooded break, weave around three roof machines, then survive a timed gate and barricade sequence on the far side.
3. **Dharavi — The Missing Quarter.** Enter Echo before the missing lane, collect its fragment between two short pulse windows, and jump the far-side barricades.
4. **Bandra–Worli Sea Link — The Last Loop.** Combine all anomalies through a moving local, a flooded roof route, multiple tight pulse windows and an Echo crossing.

Each chapter asks you to restore three signal fragments. Collecting fragments also restores sync. The exit gate opens when all three are found. After every chapter, Mira recovers a handwritten note from Dev with a clue for the next route. The final note leads into the ending, then a dedicated Congratulations / You Won screen celebrates the escape.

## Story cutscenes

Animated, illustrated cutscenes open the story, bridge the chapters, and close the escape. Mira Deshmukh is shown only in these videos: a 29-year-old Mumbai signal engineer with warm brown skin, cropped dark curls, a rust monsoon shell with cyan reflective bands, a field radio and her father's old steel watch. Her father Dev is a greying railway motorman in a weathered navy uniform marked DEV-01. The playable game stays first person throughout. Captions identify every speaker. Browser speech synthesis voices read each caption aloud, with different delivery for Mira, Dev and the archive narrator; the voice button turns narration on or off. Voices depend on the language packs available in the browser. The pause control or **P** pauses both captions and narration, while **Enter**, **Space**, or the on-screen button advances. Press **Esc** or choose **Skip Video** to skip a scene. In Chapter 4, a distant Dev appears inside the Sea Link loop; stabilize its three anchors and reach the gate to free him. The reunion plays before the final handwritten note, followed by a dawn epilogue and a dedicated victory screen. Story progress is saved with chapter progress, so continuing after a cleared chapter still shows its unseen interlude.
## Sound and visuals

The monsoon ambience, low musical drone, pickup tones, anomaly shifts, impacts, and footsteps are synthesized in the browser with Web Audio. No audio files are required. The title image is a generated game key-art asset; game environments are assembled from textured 3D geometry, dynamic lighting, rain, fog, reflective surfaces, and bloom.

## Project notes

- Plain HTML, CSS, and JavaScript modules; no bundler or build command.
- Three.js 0.165.0 and its post-processing modules are loaded from jsDelivr.
- Designed for desktop browsers and landscape mobile screens.
- Progress is saved in the browser's local storage.
- The project is structured so it can be wrapped in Capacitor later if a native Android package is needed.

