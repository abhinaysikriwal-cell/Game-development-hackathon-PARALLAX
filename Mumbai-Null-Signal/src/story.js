const caption = (speaker, text, duration = 6.8) => ({ speaker, text, duration });

export const CHAPTER_NOTES = [
  {
    location: "DADAR STATION · PLATFORM 04",
    date: "17 AUG 2037 · 00:17",
    greeting: "Mira,",
    message: "If the local is still moving, the signal is still alive. I left the next relay where the tide climbs over the old causeway.",
    clue: "When the water takes the road, look up. The way forward is above you.",
    signature: "Baba"
  },
  {
    location: "HAJI ALI · FLOOD MARKER 06",
    date: "17 AUG 2037 · 00:23",
    greeting: "Mira,",
    message: "An empty lane isn't always gone. The grid keeps a blue copy of every street it had to forget.",
    clue: "In Dharavi, step into Echo. The missing lane is still there, waiting between the two pulses.",
    signature: "Baba"
  },
  {
    location: "DHARAVI · DISPATCH ARCHIVE",
    date: "17 AUG 2037 · 00:31",
    greeting: "Mira,",
    message: "You found the route I opened for the passengers. The bridge keeps repeating because its three anchors never got a final signal.",
    clue: "Follow the heartbeat to the Sea Link. Steady all three anchors before the loop starts again.",
    signature: "Baba"
  },
  {
    location: "BANDRA–WORLI SEA LINK · FAR DECK",
    date: "17 AUG 2037 · 00:42",
    greeting: "Mira,",
    message: "You came all this way. I kept the beacon lit because I knew you would hear it. The rain is moving again. So am I.",
    clue: "The first local at Dadar is waiting. This time, we take it home together.",
    signature: "Your Baba · DEV-01"
  }
];

export const STORY_SCENES = {
  prologue: {
    label: "FIELD RECORDING 00:17 / MUMBAI, 2049",
    location: "DADAR SIGNAL CONTROL",
    title: "The city missed a beat.",
    accent: "#8ef5d6",
    action: "Follow the first signal",
    beats: [
      caption("ARCHIVE", "Monsoon, 2049. Mira Deshmukh is alone on the night shift in Dadar's signal room, listening to Mumbai's new emergency grid count down to midnight."),
      caption("MIRA", "At 00:17, every clock stops. One local keeps moving through the rain. Its dead radio answers on DEV-01 — the call sign of my father, a motorman who vanished during the great flood twelve years ago.", 7.8),
      caption("DEV · RECORDING", "Four notes. Four places. Bring the city back in time.", 6.2),
      caption("ARCHIVE", "Twelve signal fragments are scattered across Dadar, Haji Ali, Dharavi and the Sea Link. Mira follows the impossible recording into the stopped station.", 7.4)
    ]
  },
  dadar: {
    label: "RECOVERED LOG 01 / PLATFORM 04",
    location: "DADAR STATION",
    title: "A bell in the static.",
    accent: "#8ef5d6",
    action: "Continue to Haji Ali",
    beats: [
      caption("ARCHIVE", "The first relay catches the station clock. The local still loops, but now Mira can hear the carriage bell beneath the thunder."),
      caption("MIRA", "Four notes. The train isn't carrying him. It's replaying the last route stored in the emergency grid."),
      caption("ARCHIVE", "The next note comes from Haji Ali. On the flood map, Dev marked a path above the water.")
    ]
  },
  hajiAli: {
    label: "RECOVERED LOG 02 / HIGH TIDE",
    location: "HAJI ALI CAUSEWAY",
    title: "The route above the water.",
    accent: "#89e8f3",
    beats: [
      caption("ARCHIVE", "The second relay restores the tide's rhythm. Beneath the causeway, Mira finds her father's mark on a 2037 evacuation chart."),
      caption("MIRA", "When the road flooded, Dev sent stranded passengers toward higher ground. He keyed the emergency signal from the roof relay."),
      caption("ARCHIVE", "The next note is buried in a lane the city no longer remembers: Dharavi.")
    ]
  },
  dharavi: {
    label: "RECOVERED LOG 03 / ECHO ARCHIVE",
    location: "DHARAVI",
    title: "A city kept in memory.",
    accent: "#f0a1ff",
    beats: [
      caption("ARCHIVE", "Echo is the grid's last intact backup: a map of Mumbai from the night the flood took the network offline."),
      caption("MIRA", "Dev opened this route and sent the passengers out. The dispatch ends at the Sea Link. He never reached the other end."),
      caption("SIGNAL READER", "A living pulse is repeating at the source of the Null Signal. Distance: Bandra–Worli Sea Link.")
    ]
  },
  seaLink: {
    label: "LIVE FEED / CHAPTER 04",
    location: "BANDRA–WORLI SEA LINK",
    title: "Someone is still in there.",
    accent: "#8ef5d6",
    action: "Go find him",
    beats: [
      caption("ARCHIVE", "The last note leads Mira into the bridge's nine-second loop. The rain resets. The signal reader keeps finding the same heartbeat."),
      caption("MIRA", "A man walks across the far deck. The same coat. The same limp. Every nine seconds, the bridge takes him back."),
      caption("DEV", "Mira? Is that really you?"),
      caption("MIRA", "Her father is alive, held inside the stopped interval since the 2037 flood. Three signal anchors can steady the loop long enough to reach him.", 7.8)
    ]
  },
  reunion: {
    label: "LIVE TRANSMISSION / LOOP STABILIZED",
    location: "THE FAR DECK",
    title: "Twelve years. One step.",
    accent: "#8ef5d6",
    action: "See what comes next",
    beats: [
      caption("ARCHIVE", "The gate opens. For the first time in twelve years, the repeating rain moves on. Mira runs toward the man at the signal post."),
      caption("MIRA", "I followed every note. I thought I was bringing the city back. I was trying to bring you home."),
      caption("DEV", "You did both. Come on, Mira. The first local is waiting.")
    ]
  },
  ending: {
    label: "FINAL TRANSMISSION / 05:42 AM",
    location: "MUMBAI, AT DAWN",
    title: "The city remembers.",
    accent: "#8ef5d6",
    action: "Return to Mumbai",
    beats: [
      caption("ARCHIVE", "Four relays lock. Twelve fragments become one clear signal, and the looping bridge finally points toward shore."),
      caption("DEV", "I sent everyone ahead when the grid failed. The loop caught me on the bridge. I kept the beacon running, hoping someone would hear the route."),
      caption("MIRA", "I heard you."),
      caption("ARCHIVE", "At dawn, the first local rolls into Dadar. Mira and Dev step aboard together. The clocks move forward. Mumbai is home.", 7.8)
    ]
  }
};