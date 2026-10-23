export const LEVELS = [
  {
    id: 1,
    location: "DADAR STATION",
    subtitle: "THE STOPPED MINUTE",
    title: "Dadar: The Stopped Minute",
    brief: "The last local is caught between two seconds. Chain jumps over three barricades with two pulsing arc gates, then freeze the train at the crossing. Your three fragments are spread across the whole platform.",
    mechanic: "Time freeze",
    key: "F",
    hint: "Read each arc's warning lamps; the safe window is brief. Space clears striped barricades. Freeze the local with F only when it blocks your crossing.",
    help: "F · FREEZE TIME",
    clearTitle: "The minute starts again.",
    clearCopy: "The station clock moves forward. Somewhere beyond the rain, Mumbai answers with another broken signal.",
    palette: { fog: 0x101b27, sky: 0x09121c, floor: 0x34454a, accent: 0x8ef5d6, warm: 0xffb46f }
  },
  {
    id: 2,
    location: "HAJI ALI CAUSEWAY",
    subtitle: "UP IS DOWN",
    title: "Haji Ali: Up Is Down",
    brief: "The tide has swallowed the causeway. Shift gravity to cross the roof route, thread two ceiling machines, then drop back to the road through a second timed arc and barricade chain.",
    mechanic: "Gravity shift",
    key: "G",
    hint: "Press G before the flooded gap and keep moving sideways across the roof. Drop back to the road after the last ceiling machine, then time both arc gates.",
    help: "G · SHIFT GRAVITY",
    clearTitle: "The tide turns.",
    clearCopy: "Water finds its way back to the sea. The next fragment is humming inside the missing quarter.",
    palette: { fog: 0x10232b, sky: 0x071820, floor: 0x294348, accent: 0x89e8f3, warm: 0xffcf81 }
  },
  {
    id: 3,
    location: "DHARAVI",
    subtitle: "THE MISSING QUARTER",
    title: "Dharavi: The Missing Quarter",
    brief: "An entire lane has slipped out of this version of the city. Enter Echo before the gap, collect its hidden fragment between two short arc windows, and jump the barricades on both sides of the missing lane.",
    mechanic: "Dimension shift",
    key: "Q",
    hint: "The blue bridge and both short pulse windows exist in Echo. Enter before the gap, collect the fragment between the gates, then return to the solid city after the far edge.",
    help: "Q · SHIFT DIMENSION",
    clearTitle: "The quarter returns.",
    clearCopy: "Familiar windows light up one by one. The Sea Link is the only signal left.",
    palette: { fog: 0x1e1825, sky: 0x110d1b, floor: 0x4b3e43, accent: 0xf0a1ff, warm: 0xffbb77 }
  },
  {
    id: 4,
    location: "BANDRA–WORLI SEA LINK",
    subtitle: "THE LAST LOOP",
    title: "Bandra–Worli: The Last Loop",
    brief: "Dev is trapped in the bridge's repeating nine-second loop. A moving local, four increasingly tight arc windows, a flooded break and ceiling machinery now overlap. Stabilize all three anchors, chain time, gravity and Echo, then bring him home.",
    mechanic: "All anomalies",
    key: "F / G / Q",
    hint: "Watch the arc lamps and listen for the local. Freeze only when it crosses your line; shift gravity for the flooded break and enter Echo for the last crossing. Space clears striped barricades.",
    help: "F · TIME     G · GRAVITY     Q · ECHO",
    clearTitle: "The loop lets go.",
    clearCopy: "With Dev beside her, Mira steps off the bridge as the rain finally moves forward. The city has a signal again, and the first local is waiting.",
    palette: { fog: 0x101b29, sky: 0x07111e, floor: 0x34434d, accent: 0x8ef5d6, warm: 0xffb46f }
  }
];

export function getMechanicHelp(levelIndex) {
  return LEVELS[levelIndex]?.help ?? LEVELS[0].help;
}

