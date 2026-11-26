/**
 * Tone Composer for Purple Garden.
 *
 * Dynamically constructs three genuinely distinct, non-robotic tones:
 * - Tone 1 (Gentle and cute): Warm, conversational, humanizing without therapist clichés (7-18 words).
 * - Tone 2 (More playful): Clever observation, contrast punchline, unexpected interpretation (8-22 words).
 * - Tone 3 (Slightly exaggerated): Theatrical absurdity and scale without repetitive formulas (10-25 words).
 *
 * Consumes InterpretedSituation components, contrasts, and humor strategies.
 */

import type { InterpretedSituation } from "./situation-interpreter.ts";
import { SEMANTIC_TOPICS } from "./semantic-topics.ts";

export interface ComposedAngles {
  gentle: string;
  playful: string;
  exaggerated: string;
}

/**
 * Composes three lighter angles from the interpreted situation and seed modifier.
 */
export function composeAngles(
  situation: InterpretedSituation,
  seedModifier: number = 0
): ComposedAngles {
  const seed = Math.abs(seedModifier);

  // 1. Boundary-sensitive situation (Level C) - Strictly observable situations, zero positive-intention projection
  if (situation.sensitivity === "boundary") {
    // If mocking / teasing behavior is present, use clean comedic boundary reframes
    if (situation.behaviors.includes("mocking or teasing") || situation.primaryTopic === "interpersonal_mocking") {
      const gentleList = [
        "A quiet reminder that teasing is only funny when everyone in the room is laughing.",
        "A clear pause for the jokes to take a rest so kindness can be heard properly.",
        "A quiet moment to step away from sharp humor and let plain warmth take center stage.",
        "A healthy breath to make sure respect and kindness always come before the punchline.",
      ];
      const playfulList = [
        "The household stand-up comedy routine ran well past its scheduled curtain call.",
        "Someone left the comedy channel on high volume when plain conversation was requested.",
        "The home roast department is officially closed for an unscheduled public intermission.",
        "A stand-up routine that urgently needs to pack up its microphone and exit the stage.",
      ];
      const exaggeratedList = [
        "Breaking: comedy club union called to order as satire quotas exceed all legal limits.",
        "Stand-up comedy special enters fourth consecutive hour despite an empty auditorium.",
        "Supreme domestic tribunal issues immediate cease-and-desist order to the roast department.",
        "National satire board suspends broadcast license until genuine compliments are restored.",
      ];
      return {
        gentle: gentleList[seed % gentleList.length],
        playful: playfulList[seed % playfulList.length],
        exaggerated: exaggeratedList[seed % exaggeratedList.length],
      };
    }

    const gentleList = [
      "A quiet space to let pressure stop completely and honor that personal boundaries are valid.",
      "A clear pause where no means no and everyone gets full room to feel heard.",
      "A quiet moment to step back and let comfort and autonomy take first priority.",
      "Respecting each person's freedom to choose without any insistence or rushing.",
    ];
    const playfulList = [
      "The insistence committee has been firmly informed that personal veto power is final.",
      "A clear stop sign waving calmly while the pressure campaign packs up its flyers.",
      "The lobby delegation for immediate action has met the very firm door of personal choice.",
      "An enthusiastic request that officially hit the peaceful brakes of personal autonomy.",
    ];
    const exaggeratedList = [
      "Supreme domestic council affirms personal veto power is sovereign, permanent, and untaxable.",
      "Diplomatic treaties confirm that no action occurs without unanimous bilateral consensus.",
      "Urgent initiative tabled indefinitely while personal boundaries receive royal protection.",
      "High-pressure sales pitch escorted to the outer perimeter by domestic border security.",
    ];
    return {
      gentle: gentleList[seed % gentleList.length],
      playful: playfulList[seed % playfulList.length],
      exaggerated: exaggeratedList[seed % exaggeratedList.length],
    };
  }

  // 2. Genuine Contrast Cases (H4 Playful Contrast)
  if (situation.contrast) {
    const { type } = situation.contrast;

    // A. Seriousness vs silliness / unexpected noise (e.g. "making weird noise in serious situations")
    if (type === "seriousness_vs_silliness") {
      const gentleList = [
        "The serious moment seems to have picked up an unexpected little soundtrack.",
        "A solemn conversation that unexpectedly invited an unscheduled sound effects audition.",
        "A quiet reminder that solemn moments occasionally produce an impromptu background soundtrack.",
        "Two thoughtful minds having an important moment with a surprise musical interlude.",
      ];
      const playfulList = [
        "Apparently important conversations now come with complimentary sound effects.",
        "The discussion was proceeding with high dignity until the audio department improvised.",
        "Our serious summit apparently hired an avant-garde sound technician without telling us.",
        "An important meeting that came with an unscripted comedic sound-effect track.",
      ];
      const exaggeratedList = [
        "The emergency meeting has been temporarily interrupted by an unscheduled performance from the sound-effects department.",
        "Diplomatic summit records confirm the treaty was discussed to the accompaniment of mystery noises.",
        "International crisis negotiations pause while sound engineers investigate an unexpected auditory plot twist.",
        "Official meeting minutes document the serious agenda plus three bars of avant-garde acoustic percussion.",
      ];
      return {
        gentle: gentleList[seed % gentleList.length],
        playful: playfulList[seed % playfulList.length],
        exaggerated: exaggeratedList[seed % exaggeratedList.length],
      };
    }

    // B. Normal volume vs loudness (e.g. "During the conversation the voice increases", "talking too loud on the phone")
    if (type === "normal_volume_vs_loudness") {
      const isPhone = situation.context === "phone call" || situation.entities.includes("phone");
      const gentleList = isPhone
        ? [
            "The phone call accidentally discovered auditorium acoustics.",
            "A lively phone conversation where the other caller must hear every word clearly.",
            "Someone's phone voice making sure the whole house stays informed of the call.",
            "A phone call that gently drifted into outdoor broadcast settings.",
          ]
        : [
            "Sometimes the conversation accidentally discovers its outdoor voice.",
            "A warm conversation that casually drifted into auditorium acoustics.",
            "A passionate voice that got just a little bit too excited to share its thoughts.",
            "Sound waves that were simply eager to be heard across the room.",
          ];
      const playfulList = isPhone
        ? [
            "Apparently this phone call came with complimentary front-row tickets for the room.",
            "The phone speaker was apparently considered completely optional for this call.",
            "A phone conversation broadcasting live to the entire neighborhood frequency.",
            "Someone's phone call is currently testing our home's acoustic insulation limits.",
          ]
        : [
            "Apparently this discussion came with its own stadium announcer.",
            "Someone's conversational volume dial gently skipped three indoor settings.",
            "A cozy chat that temporarily transitioned into festival headline stage mode.",
            "The living room acoustics were tested for full Olympic stadium readiness.",
          ];
      const exaggeratedList = isPhone
        ? [
            "The phone conversation has reached a volume where telecom satellites request subtitles.",
            "Air traffic control radios the living room to coordinate phone call frequencies.",
            "Local news stations tune in to broadcast tonight's phone call live at eleven.",
            "Acoustic monitoring stations detect the phone conversation across three neighboring zip codes.",
          ]
        : [
            "The conversation has reached a volume where tickets for the front row might be required.",
            "Atmospheric sound stations confirm our living room chat has entered international broadcast range.",
            "Regional decibel regulators dispatch emergency mediators to negotiate indoor volume treaties.",
            "Acoustic satellites in low Earth orbit detect our evening discussion and request subtitles.",
          ];
      return {
        gentle: gentleList[seed % gentleList.length],
        playful: playfulList[seed % playfulList.length],
        exaggerated: exaggeratedList[seed % exaggeratedList.length],
      };
    }

    // C. Silence vs noise (e.g. "Burping and snoring")
    if (type === "silence_vs_noise") {
      const gentleList = [
        "Living together apparently comes with its own spontaneous sound effects.",
        "A cozy bedroom where our bodies produce their own unprompted acoustic concerts.",
        "Gentle nighttime acoustics reminding us of how deeply relaxed someone feels.",
        "Two humans sharing space with all of their natural, unscripted sound effects.",
      ];
      const playfulList = [
        "Our household seems to have hired its own 24-hour acoustic rhythm section.",
        "The snoring and rhythm department have teamed up to perform an avant-garde bedtime album.",
        "A live acoustic broadcast demonstrating the impressive resonance of the human body.",
        "The sound-effects department working unscheduled overtime right beside the pillow.",
      ];
      const exaggeratedList = [
        "Bedroom acoustics are now officially eligible for surround-sound IMAX certification.",
        "Local seismologists confirm bedroom acoustics rival prehistoric cave echoes tonight.",
        "Bedside decibels register on tectonic monitoring equipment across three neighboring zip codes.",
        "Auditory research institutes submit grant proposals to document our bedroom symphony.",
      ];
      return {
        gentle: gentleList[seed % gentleList.length],
        playful: playfulList[seed % playfulList.length],
        exaggerated: exaggeratedList[seed % exaggeratedList.length],
      };
    }

    // D. Order vs clutter (e.g. "Wardrobe drawers are always half opened", "kitchen cabinet doors left wide open")
    if (type === "order_vs_clutter") {
      const isCabinetOnly = situation.entities.some(e => e.includes("cabinet")) && !situation.entities.some(e => e.includes("drawer") || e.includes("wardrobe"));
      const targetObj = isCabinetOnly ? "cabinets" : "wardrobe drawers";
      const singleObj = isCabinetOnly ? "cabinet" : "drawer";

      const gentleList = [
        `The ${targetObj} are politely peeking out to say hello.`,
        `A quiet ${singleObj} that prefers letting everything breathe freely.`,
        `Doors and drawers that seem perfectly content pausing halfway through their journey.`,
        `A gentle reminder of today's kitchen or morning outfit expedition left open to the breeze.`,
      ];
      const playfulList = [
        `The ${targetObj} are practicing an open-door policy for all the socks today.`,
        `The ${targetObj} are testing whether clothes look better in an open-air modern art display.`,
        `Wardrobe drawers and open doors that decided closing all the way was an overrated domestic convention.`,
        `A boutique wardrobe display permanently showcasing the current season's essentials.`,
      ];
      const exaggeratedList = [
        `The ${targetObj} have refused to close until they finish their contemporary museum exhibition.`,
        `Local architecture magazine nominates the half-open drawer for cutting-edge interior design.`,
        `Carpentry historians confirm the wardrobe has declared sovereign open-storage territory.`,
        `National museum opens temporary annex directly inside the dresser's top drawer.`,
      ];
      return {
        gentle: gentleList[seed % gentleList.length],
        playful: playfulList[seed % playfulList.length],
        exaggerated: exaggeratedList[seed % exaggeratedList.length],
      };
    }

    // E. Readiness vs delay (e.g. "takes forever to get ready")
    if (type === "readiness_vs_delay") {
      const gentleList = [
        "Getting ready seems to be a little scenic journey of its own.",
        "Taking a few extra mindful minutes before stepping out into the busy world.",
        "An unhurried morning rhythm where outfits and smiles take their sweet time.",
        "Making sure everyone steps out the door feeling completely wonderful.",
      ];
      const playfulList = [
        "Leaving the house apparently requires a full pre-departure ceremonial countdown.",
        "Operating on artisanal scenic time rather than high-speed departure time.",
        "Putting on shoes treated as a complex multi-stage aerospace launch procedure.",
        "Today's departure is running on boutique, handcrafted schedule time.",
      ];
      const exaggeratedList = [
        "Mission control has postponed launch until the final outfit receives complete clearance.",
        "Flight controllers request permission to coordinate our front door departure window.",
        "Global standard time zones suspended in the hallway while keys and wallet are located.",
        "Airport officials dispatch shuttle buses to escort us across the remaining five feet to the door.",
      ];
      return {
        gentle: gentleList[seed % gentleList.length],
        playful: playfulList[seed % playfulList.length],
        exaggerated: exaggeratedList[seed % exaggeratedList.length],
      };
    }

    // F. Decision vs indecision (e.g. "never decides where to eat")
    if (type === "decision_vs_indecision") {
      const gentleList = [
        "Two thoughtful appetites taking their sweet time to find the coziest meal.",
        "A quiet culinary pause while we wait for our stomachs to agree on something comforting.",
        "Dreaming together about all the delicious dinner possibilities in the neighborhood.",
        "Taking our time because sharing a meal is always the sweetest part of the evening.",
      ];
      const playfulList = [
        "Tonight's dinner choice is currently in its fifth round of parliamentary debate.",
        "A mystery game where neither of us wants to hold the sacred takeaway menu.",
        "The fridge is hosting a philosophical summit on the true meaning of dinner options.",
        "Waiting for an inspirational dinner vision to arrive by express courier.",
      ];
      const exaggeratedList = [
        "Supreme domestic council declares an emergency recess while the dinner ballot is recounted.",
        "Historians study ancient parchment treaties trying to establish who last picked the restaurant.",
        "United Nations food summit convened to resolve the great Friday evening takeaway dilemma.",
        "International mediators arrive with emergency menus to establish a dinner ceasefire.",
      ];
      return {
        gentle: gentleList[seed % gentleList.length],
        playful: playfulList[seed % playfulList.length],
        exaggerated: exaggeratedList[seed % exaggeratedList.length],
      };
    }

    // G. Attention vs distraction (e.g. "scrolling on phone during dinner")
    if (type === "attention_vs_distraction") {
      const gentleList = [
        "The phone was curious and wanted to see what was for dinner too.",
        "A gentle reminder that the best story tonight is sitting right across the table.",
        "A little device resting nearby, waiting for human conversation to take center stage.",
        "Ears and hearts gently tuning back into the warmest frequency in the room.",
      ];
      const playfulList = [
        "The smartphone has officially been granted an honorary guest seat at our table.",
        "A multi-tasking champion attempting to chew, nod, and scroll the global news simultaneously.",
        "Table manners updated to include an honorary digital appetizer of notifications.",
        "The phone seems convinced that dinner requires three fresh memes for proper digestion.",
      ];
      const exaggeratedList = [
        "Phone petitions court to be legally recognized as an essential biological dinner companion.",
        "Guinness world record set for balancing a fork while scrolling sixteen miles of feeds.",
        "Smartphone receives formal dinner toast for flawless attendance at every meal this week.",
        "Scientists declare illuminated screens and dinner plates have formed an unbreakable bond.",
      ];
      return {
        gentle: gentleList[seed % gentleList.length],
        playful: playfulList[seed % playfulList.length],
        exaggerated: exaggeratedList[seed % exaggeratedList.length],
      };
    }
  }

  // 3. Behavioral topic: Mocking / teasing (e.g. "Mocking everyone all the time")
  if (situation.behaviors.includes("mocking or teasing") || situation.primaryTopic === "interpersonal_mocking") {
    const gentleList = [
      "A quiet reminder that teasing is only funny when everyone in the room is laughing.",
      "A clear pause for the jokes to take a rest so kindness can be heard properly.",
      "A quiet moment to step away from sharp humor and let plain warmth take center stage.",
      "A healthy breath to make sure respect and kindness always come before the punchline.",
    ];
    const playfulList = [
      "The household stand-up comedy routine ran well past its scheduled curtain call.",
      "Someone left the comedy channel on high volume when plain conversation was requested.",
      "The home roast department is officially closed for an unscheduled public intermission.",
      "A stand-up routine that urgently needs to pack up its microphone and exit the stage.",
    ];
    const exaggeratedList = [
      "Breaking: comedy club union called to order as satire quotas exceed all legal limits.",
      "Stand-up comedy special enters fourth consecutive hour despite an empty auditorium.",
      "Supreme domestic tribunal issues immediate cease-and-desist order to the roast department.",
      "National satire board suspends broadcast license until genuine compliments are restored.",
    ];
    return {
      gentle: gentleList[seed % gentleList.length],
      playful: playfulList[seed % playfulList.length],
      exaggerated: exaggeratedList[seed % exaggeratedList.length],
    };
  }

  // 4. Quantity and proportion quirk (e.g. "making tea with just water and namesake milk")
  if (situation.linguistic.quantityModifier?.type === "negligible" || situation.primaryTopic === "kitchen_tea_coffee") {
    const targetItem = situation.linguistic.quantityModifier?.target || "milk";
    const gentleList = [
      `A quiet cup of tea where the ${targetItem} seems to have made a very brief ceremonial appearance.`,
      `A warm brew that is celebrating the pure spirit of water with just a whisper of ${targetItem}.`,
      `A cup of tea where the ${targetItem} politely waved hello from across the room.`,
      `A gentle minimalist recipe where ${targetItem} is included strictly in honorary spirit.`,
    ];
    const playfulList = [
      `The ${targetItem} in this tea was apparently added via telepathy from three feet away.`,
      `Today's tea recipe features hot water and a faint rumor of ${targetItem}.`,
      `A minimalist cup where the ${targetItem} was invited only as an honorary guest speaker.`,
      `The tea was introduced to the ${targetItem} carton for exactly three seconds.`,
    ];
    const exaggeratedList = [
      `Laboratory analysis confirms the tea contains three parts per billion of homeopathic ${targetItem}.`,
      `The milk carton files legal notice claiming its reputation was used in name only today.`,
      `International culinary tribunal investigates the mystery of the invisible ${targetItem} droplet.`,
      `Archaeologists discover trace elements of ${targetItem} lingering near the teaspoon.`,
    ];
    return {
      gentle: gentleList[seed % gentleList.length],
      playful: playfulList[seed % playfulList.length],
      exaggerated: exaggeratedList[seed % exaggeratedList.length],
    };
  }

  // 5. Selectively avoided chores / washing utensils (e.g. "Not washing big utensils ever.")
  if (situation.behaviors.includes("washing dishes or utensils") || situation.primaryTopic === "dishes_sink_piled") {
    const isUtensilsOrPots = situation.entities.some(e => /utensil|pot|pan/i.test(e)) || /utensil|pot|pan/i.test(situation.rawText);
    const hasNegation = situation.linguistic.hasNegation;
    if (isUtensilsOrPots && hasNegation) {
      const gentleList = [
        "The big pots seem to enjoy taking an extended holiday in the sink while the small plates get all the attention.",
        "A quiet sink where the large utensils are patiently waiting for their VIP spa session.",
        "The giant cookware resting quietly, waiting for someone brave enough to tackle their majestic size.",
        "A sink where tiny spoons wash away easily while the heavyweight cookware awaits its grand finale.",
      ];
      const playfulList = [
        "The small spoons received immediate bath privileges while the big utensils were left on the waiting list.",
        "The giant pots have officially filed for diplomatic immunity from the evening dish cycle.",
        "Selective dishwashing strategy successfully executed: all tiny mugs clean, big utensils completely ignored.",
        "The large cooking pot has established permanent squatter rights next to the kitchen tap.",
      ];
      const exaggeratedList = [
        "The giant pot has declared itself an immovable historical landmark in the center of the kitchen sink.",
        "Archaeologists arrive to survey the monumental bronze-age cookware resting undefeated by the tap.",
        "Heavy machinery dispatch requested to negotiate the washing of today's oversized kitchen cookware.",
        "National sink commission confirms large pots are officially exempt from the dishwasher treaty.",
      ];
      return {
        gentle: gentleList[seed % gentleList.length],
        playful: playfulList[seed % playfulList.length],
        exaggerated: exaggeratedList[seed % exaggeratedList.length],
      };
    }
  }

  // 4. Recognized Taxonomy Topic Match
  if (situation.primaryTopic) {
    const topic = SEMANTIC_TOPICS.find((t) => t.id === situation.primaryTopic);
    if (topic) {
      const gList = topic.toneProfiles.gentle;
      const pList = topic.toneProfiles.playful;
      const eList = topic.toneProfiles.exaggerated;
      return {
        gentle: gList[seed % gList.length],
        playful: pList[seed % pList.length],
        exaggerated: eList[seed % eList.length],
      };
    }
  }

  // 5. Physical Object Fallback (Personification H1)
  if (situation.entities.length > 0) {
    const ent = situation.entities[0];
    const loc = situation.location || "around the house";
    const gentleList = [
      `That little ${ent} seems quite happy resting quietly right where it is.`,
      `A soft pause where the ${ent} is taking an unhurried resting break ${loc}.`,
      `The ${ent} appears perfectly content enjoying its quiet little afternoon moment.`,
    ];
    const playfulList = [
      `The ${ent} has apparently decided to test our daily observation skills today.`,
      `The ${ent} is currently auditioning for an independent living room art exhibition.`,
      `Apparently the ${ent} operates on its own mysterious, free-range domestic schedule.`,
    ];
    const exaggeratedList = [
      `Breaking: the ${ent} has officially declared sovereignty over that corner of the room.`,
      `Alert: international design critics praise the bold avant-garde placement of the ${ent}.`,
      `Scientific expedition dispatched to observe the legendary migrating habits of the ${ent}.`,
    ];
    return {
      gentle: gentleList[seed % gentleList.length],
      playful: playfulList[seed % playfulList.length],
      exaggerated: exaggeratedList[seed % exaggeratedList.length],
    };
  }

  // 6. Non-object, situational or ambiguous fallback (clean, non-therapeutic, relatable)
  const gentleList = [
    "A small everyday moment that just asks for a calm breath and an unhurried perspective.",
    "A peaceful breath to pause and keep the day feeling grounded and light.",
    "A quiet pause while today's unexpected little detour sorts itself out.",
  ];
  const playfulList = [
    "Today's routine appears to have pressed its own domestic pause button.",
    "A classic little plot twist in today's shared domestic adventure.",
    "Today's household schedule took an unscheduled scenic detour of its own.",
  ];
  const exaggeratedList = [
    "The current moment has officially declared an unscheduled afternoon recess.",
    "Historians document this unprecedented pause in domestic operations.",
    "Domestic observers announce an emergency intermission in the daily routine.",
  ];

  return {
    gentle: gentleList[seed % gentleList.length],
    playful: playfulList[seed % playfulList.length],
    exaggerated: exaggeratedList[seed % exaggeratedList.length],
  };
}
