import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { AudioEngine } from "./audio.js";
import { LEVELS } from "./levels.js";
import { CHAPTER_NOTES, STORY_SCENES } from "./story.js";
import { buildWorld, WORLD_BOUNDS } from "./world.js";

const $ = (id) => document.getElementById(id);
const canvas = $("world");
const audio = new AudioEngine();
const titleScreen = $("title-screen");
const briefingScreen = $("briefing-screen");
const pauseScreen = $("pause-screen");
const clearScreen = $("chapter-clear-screen");
const winScreen = $("win-screen");
const cutsceneScreen = $("cutscene-screen");
const hud = $("hud");
const mobileControls = $("mobile-controls");
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

let renderer;
let composer;
let scene;
let camera;
let levelRoot;
let world;
let rain;
let mode = "title";
let levelIndex = 0;
let elapsed = 0;
let levelStartTime = 0;
let lastTime = performance.now();
let toastTimer = 0;
let hitCooldown = 0;
let footstepTimer = 0;
let gravityResetTimer = 0;
let desktopPointerActive = false;
let mouseLookPointer = null;
let lastTouchLook = null;
let heldTouchAction = "";
let finalMechanicCursor = 0;
let soundOn = true;
let currentStory = null;
let currentStoryKey = "";
let storyBeatIndex = 0;
let storyCompleteCallback = null;
let storyPlaying = true;
let storyRemaining = 0;
let storyDuration = 0;
let storyVoiceEnabled = true;
let storyVoiceActive = false;
let storyVoiceFinishedWhilePaused = false;
let storySpeechToken = 0;
let storySpeechVoices = [];

const state = {
  x: 0,
  y: 1.65,
  z: 13,
  vy: 0,
  yaw: 0,
  pitch: 0,
  grounded: true,
  gravityDir: -1,
  phase: "solid",
  timeFrozen: false,
  shards: 0,
  health: 3,
  movement: { forward: false, back: false, left: false, right: false },
  jumpPressed: false,
  interactPressed: false,
  mechanicPressed: false,
  restartPressed: false,
  totalSeconds: 0
};
const keys = new Set();

function initRenderer() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      depth: true,
      stencil: false
    });
  } catch (error) {
    $("load-error").classList.remove("hidden");
    console.error(error);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouchDevice ? 1.55 : 1.85));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.useLegacyLights = false;

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.background = new THREE.Color(0x08141c);
  scene.fog = new THREE.FogExp2(0x101b27, 0.015);
  camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 170);
  camera.rotation.order = "YXZ";

  const hemisphere = new THREE.HemisphereLight(0xa5ccd1, 0x11171a, 1.45);
  scene.add(hemisphere);
  const moon = new THREE.DirectionalLight(0xa8d5e0, 2.2);
  moon.position.set(-14, 22, 8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1536, 1536);
  moon.shadow.camera.left = -22;
  moon.shadow.camera.right = 22;
  moon.shadow.camera.top = 23;
  moon.shadow.camera.bottom = -23;
  moon.shadow.camera.near = 0.1;
  moon.shadow.camera.far = 55;
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.025;
  scene.add(moon);

  const warmFill = new THREE.PointLight(0xffa86e, 5.1, 39, 2);
  warmFill.position.set(-3.5, 5.7, 4.5);
  scene.add(warmFill);
  const cyanFill = new THREE.PointLight(0x70e9d3, 4.1, 44, 2);
  cyanFill.position.set(4.7, 4.3, -18);
  scene.add(cyanFill);
  const distantFill = new THREE.PointLight(0x5998d8, 2.6, 60, 2);
  distantFill.position.set(0, 7.5, -46);
  scene.add(distantFill);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.56, 0.42, 0.78);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(renderer.getPixelRatio());
}

function createRain() {
  const count = isTouchDevice ? 280 : 480;
  const positions = new Float32Array(count * 6);
  const sizes = new Float32Array(count);
  const rainRandom = (seed) => {
    let x = seed;
    return () => {
      x = (x * 16807) % 2147483647;
      return (x - 1) / 2147483646;
    };
  };
  const random = rainRandom(8127);
  for (let i = 0; i < count; i++) {
    const x = (random() - 0.5) * 25;
    const y = 2 + random() * 17;
    const z = -42 + random() * 54;
    positions[i * 6] = x;
    positions[i * 6 + 1] = y;
    positions[i * 6 + 2] = z;
    positions[i * 6 + 3] = x - 0.08;
    positions[i * 6 + 4] = y - 0.62;
    positions[i * 6 + 5] = z + 0.04;
    sizes[i] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xa9d6de, transparent: true, opacity: 0.27, depthWrite: false });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  scene.add(lines);
  return {
    lines,
    positions,
    count,
    update(dt) {
      for (let i = 0; i < count; i++) {
        const n = i * 6;
        positions[n + 1] -= dt * (12 + sizes[i] * 8);
        positions[n + 4] -= dt * (12 + sizes[i] * 8);
        positions[n + 2] += dt * 1.4;
        positions[n + 5] += dt * 1.4;
        if (positions[n + 1] < -1 || positions[n + 2] > state.z + 8) {
          positions[n] = state.x + (Math.random() - 0.5) * 25;
          positions[n + 1] = 10 + Math.random() * 11;
          positions[n + 2] = state.z - 32 - Math.random() * 12;
          positions[n + 3] = positions[n] - 0.08;
          positions[n + 4] = positions[n + 1] - 0.62;
          positions[n + 5] = positions[n + 2] + 0.04;
        }
      }
      geometry.attributes.position.needsUpdate = true;
    }
  };
}

function initWorld(index) {
  if (levelRoot) {
    scene.remove(levelRoot);
    levelRoot.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material.map) material.map.dispose();
          material.dispose();
        });
      }
    });
  }
  levelRoot = new THREE.Group();
  levelRoot.name = "chapter-" + (index + 1);
  scene.add(levelRoot);
  world = buildWorld(levelRoot, index);
  const palette = world.palette;
  scene.background.setHex(palette.sky);
  scene.fog.color.setHex(palette.fog);
  scene.fog.density = index === 2 ? 0.018 : 0.014;
  audio.setLevel(index);
  if (rain) {
    scene.remove(rain.lines);
    rain.lines.geometry.dispose();
    rain.lines.material.dispose();
  }
  rain = createRain();
  updateChapterUI();
}

function updateChapterUI() {
  const level = LEVELS[levelIndex];
  $("hud-chapter").textContent = String(level.id).padStart(2, "0");
  $("hud-location").textContent = level.location;
  $("hud-subtitle").textContent = level.subtitle;
  $("briefing-kicker").textContent = "CHAPTER " + String(level.id).padStart(2, "0") + "  /  04";
  $("briefing-title").textContent = level.title;
  $("briefing-copy").textContent = level.brief;
  $("briefing-mechanic-name").textContent = level.mechanic;
  $("briefing-key").textContent = level.key;
  $("hint-text").textContent = level.hint;
  $("mechanic-help").textContent = level.help;
  $("hint-panel").classList.remove("dismissed");
}

function showScreen(screen) {
  screen.classList.remove("hidden");
  screen.classList.add("active");
}
function hideScreen(screen) {
  screen.classList.remove("active");
  screen.classList.add("hidden");
}
function clearScreens() {
  [titleScreen, briefingScreen, pauseScreen, clearScreen, winScreen, cutsceneScreen].forEach(hideScreen);
}
function toast(message, duration = 2300) {
  const toastNode = $("toast");
  toastNode.textContent = message;
  toastNode.classList.add("show");
  toastTimer = duration;
}
function hideToast() {
  $("toast").classList.remove("show");
}
function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return String(Math.floor(whole / 60)).padStart(2, "0") + ":" + String(whole % 60).padStart(2, "0");
}
function getProgress() {
  try {
    return JSON.parse(localStorage.getItem("null-signal-progress") || "{}");
  } catch {
    return {};
  }
}
function saveProgress(nextLevel) {
  const progress = getProgress();
  progress.nextLevel = Math.max(progress.nextLevel || 0, nextLevel);
  progress.bestTime = Math.min(progress.bestTime || Infinity, state.totalSeconds || Infinity);
  if (progress.storyThrough === undefined) progress.storyThrough = -1;
  localStorage.setItem("null-signal-progress", JSON.stringify(progress));
  updateContinueButton();
}

function markStorySeen(chapterIndex) {
  const progress = getProgress();
  progress.storyThrough = Math.max(progress.storyThrough ?? -1, chapterIndex);
  if (chapterIndex === 2) progress.seaLinkSeen = true;
  localStorage.setItem("null-signal-progress", JSON.stringify(progress));
}
function updateContinueButton() {
  const progress = getProgress();
  const button = $("continue-button");
  if (progress.nextLevel > 0 && progress.nextLevel < LEVELS.length) {
    button.classList.remove("hidden");
    $("continue-label").textContent = "CH " + String(progress.nextLevel + 1).padStart(2, "0");
  } else if (progress.nextLevel >= LEVELS.length) {
    button.classList.remove("hidden");
    $("continue-label").textContent = "REPLAY";
  } else {
    button.classList.add("hidden");
  }
}

function resetPlayer() {
  state.x = 0;
  state.y = 1.65;
  state.z = 13;
  state.vy = 0;
  state.yaw = 0;
  state.pitch = 0;
  state.grounded = true;
  state.gravityDir = -1;
  state.phase = "solid";
  state.timeFrozen = false;
  state.shards = 0;
  state.health = 3;
  state.totalSeconds = 0;
  Object.keys(state.movement).forEach((key) => { state.movement[key] = false; });
  state.jumpPressed = false;
  state.interactPressed = false;
  state.restartPressed = false;
  elapsed = 0;
  levelStartTime = performance.now();
  hitCooldown = 0;
  gravityResetTimer = 0;
  updateVitals();
  updateObjective();
  if (world) world.setPhase("solid");
}

function prepareLevel(index) {
  levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
  initWorld(levelIndex);
  resetPlayer();
  updateChapterUI();
  mode = "briefing";
  hud.classList.add("hidden");
  mobileControls.classList.add("hidden");
  clearScreens();
  showScreen(briefingScreen);
}

function beginLevel() {
  clearScreens();
  hud.classList.remove("hidden");
  mobileControls.classList.toggle("hidden", !isTouchDevice);
  mode = "playing";
  levelStartTime = performance.now();
  audio.start().catch(() => {});
  if (!isTouchDevice && canvas.requestPointerLock) {
    canvas.requestPointerLock();
  }
  toast(levelIndex === 3 ? "DEV'S LOOP · Restore all 3 anchors, then reach him at the signal post." : "3 FRAGMENTS · Space clears barricades. Cross red arcs only when they dim.", 4200);
  lastTime = performance.now();
}

function beginRun(index = 0) {
  prepareLevel(index);
}

function pauseGame() {
  if (mode !== "playing") return;
  mode = "paused";
  showScreen(pauseScreen);
  mobileControls.classList.add("hidden");
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function resumeGame() {
  if (mode !== "paused") return;
  hideScreen(pauseScreen);
  mode = "playing";
  mobileControls.classList.toggle("hidden", !isTouchDevice);
  if (!isTouchDevice && canvas.requestPointerLock) canvas.requestPointerLock();
  lastTime = performance.now();
}

function finishLevel() {
  if (mode !== "playing") return;
  hud.classList.add("hidden");
  mobileControls.classList.add("hidden");
  const showChapterClear = () => {
    mode = "clear";
    const level = LEVELS[levelIndex];
    const note = CHAPTER_NOTES[levelIndex];
    $("clear-title").textContent = level.clearTitle;
    $("clear-copy").textContent = level.clearCopy;
    $("note-location").textContent = note.location;
    $("note-date").textContent = note.date;
    $("note-greeting").textContent = note.greeting;
    $("note-message").textContent = note.message;
    $("note-clue").textContent = note.clue;
    $("note-signature").textContent = note.signature;
    $("clear-fragments").textContent = String(state.shards).padStart(2, "0") + " / 03";
    $("clear-collectible-label").textContent = levelIndex === 3 ? "ANCHORS" : "FRAGMENTS";
    $("clear-time").textContent = formatTime(state.totalSeconds);
    const hasNext = levelIndex < LEVELS.length - 1;
    $("next-level-button").classList.toggle("hidden", !hasNext);
    $("finish-button").classList.toggle("hidden", hasNext);
    saveProgress(levelIndex + 1);
    showScreen(clearScreen);
    audio.play("gate");
  };

  if (levelIndex === LEVELS.length - 1) playStory("reunion", showChapterClear);
  else showChapterClear();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}
function updateObjective() {
  const complete = state.shards >= 3;
  $("shard-value").textContent = String(state.shards).padStart(2, "0") + " / 03";
  $("shard-label").textContent = levelIndex === 3 ? "SIGNAL ANCHORS" : "SIGNAL FRAGMENTS";
  if (levelIndex === 3) {
    $("objective-text").textContent = complete ? "Reach Dev at the signal post · E to free him" : "Stabilize the loop · Restore " + (3 - state.shards) + " signal anchor" + (state.shards === 2 ? "" : "s");
  } else {
    $("objective-text").textContent = complete ? "Reach the signal gate · E to enter" : "Restore " + (3 - state.shards) + " signal fragment" + (state.shards === 2 ? "" : "s");
  }
  if (world) world.setGateOpen(complete);
}
function updateVitals() {
  const pips = $("health-pips");
  pips.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const pip = document.createElement("span");
    pip.className = "health-pip" + (i >= state.health ? " empty" : "");
    pips.appendChild(pip);
  }
}

function setSoundButtons() {
  const label = soundOn ? "ON" : "OFF";
  $("audio-button").innerHTML = "♫ <span>" + label + "</span>";
  $("title-audio").innerHTML = "♫ <span>" + label + "</span>";
}

function toggleAudio() {
  const muted = audio.toggle();
  soundOn = !muted;
  setSoundButtons();
}

function showBriefing(index) {
  prepareLevel(index);
  audio.start().catch(() => {});
}

function initStoryVoices() {
  const button = $("cutscene-voice-button");
  if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") {
    storyVoiceEnabled = false;
    button.classList.add("hidden");
    return;
  }
  const refreshVoices = () => { storySpeechVoices = window.speechSynthesis.getVoices(); };
  refreshVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
  updateStoryVoiceButton();
}

function updateStoryVoiceButton() {
  const button = $("cutscene-voice-button");
  button.classList.toggle("voice-enabled", storyVoiceEnabled);
  button.setAttribute("aria-pressed", String(storyVoiceEnabled));
  button.setAttribute("aria-label", storyVoiceEnabled ? "Turn narration off" : "Turn narration on");
  button.title = "Narration: " + (storyVoiceEnabled ? "on" : "off");
}

function voiceForSpeaker(speaker) {
  if (!storySpeechVoices.length) storySpeechVoices = window.speechSynthesis.getVoices();
  const english = storySpeechVoices.filter((voice) => /^en(-|_)/i.test(voice.lang));
  const india = english.find((voice) => /en[-_]in/i.test(voice.lang));
  const isMira = /mira/i.test(speaker);
  const isDev = /dev/i.test(speaker);
  const preferred = english.find((voice) => {
    const name = voice.name.toLowerCase();
    return isMira ? /female|heera|neerja|priya|zira|susan|aria/i.test(name)
      : isDev ? /male|prabhat|ravi|david|mark|guy/i.test(name)
        : /natural|online|aria|david/i.test(name);
  });
  return preferred || india || english[0] || storySpeechVoices.find((voice) => voice.default) || null;
}

function estimateCaptionDuration(beat) {
  const words = beat.text.trim().split(/\s+/).length;
  return Math.max(beat.duration || 6.8, words / 2.65 + 1.25, 4.6);
}

function cancelStoryVoice() {
  storySpeechToken++;
  storyVoiceActive = false;
  storyVoiceFinishedWhilePaused = false;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function speakStoryBeat(beat) {
  cancelStoryVoice();
  if (!storyVoiceEnabled || !("speechSynthesis" in window)) return;
  const token = storySpeechToken;
  const utterance = new window.SpeechSynthesisUtterance(beat.text);
  const voice = voiceForSpeaker(beat.speaker);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || "en-IN";
  utterance.rate = /mira/i.test(beat.speaker) ? 0.94 : /dev/i.test(beat.speaker) ? 0.88 : 0.92;
  utterance.pitch = /mira/i.test(beat.speaker) ? 1.08 : /dev/i.test(beat.speaker) ? 0.82 : 0.9;
  utterance.volume = 0.94;
  storyVoiceActive = true;
  utterance.onend = () => {
    if (token !== storySpeechToken || !currentStory) return;
    storyVoiceActive = false;
    if (storyPlaying) advanceStory();
    else storyVoiceFinishedWhilePaused = true;
  };
  utterance.onerror = () => {
    if (token !== storySpeechToken) return;
    storyVoiceActive = false;
  };
  window.speechSynthesis.speak(utterance);
}
function renderStoryBeat() {
  const scene = currentStory;
  const sceneOrder = Object.keys(STORY_SCENES);
  const sceneNumber = sceneOrder.indexOf(currentStoryKey) + 1;
  const beat = scene.beats[storyBeatIndex];
  cutsceneScreen.dataset.scene = currentStoryKey;
  const fatherArt = cutsceneScreen.querySelector(".dev-art");
  fatherArt.setAttribute("transform", currentStoryKey === "seaLink" ? "translate(1280 485) scale(.56)" : "translate(1390 431)");
  cutsceneScreen.classList.remove("story-paused");
  cutsceneScreen.style.setProperty("--scene-accent", scene.accent);
  $("cutscene-index").textContent = "ARCHIVE " + String(sceneNumber).padStart(2, "0") + " / " + String(sceneOrder.length).padStart(2, "0");
  $("cutscene-location").textContent = scene.location;
  $("cutscene-title").textContent = scene.title;
  $("cutscene-speaker").textContent = beat.speaker;
  $("cutscene-copy").textContent = beat.text;
  $("cutscene-beat").textContent = String(storyBeatIndex + 1).padStart(2, "0") + " / " + String(scene.beats.length).padStart(2, "0");
  $("cutscene-progress").innerHTML = scene.beats.map((_, index) => "<span" + (index < storyBeatIndex ? " class=\"active\"" : "") + "></span>").join("");
  $("cutscene-next-label").textContent = storyBeatIndex === scene.beats.length - 1 ? scene.action : "Next caption";
  storyPlaying = true;
  storyDuration = estimateCaptionDuration(beat);
  storyRemaining = storyDuration;
  $("cutscene-clock-fill").style.transform = "scaleX(0)";
  $("cutscene-play-button").textContent = "Ⅱ";
  $("cutscene-play-button").setAttribute("aria-label", "Pause captions");
  $("cutscene-play-button").title = "Pause captions";
  speakStoryBeat(beat);
}

function playStory(sceneKey, onComplete) {
  currentStory = STORY_SCENES[sceneKey];
  if (!currentStory) {
    onComplete?.();
    return;
  }
  currentStoryKey = sceneKey;
  storyBeatIndex = 0;
  storyCompleteCallback = onComplete || null;
  mode = "story";
  hud.classList.add("hidden");
  mobileControls.classList.add("hidden");
  clearScreens();
  showScreen(cutsceneScreen);
  renderStoryBeat();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  lastTime = performance.now();
  if (soundOn) audio.play("dimension");
}

function advanceStory() {
  if (!currentStory) return;
  if (storyBeatIndex < currentStory.beats.length - 1) {
    storyBeatIndex++;
    renderStoryBeat();
    if (soundOn) audio.play("pickup");
    return;
  }
  finishStory();
}

function toggleStoryPlayback() {
  if (!currentStory) return;
  storyPlaying = !storyPlaying;
  if (storyPlaying) {
    if ("speechSynthesis" in window) window.speechSynthesis.resume();
    cutsceneScreen.classList.remove("story-paused");
    $("cutscene-play-button").textContent = "Ⅱ";
    $("cutscene-play-button").setAttribute("aria-label", "Pause captions");
    $("cutscene-play-button").title = "Pause captions";
    if (storyVoiceFinishedWhilePaused) {
      storyVoiceFinishedWhilePaused = false;
      advanceStory();
    }
  } else {
    if ("speechSynthesis" in window) window.speechSynthesis.pause();
    cutsceneScreen.classList.add("story-paused");
    $("cutscene-play-button").textContent = "▶";
    $("cutscene-play-button").setAttribute("aria-label", "Play captions");
    $("cutscene-play-button").title = "Play captions";
  }
}
function toggleStoryVoice() {
  if (!("speechSynthesis" in window)) return;
  storyVoiceEnabled = !storyVoiceEnabled;
  updateStoryVoiceButton();
  if (!storyVoiceEnabled) {
    cancelStoryVoice();
    return;
  }
  if (currentStory) {
    const beat = currentStory.beats[storyBeatIndex];
    storyDuration = estimateCaptionDuration(beat);
    storyRemaining = storyDuration;
    $("cutscene-clock-fill").style.transform = "scaleX(0)";
    speakStoryBeat(beat);
    if (!storyPlaying) window.speechSynthesis.pause();
  }
}
function updateStoryPlayback(dt) {
  if (!currentStory || !storyPlaying) return;
  storyRemaining = Math.max(0, storyRemaining - dt);
  const progress = 1 - storyRemaining / Math.max(storyDuration, 0.1);
  $("cutscene-clock-fill").style.transform = "scaleX(" + progress + ")";
  if (storyRemaining <= 0 && !storyVoiceActive) advanceStory();
}

function finishStory() {
  const onComplete = storyCompleteCallback;
  cancelStoryVoice();
  currentStory = null;
  currentStoryKey = "";
  storyCompleteCallback = null;
  storyPlaying = false;
  storyRemaining = 0;
  hideScreen(cutsceneScreen);
  onComplete?.();
}

function playChapterTransition(chapterIndex, onComplete) {
  const transitionKey = ["dadar", "hajiAli", "dharavi"][chapterIndex];
  if (!transitionKey) {
    onComplete?.();
    return;
  }
  playStory(transitionKey, () => {
    const completeTransition = () => {
      markStorySeen(chapterIndex);
      onComplete?.();
    };
    if (chapterIndex === 2) playStory("seaLink", completeTransition);
    else completeTransition();
  });
}
function activatePointerLook(event) {
  if (isTouchDevice || mode !== "playing" || document.pointerLockElement === canvas) return;
  if (event.target === canvas && canvas.requestPointerLock) canvas.requestPointerLock();
}
canvas.addEventListener("click", activatePointerLook);
document.addEventListener("pointerlockchange", () => {
  desktopPointerActive = document.pointerLockElement === canvas;
  if (!desktopPointerActive && mode === "playing" && !isTouchDevice) pauseGame();
});
document.addEventListener("mousemove", (event) => {
  if (!desktopPointerActive || mode !== "playing") return;
  state.yaw -= event.movementX * 0.0022;
  state.pitch -= event.movementY * 0.0020;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -1.28, 1.28);
});

function keyToMovement(key) {
  if (key === "w" || key === "arrowup") return "forward";
  if (key === "s" || key === "arrowdown") return "back";
  if (key === "a" || key === "arrowleft") return "left";
  if (key === "d" || key === "arrowright") return "right";
  return "";
}

function handleMechanic(which) {
  const canGravity = levelIndex === 1 || levelIndex === 3;
  const canPhase = levelIndex >= 2;
  const canFreeze = levelIndex === 0 || levelIndex === 3;
  if (which === "F" && canFreeze) {
    state.timeFrozen = !state.timeFrozen;
    audio.play("freeze");
    toast(state.timeFrozen ? "TIME HELD · The moving Local is fixed in place." : "TIME RELEASED · The city moves again.", 2200);
    updateMechanicReadout();
    return;
  }
  if (which === "G" && canGravity) {
    state.gravityDir *= -1;
    state.vy = state.gravityDir * 2.4;
    state.grounded = false;
    audio.play("gravity");
    gravityResetTimer = 0.9;
    toast(state.gravityDir > 0 ? "GRAVITY REVERSED · The roof is now underfoot." : "GRAVITY RESTORED · Find the road below.", 2400);
    updateMechanicReadout();
    return;
  }
  if (which === "Q" && canPhase) {
    state.phase = state.phase === "solid" ? "echo" : "solid";
    world.setPhase(state.phase);
    audio.play("dimension");
    toast(state.phase === "echo" ? "ECHO ENTERED · The missing city is visible." : "SOLID WORLD · The true city returns.", 2100);
    updateMechanicReadout();
    return;
  }
  if (which === "G" || which === "Q" || which === "F") {
    toast("THIS ANOMALY HAS NOT REACHED THIS CHAPTER YET.", 1700);
  }
}

function togglePrimaryMechanic() {
  if (levelIndex === 0) return handleMechanic("F");
  if (levelIndex === 1) return handleMechanic("G");
  if (levelIndex === 2) return handleMechanic("Q");
  const sequence = ["F", "G", "Q"];
  handleMechanic(sequence[finalMechanicCursor % sequence.length]);
  finalMechanicCursor++;
}

function updateMechanicReadout() {
  const stateNode = $("mechanic-state");
  const active = [];
  if (state.timeFrozen) active.push("TIME HELD");
  if (state.gravityDir > 0) active.push("GRAVITY REVERSED");
  if (state.phase === "echo") active.push("ECHO DIMENSION");
  stateNode.textContent = active.length ? active.join("  ·  ") : "ANOMALY INACTIVE";
  stateNode.classList.toggle("active", active.length > 0);
  if (levelIndex === 0) $("mechanic-help").textContent = state.timeFrozen ? "F · RELEASE TIME" : "F · FREEZE TIME";
  else if (levelIndex === 1) $("mechanic-help").textContent = state.gravityDir > 0 ? "G · RESTORE GRAVITY" : "G · SHIFT GRAVITY";
  else if (levelIndex === 2) $("mechanic-help").textContent = state.phase === "echo" ? "Q · RETURN TO CITY" : "Q · ENTER ECHO";
  else $("mechanic-help").textContent = "F · TIME   G · GRAVITY   Q · ECHO";
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (mode === "story") {
    if (["enter", " ", "spacebar"].includes(key)) event.preventDefault();
    if (!event.repeat && ["enter", " ", "spacebar"].includes(key)) advanceStory();
    else if (!event.repeat && key === "escape") finishStory();
    else if (!event.repeat && key === "p") toggleStoryPlayback();
    return;
  }
  const move = keyToMovement(key);
  if (move) state.movement[move] = true;
  if (key === " " || key === "spacebar") {
    event.preventDefault();
    if (!event.repeat) state.jumpPressed = true;
  }
  if (key === "e" && !event.repeat) state.interactPressed = true;
  if (key === "f" && !event.repeat && mode === "playing") handleMechanic("F");
  if (key === "g" && !event.repeat && mode === "playing") handleMechanic("G");
  if (key === "q" && !event.repeat && mode === "playing") handleMechanic("Q");
  if (key === "r" && !event.repeat && mode === "playing") state.restartPressed = true;
  if (key === "p" && !event.repeat) {
    if (mode === "playing") pauseGame();
    else if (mode === "paused") resumeGame();
  }
  if (key === "escape" && mode === "playing" && (!desktopPointerActive || isTouchDevice)) pauseGame();
  keys.add(key);
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
}
function handleKeyUp(event) {
  const key = event.key.toLowerCase();
  const move = keyToMovement(key);
  if (move) state.movement[move] = false;
  keys.delete(key);
}
window.addEventListener("keydown", handleKeyDown, { passive: false });
window.addEventListener("keyup", handleKeyUp);

function attachTouchControls() {
  document.querySelectorAll("[data-move]").forEach((button) => {
    const move = button.dataset.move;
    const press = (event) => {
      event.preventDefault();
      state.movement[move] = true;
      button.classList.add("pressed");
      button.setPointerCapture?.(event.pointerId);
    };
    const release = (event) => {
      event.preventDefault();
      state.movement[move] = false;
      button.classList.remove("pressed");
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const action = button.dataset.action;
      button.classList.add("pressed");
      button.setPointerCapture?.(event.pointerId);
      if (action === "interact") state.interactPressed = true;
      if (action === "jump") state.jumpPressed = true;
      if (action === "mechanic") togglePrimaryMechanic();
    });
    const release = () => button.classList.remove("pressed");
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (!isTouchDevice || mode !== "playing" || event.pointerType !== "touch") return;
    if (event.target.closest?.(".touch-cluster")) return;
    mouseLookPointer = event.pointerId;
    lastTouchLook = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (mouseLookPointer !== event.pointerId || !lastTouchLook) return;
    const dx = event.clientX - lastTouchLook.x;
    const dy = event.clientY - lastTouchLook.y;
    state.yaw -= dx * 0.006;
    state.pitch -= dy * 0.006;
    state.pitch = THREE.MathUtils.clamp(state.pitch, -1.15, 1.15);
    lastTouchLook = { x: event.clientX, y: event.clientY };
  });
  const endLook = (event) => {
    if (event.pointerId === mouseLookPointer) {
      mouseLookPointer = null;
      lastTouchLook = null;
    }
  };
  canvas.addEventListener("pointerup", endLook);
  canvas.addEventListener("pointercancel", endLook);
}

function currentPlayerBounds() {
  if (state.gravityDir < 0) return { min: state.y - 1.6, max: state.y + 0.15 };
  return { min: state.y - 0.15, max: state.y + 1.6 };
}
function phaseMatches(phase) {
  return phase === "solid" || state.phase === "echo";
}
function getSurfaceAt(surfaces, x, z) {
  return surfaces.find((surface) =>
    phaseMatches(surface.phase) &&
    Math.abs(x - surface.x) <= surface.width / 2 - 0.24 &&
    Math.abs(z - surface.z) <= surface.depth / 2 - 0.24
  );
}
function overlapsCollider(x, y, z, collider) {
  if (!collider.active && collider.isGate) return false;
  if (!phaseMatches(collider.phase)) return false;
  const vertical = currentPlayerBounds();
  return Math.abs(x - collider.x) < collider.w / 2 + 0.28 &&
    Math.abs(z - collider.z) < collider.d / 2 + 0.32 &&
    vertical.max > collider.yMin && vertical.min < collider.yMax;
}
function canMoveTo(x, z) {
  if (x < WORLD_BOUNDS.minX + 0.55 || x > WORLD_BOUNDS.maxX - 0.55) return false;
  if (z < WORLD_BOUNDS.minZ + 0.6 || z > WORLD_BOUNDS.maxZ - 0.6) return false;
  return !world.colliders.some((collider) => overlapsCollider(x, state.y, z, collider));
}
function setPlayerPosition(x, z) {
  if (canMoveTo(x, state.z)) state.x = x;
  if (canMoveTo(state.x, z)) state.z = z;
}

function resolveVertical(dt) {
  const gravity = 22;
  state.vy += state.gravityDir * gravity * dt;
  state.y += state.vy * dt;

  if (state.gravityDir < 0 && state.vy <= 0) {
    const floor = getSurfaceAt(world.floors, state.x, state.z);
    if (floor && state.y <= floor.y + 1.65) {
      state.y = floor.y + 1.65;
      state.vy = 0;
      state.grounded = true;
    } else {
      state.grounded = false;
    }
  } else if (state.gravityDir > 0 && state.vy >= 0) {
    const ceiling = getSurfaceAt(world.ceilings, state.x, state.z);
    if (ceiling && state.y >= ceiling.y - 1.65) {
      state.y = ceiling.y - 1.65;
      state.vy = 0;
      state.grounded = true;
    } else {
      state.grounded = false;
    }
  }

  if (state.y < -5.5 || state.y > 14) {
    state.health = Math.max(1, state.health - 1);
    updateVitals();
    state.x = 0;
    state.z = Math.max(11, state.z + 7);
    state.y = 1.65;
    state.vy = 0;
    state.gravityDir = -1;
    state.grounded = true;
    state.timeFrozen = false;
    state.phase = "solid";
    world.setPhase("solid");
    updateMechanicReadout();
    audio.play("impact");
    toast("SIGNAL RESET · Find the route before the next fall.", 2600);
  }
}

function updateMovement(dt) {
  const forward = Number(state.movement.forward) - Number(state.movement.back);
  const side = Number(state.movement.right) - Number(state.movement.left);
  const length = Math.hypot(forward, side);
  const f = length > 1 ? forward / length : forward;
  const s = length > 1 ? side / length : side;
  const speed = state.grounded ? 5.15 : 4.1;
  const dx = (Math.sin(state.yaw) * f + Math.cos(state.yaw) * s) * speed * dt;
  const dz = (-Math.cos(state.yaw) * f + Math.sin(state.yaw) * s) * speed * dt;

  if (dx || dz) {
    setPlayerPosition(state.x + dx, state.z + dz);
    if (state.grounded) {
      footstepTimer -= dt;
      if (footstepTimer <= 0) {
        audio.play("step");
        footstepTimer = 0.48;
      }
    }
  }

  if (state.jumpPressed && state.grounded) {
    state.vy = state.gravityDir < 0 ? 8.1 : -8.1;
    state.grounded = false;
    audio.play("step");
  }
  state.jumpPressed = false;

  if (state.restartPressed) {
    state.restartPressed = false;
    prepareLevel(levelIndex);
    toast("CHAPTER RESTARTED.", 1200);
    return;
  }

  resolveVertical(dt);
}

function collectNearby() {
  for (const item of world.collectibles) {
    if (item.collected || (item.phase === "echo" && state.phase !== "echo")) continue;
    const dx = item.group.position.x - state.x;
    const dy = item.group.position.y - state.y;
    const dz = item.group.position.z - state.z;
    if (Math.hypot(dx, dy, dz) < 1.35) {
      item.collected = true;
      item.group.visible = false;
      state.shards++;
      state.health = Math.min(3, state.health + 1);
      updateVitals();
      updateObjective();
      audio.play("pickup");
      toast((levelIndex === 3 ? "SIGNAL ANCHOR " : "SIGNAL FRAGMENT ") + String(state.shards).padStart(2, "0") + " / 03 · SYNC RESTORED", 2300);
    }
  }
}

function checkHazard() {
  if (hitCooldown > 0) return;
  const vertical = currentPlayerBounds();
  let impact = null;
  let isTrain = false;

  if (world.hazard && !state.timeFrozen && state.gravityDir < 0) {
    const train = world.hazard;
    const trainBottom = train.group.position.y - 1.2;
    const trainTop = train.group.position.y + 1.2;
    const overlapsTrainHeight = vertical.max > trainBottom && vertical.min < trainTop;
    if (Math.abs(state.z - train.z) < train.halfD + 0.6 &&
        Math.abs(state.x - train.group.position.x) < train.halfW + 0.38 &&
        overlapsTrainHeight) {
      impact = train;
      isTrain = true;
    }
  }

  if (!impact) {
    impact = world.pulseGates.find((gate) => {
      if (!gate.active || (gate.phase === "echo" && state.phase !== "echo")) return false;
      const overlapsHeight = vertical.max > gate.yMin && vertical.min < gate.yMax;
      return overlapsHeight &&
        Math.abs(state.z - gate.z) < gate.halfDepth + 0.42 &&
        Math.abs(state.x - gate.x) < gate.width / 2 + 0.34;
    });
  }
  if (!impact) return;

  hitCooldown = 2.2;
  state.health = Math.max(0, state.health - 1);
  updateVitals();
  state.x = 0;
  state.z = isTrain ? impact.z + 4.4 : (impact.respawnZ ?? impact.z + 2.6);
  state.y = 1.65;
  state.vy = 0;
  state.grounded = true;
  state.gravityDir = -1;
  state.timeFrozen = false;
  state.phase = "solid";
  world.setPhase("solid");
  updateMechanicReadout();
  audio.play("impact");
  if (state.health === 0) {
    toast("SIGNAL LOST · Restarting this chapter.", 2900);
    window.setTimeout(() => {
      if (mode === "playing") prepareLevel(levelIndex);
    }, 1900);
  } else if (isTrain) {
    toast("LOCAL IMPACT · Freeze the train when it clears your path. Fragments are safe.", 2600);
  } else {
    toast("ARC SURGE · Wait for the red barrier to dim. Fragments are safe.", 2600);
  }
}

function updateInteraction() {
  const distanceToGate = Math.hypot(state.x, state.z + 45.2);
  const nearGate = world.portal.open && distanceToGate < 3.2 && Math.abs(state.x) < 4.5;
  $("interaction-prompt").classList.toggle("hidden", !nearGate);
  $("interaction-prompt").querySelector("span").textContent = levelIndex === 3 ? "FREE DEV" : "INTERACT";
  if (state.interactPressed) {
    if (nearGate) finishLevel();
    else {
      toast(state.shards < 3 ? (levelIndex === 3 ? "THE LOOP NEEDS ALL THREE SIGNAL ANCHORS." : "THE EXIT NEEDS ALL THREE SIGNAL FRAGMENTS.") : "MOVE CLOSER TO THE GATE.", 1700);
    }
  }
  state.interactPressed = false;
}

function updateCamera(dt) {
  camera.position.set(state.x, state.y, state.z);
  const targetRoll = state.gravityDir > 0 ? Math.PI : 0;
  const roll = THREE.MathUtils.damp(camera.rotation.z, targetRoll, 4.8, dt);
  camera.rotation.set(state.pitch, state.yaw, roll, "YXZ");
}

function updateHUD(dt) {
  updateMechanicReadout();
  if (toastTimer > 0) {
    toastTimer -= dt * 1000;
    if (toastTimer <= 0) hideToast();
  }
  if (hitCooldown > 0) hitCooldown -= dt;
  if (gravityResetTimer > 0) gravityResetTimer -= dt;
}

function renderFrame(now) {
  requestAnimationFrame(renderFrame);
  const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (!renderer || !scene) return;
  if (mode === "playing") {
    elapsed += dt;
    state.totalSeconds = Math.floor((now - levelStartTime) / 1000);
    updateMovement(dt);
    world.update(dt, elapsed, state.phase, state.timeFrozen);
    collectNearby();
    checkHazard();
    updateInteraction();
    updateCamera(dt);
    updateHUD(dt);
    rain.update(dt);
  } else {
    if (mode === "story") updateStoryPlayback(dt);
    if (world) world.update(dt * 0.35, elapsed + now / 20000, state.phase, state.timeFrozen);
    updateCamera(dt);
    if (rain) rain.update(dt * 0.25);
  }

  if (composer) composer.render();
  else if (renderer) renderer.render(scene, camera);
}

function resize() {
  if (!renderer || !camera) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouchDevice ? 1.55 : 1.85));
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(width, height); }
}
window.addEventListener("resize", resize);

$("start-button").addEventListener("click", async () => {
  state.totalSeconds = 0;
  localStorage.removeItem("null-signal-progress");
  updateContinueButton();
  await audio.start().catch(() => {});
  playStory("prologue", () => beginRun(0));
});
$("continue-button").addEventListener("click", async () => {
  const progress = getProgress();
  const target = progress.nextLevel >= LEVELS.length ? 0 : progress.nextLevel;
  await audio.start().catch(() => {});
  if (target === 0) {
    localStorage.removeItem("null-signal-progress");
    updateContinueButton();
    playStory("prologue", () => beginRun(0));
    return;
  }
  if ((progress.storyThrough ?? -1) < target - 1 || (target === 3 && !progress.seaLinkSeen)) {
    playChapterTransition(target - 1, () => beginRun(target));
  } else {
    beginRun(target);
  }
});
$("cutscene-next-button").addEventListener("click", advanceStory);
$("cutscene-play-button").addEventListener("click", toggleStoryPlayback);
$("cutscene-voice-button").addEventListener("click", toggleStoryVoice);
$("cutscene-skip-button").addEventListener("click", finishStory);
$("enter-level-button").addEventListener("click", beginLevel);
$("pause-button").addEventListener("click", pauseGame);
$("resume-button").addEventListener("click", resumeGame);
$("restart-level-button").addEventListener("click", () => prepareLevel(levelIndex));
$("next-level-button").addEventListener("click", () => {
  playChapterTransition(levelIndex, () => showBriefing(levelIndex + 1));
});
function returnToTitle() {
  localStorage.removeItem("null-signal-progress");
  updateContinueButton();
  mode = "title";
  clearScreens();
  showScreen(titleScreen);
  hud.classList.add("hidden");
}
function showWinScreen() {
  mode = "won";
  clearScreens();
  showScreen(winScreen);
  audio.play("gate");
}
$("finish-button").addEventListener("click", () => playStory("ending", showWinScreen));
$("win-replay-button").addEventListener("click", async () => {
  localStorage.removeItem("null-signal-progress");
  updateContinueButton();
  await audio.start().catch(() => {});
  playStory("prologue", () => beginRun(0));
});
$("win-title-button").addEventListener("click", returnToTitle);
$("audio-button").addEventListener("click", toggleAudio);
$("title-audio").addEventListener("click", async () => {
  await audio.start().catch(() => {});
  toggleAudio();
});
$("dismiss-hint").addEventListener("click", () => $("hint-panel").classList.add("dismissed"));
attachTouchControls();
updateContinueButton();
setSoundButtons();
initStoryVoices();
initRenderer();
initWorld(0);
updateChapterUI();
resetPlayer();
requestAnimationFrame(renderFrame);






