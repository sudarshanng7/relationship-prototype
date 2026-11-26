"""
scripts/knowledge/rebuild_humor_constructions_v3.py

Builds authentic, warm, observational PG-HKB constructions with:
- Strict polarity compatibility (active/repeated/excessive vs negated/omitted/incomplete/delayed)
- Genuine humorFamily diversity (observational_warmth, playful_comparison, everyday_irony, gentle_personification, situational_exaggeration, <=10% occasional_mock_authority)
- Cross-domain contamination elimination (houseplants stay botanical, milk cartons stay fridge/dairy, sofa crumbs stay crumbs+sofa)
- Zero duplicate structures
"""

import json

print("--- Building Polarity-Aware Authentic PG-HKB Constructions (v3) ---")

constructions = []
c_idx = 1

def add_set(pid, name, mech, opp, pols, fam, gentle, playful, exaggerated, req_roles=None):
    global c_idx
    tones = [("gentle", gentle), ("playful", playful), ("exaggerated", exaggerated)]
    for tone, tmpl in tones:
        constructions.append({
            "id": f"pgc3_{c_idx:03d}_{pid}_{tone}",
            "structuralPatternId": f"v3_{pid}_{tone}",
            "name": f"{name} ({tone})",
            "patternName": pid,
            "humorOpportunity": opp,
            "mechanismId": mech,
            "humorFamily": fam if tone != "exaggerated" else ("situational_exaggeration" if fam != "occasional_mock_authority" else fam),
            "compatiblePolarities": pols,
            "requiredRoles": req_roles or [],
            "supportedConceptTypes": ["action", "physical_object", "ingredient", "activity", "behavior"],
            "compatibleModifiers": [],
            "grammarTemplate": tmpl,
            "tone": tone,
            "sensitivityRestrictions": ["ordinary_quirk"] if opp != "boundary_dignity" else ["boundary_concern", "serious_unsafe"],
            "sourceIds": ["purple-garden-original"]
        })
        c_idx += 1

# =========================================================================
# 1. WASHING & CLEANING — STRICT POLARITY SEPARATION (Section 7 critical!)
# =========================================================================

# 1A. ACTIVE / REPEATED / EXCESSIVE SCRUBBING OR WASHING ("keeps scrubbing the cast iron skillet", "scrubs excessively")
add_set(
    "active_scrub_shine_obs", "Dedicated Scrubbing Polishing", "mech_observational_parody",
    "active_cleaning_vigor", ["active", "repeated", "excessive"], "observational_warmth",
    "Giving that {target} a dedicated {action} session with plenty of quiet care in the {location}.",
    "Putting enough energy into {action} the {target} that you can practically see tomorrow's dinner reflected in it.",
    "Scrubbing the {target} so enthusiastically you could use it as a shaving mirror by morning.",
    ["target"]
)
add_set(
    "active_scrub_cardio_comp", "Sink-Side Workout", "mech_unexpected_profession",
    "active_cleaning_vigor", ["active", "repeated", "excessive"], "playful_comparison",
    "Turning evening kitchen cleanup into an unhurried {action} ritual with the {target}.",
    "Counting today's marathon {action} session on the {target} as a full upper-body arm workout.",
    "Polishing that {target} hard enough to erase seasoning from three apartments ago.",
    ["target"]
)
add_set(
    "active_scrub_irony", "Spotless Shine Standard", "mech_understatement_minimalism",
    "active_cleaning_vigor", ["active", "repeated", "excessive"], "everyday_irony",
    "A patient, thorough round of {action} making sure the {target} shines completely.",
    "Someone clearly refuses to stop {action} until the {target} looks brand new out of the box.",
    "Putting so much elbow grease into {action} that the kitchen tap asked for a water break.",
    ["target"]
)

# 1B. SELECTIVE AVOIDANCE / NEGATED WASHING ("Not washing big utensils ever", "Never washes the big pans")
add_set(
    "selective_avoid_vip", "Small Spoon Favoritism", "mech_understatement_minimalism",
    "selective_chore_avoidance", ["negated", "avoided", "incomplete"], "everyday_irony",
    "Tiny spoons got an easy quick rinse while the big {target} quietly waited its turn.",
    "Everything smaller than a saucer got spotless right away while the giant {target} slid to the back of the sink line.",
    "The forks walked out sparkling in thirty seconds while that oversized {target} packed an overnight bag by the faucet.",
    ["target"]
)
add_set(
    "selective_avoid_size_obs", "Heavyweight Cookware Pass", "mech_observational_parody",
    "selective_chore_avoidance", ["negated", "avoided", "incomplete"], "playful_comparison",
    "A sink where light cutlery washes easily and heavyweight {target} wait for brave evening hands.",
    "Selective dishwashing diplomacy: cups get instant attention while heavy {target} quietly stay off the roster.",
    "Treating that big {target} like a museum boulder nobody is quite strong enough to lift toward the sponge.",
    ["target"]
)
add_set(
    "selective_avoid_personify", "Patient Big Cookware", "mech_harmless_personification",
    "selective_chore_avoidance", ["negated", "avoided", "incomplete"], "gentle_personification",
    "The large {target} resting patiently beside the drain while small plates finish their wash.",
    "Small spoons earned priority express service while the bulky {target} patiently watched from the sidelines.",
    "That massive {target} practically owns the left corner of the sink like rent-free studio real estate.",
    ["target"]
)

# 1C. OMITTED / SOAKING / DELAYED WASHING ("Leaves the pans soaking", "Takes forever to wash the pans")
add_set(
    "soak_omission_spa", "The Overnight Sink Soak", "mech_harmless_personification",
    "dish_soak_omission", ["omitted_forgotten", "delayed"], "gentle_personification",
    "The {target} in the {location} taking a quiet evening soak until someone meets them with soap.",
    "Apparently the {target} need a full twenty-four-hour warm bubble bath before anyone dares introduce a sponge.",
    "Those {target} have settled into the sink water like retired ducks refusing to leave a warm pond.",
    ["target"]
)
add_set(
    "soak_omission_delayed", "Heirloom Cleaning Tempo", "mech_timing_anticlimax",
    "dish_soak_omission", ["omitted_forgotten", "delayed"], "playful_comparison",
    "Taking an unhurried evening pause before tackling those soaking {target} in the {location}.",
    "Treating a single {target} wash with the slow, deliberate concentration of restoring a priceless oil painting.",
    "At this relaxed pace, the {target} will finish drying from old age before the sponge arrives.",
    ["target"]
)
add_set(
    "soak_omission_irony", "Strategic Soaking Excuse", "mech_observational_parody",
    "dish_soak_omission", ["omitted_forgotten", "delayed"], "everyday_irony",
    "Leaving the {target} soaking calmly while the rest of the kitchen winds down for the night.",
    "Calling it 'letting the {target} soak' is the most polite domestic phrasing for 'tomorrow's problem'.",
    "Four consecutive nights of strategic soaking have turned that pan into permanent kitchen furniture.",
    ["target"]
)

# =========================================================================
# 2. BEVERAGE PREPARATION & INGREDIENT RATIOS (tea/espresso + namesake milk)
# =========================================================================
add_set(
    "bev_whisper_warmth", "Symbolic Dairy Greeting", "mech_understatement_minimalism",
    "negligible_quantity", ["active", "incomplete", "omitted_forgotten"], "observational_warmth",
    "A warm cup of {beverage} where the {additive} politely waved hello from across the counter.",
    "This {beverage} recipe mostly relies on hot water and a brave, optimistic rumor of {additive}.",
    "Holding the {additive} bottle gently near the kettle and letting pure imagination color the {beverage}.",
    ["beverage", "additive"]
)
add_set(
    "bev_guestbook_comp", "Honorary Drop", "mech_understatement_minimalism",
    "negligible_quantity", ["active", "incomplete"], "playful_comparison",
    "An unhurried mug of {beverage} celebrating warm water with just a tiny hint of {additive}.",
    "When water works the whole nine-to-five shift and the {additive} drops by just to sign the guestbook.",
    "Using barely enough {additive} to tint a teaspoon while promising it counts as a creamy {beverage}.",
    ["beverage", "additive"]
)
add_set(
    "bev_photo_irony", "Telepathic Pour", "mech_observational_parody",
    "negligible_quantity", ["active", "incomplete"], "everyday_irony",
    "A minimalist mug of {beverage} with only the faintest whisper of {additive}.",
    "That {beverage} looks like {additive} was introduced to the mug via a polite photograph.",
    "Three molecules of {additive} nervously swimming across a whole ocean of hot {beverage}.",
    ["beverage", "additive"]
)

# =========================================================================
# 3. SPEAKING VOLUME, PHONE CALLS & SERIOUS-MOOD CONTRASTS
# =========================================================================
add_set(
    "phone_auditorium_warmth", "Living Room Broadcast", "mech_scale_acoustic_distortion",
    "excessive_volume", ["active", "repeated", "excessive"], "observational_warmth",
    "A lively {device} call making sure every corner of the room stays warmly up to date.",
    "Apparently this {device} call came with complimentary front-row seats for the rest of the apartment.",
    "Speaking loud enough into the {device} that cell towers can safely take the rest of the afternoon off.",
    ["device"]
)
add_set(
    "phone_outdoor_irony", "Outdoor Voice Indoors", "mech_scale_acoustic_distortion",
    "excessive_volume", ["active", "repeated", "excessive"], "everyday_irony",
    "An enthusiastic conversation that gently wandered straight into cheerful outdoor volume.",
    "Someone's indoor volume dial quietly skipped past cozy chat to full stadium announcer mode.",
    "Even the hallway shoes are getting a crystal-clear live recap of tonight's {device} conversation.",
    ["device"]
)
add_set(
    "phone_neighbor_comp", "No Speaker Needed", "mech_observational_parody",
    "excessive_volume", ["active", "repeated", "excessive"], "playful_comparison",
    "Friendly energy on the {device} carrying right across the whole living space.",
    "With projection like that, the phone microphone barely needs to clock into work today.",
    "Volume warm enough to skip satellites entirely and shout hello across two zip codes.",
    ["device"]
)

add_set(
    "serious_contrast_soundtrack", "Unscripted Soundtrack", "mech_timing_anticlimax",
    "context_interruption", ["active", "repeated", "excessive"], "everyday_irony",
    "A thoughtful moment during {context} that picked up a tiny surprise soundtrack of its own.",
    "Trying to focus during {context} apparently comes with complimentary live sound effects today.",
    "Our quiet {context} just received a bold avant-garde acoustic cameo nobody put on the agenda.",
    ["context"]
)
add_set(
    "serious_contrast_whisper", "Focus Bubble Interrupt", "mech_whisper_monastery",
    "context_interruption", ["active", "repeated", "excessive"], "observational_warmth",
    "A playful spark popping up right beside someone's quiet concentration during {context}.",
    "Funny how the loudest energy always arrives the exact second {context} asks for stillness.",
    "Quiet {context} gracefully surviving a surprise one-person variety show from across the room.",
    ["context"]
)
add_set(
    "serious_contrast_comp", "Split-Screen Mood", "mech_observational_parody",
    "context_interruption", ["active", "repeated", "excessive"], "playful_comparison",
    "Two completely different moods sharing the exact same minute during {context}.",
    "One half of the room is deep in {context} while the other half brought festival energy.",
    "Attempting solemn {context} while someone cheerfully improvises background foley effects beside the desk.",
    ["context"]
)

# =========================================================================
# 4. HOUSEPLANTS, PETS, CARTONS, FURNITURE, DRAWERS & DISPLACEMENT (Zero leaks!)
# =========================================================================
add_set(
    "plant_hydration_gentle", "Thirsty Window Sill", "mech_harmless_personification",
    "care_routine", ["omitted_forgotten", "negated", "delayed", "repeated"], "gentle_personification",
    "The {target} resting patiently on the sill, quietly hoping for a refreshing sip of water.",
    "That leafy {target} gently cleared its throat to ask if today finally counts as watering day.",
    "The living room {target} is dropping dramatic hints toward the watering can like a thirsty cactus.",
    ["target"]
)
add_set(
    "plant_botanical_comp", "Soil Humidity Watch", "mech_observational_parody",
    "care_routine", ["omitted_forgotten", "negated", "delayed", "repeated"], "playful_comparison",
    "Giving our leafy {target} a gentle wave while remembering how long soil stays patient.",
    "The {target} seems to be testing whether indoor photosynthesis works purely on good intentions.",
    "One quick sprinkle from the kettle might save that {target} from drafting a polite complaint letter.",
    ["target"]
)
add_set(
    "plant_warm_irony", "Green Roommate Patience", "mech_understatement_minimalism",
    "care_routine", ["omitted_forgotten", "negated", "delayed", "repeated"], "everyday_irony",
    "A small reminder that green housemates like the {target} appreciate an occasional drink too.",
    "Our patient {target} appears convinced we're testing how drought-resistant indoor living can get.",
    "Even the plastic flower pots look nervous watching how long the {target} waited between waterings.",
    ["target"]
)

add_set(
    "empty_fridge_carton", "Ghost Milk Carton", "mech_harmless_personification",
    "empty_container_fridge", ["omitted_forgotten", "repeated"], "everyday_irony",
    "An empty {target} resting peacefully on the fridge shelf just to keep the cold air company.",
    "Putting an empty {target} back in the refrigerator for optimal freshness of pure chilled air.",
    "That feather-light {target} stayed chilly all night guarding exactly zero drops of milk inside.",
    ["target"]
)
add_set(
    "empty_fridge_decoy", "Cold Air Reserve", "mech_observational_parody",
    "empty_container_fridge", ["omitted_forgotten", "repeated"], "playful_comparison",
    "Finding a featherweight {target} waiting optimistically inside the cool fridge door.",
    "Opening the fridge for breakfast and shaking hands with an empty {target} decoy.",
    "Chilling an empty {target} to forty degrees just so tomorrow morning's coffee gets a plot twist.",
    ["target"]
)
add_set(
    "empty_fridge_warmth", "Chilled Souvenir", "mech_understatement_minimalism",
    "empty_container_fridge", ["omitted_forgotten", "repeated"], "observational_warmth",
    "A funny little fridge surprise where the {target} held onto its shelf spot long after finishing.",
    "That {target} clearly got attached to the top fridge shelf and wasn't ready to say goodbye.",
    "Maintaining strict refrigerator climate control over an empty {target} weighing half an ounce.",
    ["target"]
)

add_set(
    "drawer_ajar_warmth", "Halfway Open Policy", "mech_harmless_personification",
    "partial_closure", ["incomplete", "repeated", "omitted_forgotten"], "gentle_personification",
    "The {target} politely peeking halfway out just to check how the bedroom is doing.",
    "Our {target} appear convinced that closing all the way is an overly strict domestic tradition.",
    "Leaving the {target} propped half open like an inviting boutique display of folded sweaters.",
    ["target"]
)
add_set(
    "drawer_ajar_comp", "Artisanal Peek", "mech_observational_parody",
    "partial_closure", ["incomplete", "repeated", "omitted_forgotten"], "playful_comparison",
    "Storage doors pausing mid-journey so clothes and socks can get a little fresh breeze.",
    "An open-door policy ensuring every sock in the {target} keeps a clear view of the room.",
    "The {target} gently stopped at forty-five degrees just in case someone forgot what lives inside.",
    ["target"]
)
add_set(
    "drawer_ajar_irony", "Closing Is Optional", "mech_understatement_minimalism",
    "partial_closure", ["incomplete", "repeated", "omitted_forgotten"], "everyday_irony",
    "A familiar sight where the {target} took a cozy breather halfway back into place.",
    "Apparently pushing the {target} the final two inches counts as an unnecessary extra step.",
    "Every single handle on the {target} standing ready at staggered heights like a piano keyboard.",
    ["target"]
)

add_set(
    "displacement_warmth", "Cozy Scenic Resting Spot", "mech_observational_parody",
    "object_displacement", ["active", "repeated", "omitted_forgotten"], "observational_warmth",
    "Little hints of {target} making themselves right at home around the {location}.",
    "Apparently the {target} decided living out in the open on the {location} beats sitting in a drawer.",
    "Leaving a gentle trail of {target} across the {location} so nobody forgets how cozy the evening was.",
    ["target", "location"]
)
add_set(
    "displacement_comp", "Free-Range Placement", "mech_harmless_personification",
    "object_displacement", ["active", "repeated", "omitted_forgotten"], "playful_comparison",
    "The {target} taking an unhurried little break right there by the {location}.",
    "Today's {target} seem to prefer free-range living across the {location} instead of proper storage.",
    "Our {location} gracefully doubles as a cozy showcase for wandering {target} all week long.",
    ["target", "location"]
)
add_set(
    "displacement_irony", "Living Room Trail", "mech_understatement_minimalism",
    "object_displacement", ["active", "repeated", "omitted_forgotten"], "everyday_irony",
    "One tiny domestic reminder that {target} always find their way toward the {location}.",
    "Funny how the {location} quietly collects every wandering {target} within five feet.",
    "Finding scattered {target} around the {location} like golden breadcrumbs from last night's chill.",
    ["target", "location"]
)

# =========================================================================
# 5. SLEEP, BODILY ACOUSTICS, APPLIANCES, PUNCTUALITY & PREFERENCES
# =========================================================================
add_set(
    "sleep_acoustics_warmth", "Pillow Acoustics", "mech_soundtrack_drama",
    "bodily_habit", ["active", "repeated", "excessive"], "observational_warmth",
    "Cozy nighttime acoustics adding their own gentle unscripted sound effects to the bedroom.",
    "Sleep in our bedroom apparently comes with a complimentary late-night percussion and brass section.",
    "Bedside pillows quietly wishing for tiny velvet earmuffs during tonight's marathon bedroom orchestra.",
    []
)
add_set(
    "sleep_acoustics_comp", "Midnight Soundboard", "mech_observational_parody",
    "bodily_habit", ["active", "repeated", "excessive"], "playful_comparison",
    "Familiar late-night rhythms turning quiet bedtime breathing into a cozy acoustic backdrop.",
    "Our evening soundtrack drifts cheerfully between gentle purring acoustics and sudden solo trombone energy.",
    "Even the ceiling fan paused to admire the resonant acoustics echoing smoothly across the bedroom.",
    []
)
add_set(
    "sleep_acoustics_irony", "Living Room Encore", "mech_understatement_minimalism",
    "bodily_habit", ["active", "repeated", "excessive"], "everyday_irony",
    "Everyday digestive and sleepy sound effects showing up right on cue when the house goes quiet.",
    "Zero rehearsal required for an impromptu evening symphony of cozy yawns, burps, and snores.",
    "If sleep sound effects earned royalties, our bedroom acoustics would be topping acoustic charts weekly.",
    []
)

add_set(
    "sleep_duvet_comp", "Midnight Blanket Gravity", "mech_observational_parody",
    "sleep_disruption", ["active", "repeated", "excessive"], "playful_comparison",
    "The blanket drifting gently across the bed to keep one cozy side extra tucked in.",
    "Nighttime gravity clearly tilts steadily toward one lucky half of the mattress.",
    "Waking up at three in the morning negotiating peacefully for six inches of shared duvet.",
    []
)
add_set(
    "sleep_duvet_warmth", "Cozy Cocoon Magnet", "mech_harmless_personification",
    "sleep_disruption", ["active", "repeated", "excessive"], "observational_warmth",
    "Somehow ninety percent of the shared blanket quietly migrated west before midnight.",
    "That fluffy duvet apparently signed an exclusive residency lease on just one side of the bed.",
    "One warm burrito sleeper and one shivering blanket negotiator sharing the same cozy mattress.",
    []
)
add_set(
    "sleep_duvet_irony", "Great Quilt Migration", "mech_understatement_minimalism",
    "sleep_disruption", ["active", "repeated", "excessive"], "everyday_irony",
    "Evening sleep turning quietly into a slow-motion tug-of-war with the bedroom blanket.",
    "Funny how a king-sized blanket shrinks to a pocket handkerchief by two in the morning.",
    "Someone wrapped themselves like a winter croissant leaving half an inch of sheet in arbitration.",
    []
)

add_set(
    "alarm_snooze_irony", "Snooze Encore", "mech_timing_anticlimax",
    "alarm_delay", ["active", "repeated", "delayed", "excessive"], "everyday_irony",
    "A polite morning chorus of five-minute chimes easing gently out of cozy dreams.",
    "Seven consecutive alarms just to be gently acquainted with the general rumor of morning.",
    "The alarm clock happily performed six encores while both eyes stayed loyally shut.",
    []
)
add_set(
    "alarm_snooze_warmth", "Gentle Wakeup Series", "mech_observational_parody",
    "alarm_delay", ["active", "repeated", "delayed", "excessive"], "observational_warmth",
    "Soft morning bells taking seven gentle tries to coax sleepy eyes toward coffee.",
    "Apparently waking up requires a full seven-episode morning countdown before feet touch the rug.",
    "Even the coffee kettle sighed lovingly while alarm number eight played its farewell reprise.",
    []
)
add_set(
    "alarm_snooze_comp", "Morning Encore Club", "mech_harmless_personification",
    "alarm_delay", ["active", "repeated", "delayed", "excessive"], "playful_comparison",
    "Morning routines starting slowly with an unhurried playlist of five-minute alarm reminders.",
    "Someone treats the alarm snooze button like a polite morning intermission bell.",
    "Eight generous snooze buttons later, even the pillow politely asked what time work starts.",
    []
)

add_set(
    "appliance_standby_warmth", "Always-Ready Appliance", "mech_harmless_personification",
    "unstarted_appliance", ["active", "repeated", "negated", "omitted_forgotten", "incomplete"], "gentle_personification",
    "The {target} is waiting calmly in case anyone wants to press go—or switch off—in a moment.",
    "Apparently the {target} thinks turning completely off or pressing start requires a formal reminder.",
    "That patient {target} standing ready in standby mode like it expects an engraved invitation.",
    ["target"]
)
add_set(
    "appliance_standby_irony", "Loaded And Waiting", "mech_understatement_minimalism",
    "unstarted_appliance", ["active", "repeated", "negated", "omitted_forgotten", "incomplete"], "everyday_irony",
    "A quiet pause where the {target} stayed paused right before its final button press.",
    "Filling or flipping the {target} all the way except the one cheerful fingertip press at the end.",
    "That {target} is sitting poised at ninety-nine percent completion waiting for someone to whisper start.",
    ["target"]
)
add_set(
    "appliance_standby_comp", "Idle Button Mystery", "mech_observational_parody",
    "unstarted_appliance", ["active", "repeated", "negated", "omitted_forgotten", "incomplete"], "playful_comparison",
    "An unhurried habit where the {target} hangs out halfway between off duty and active service.",
    "Our {target} seems to believe thoughtful visual preparation counts as half a finished cycle.",
    "Even the wall outlet wondered politely if anyone plans to tap the button on that {target}.",
    ["target"]
)

add_set(
    "climate_contrast_comp", "Micro-Climate Negotiation", "mech_weather_forecast",
    "micro_climate", ["active", "repeated", "excessive"], "playful_comparison",
    "One side of the blanket votes cozy winter while the other votes refreshing cool breeze.",
    "The {target} is quietly mediating between crisp winter glacier and sunny greenhouse preferences.",
    "Two loving partners sharing one living room while dressing for two completely separate seasons.",
    ["target"]
)
add_set(
    "climate_contrast_warmth", "Two-Season Living Room", "mech_observational_parody",
    "micro_climate", ["active", "repeated", "excessive"], "observational_warmth",
    "Balancing sweaters and breezes gracefully around a very popular indoor {target}.",
    "Our {target} works overtime running an Arctic resort for one chair and tropical patio for the next.",
    "One flick of the {target} dial and half the couch puts on wool socks for August.",
    ["target"]
)
add_set(
    "climate_contrast_irony", "Indoor Thermostat Weather", "mech_understatement_minimalism",
    "micro_climate", ["active", "repeated", "excessive"], "everyday_irony",
    "Quietly negotiating our favorite cozy degree setting on the household {target}.",
    "Apparently the {target} is the only peacekeeper balancing Nordic winter against cozy sauna energy.",
    "Checking indoor climate forecasts before walking past the {target} into the kitchen.",
    ["target"]
)

add_set(
    "punctuality_warmth", "Artisanal Departure Time", "mech_timing_anticlimax",
    "timing_delay", ["delayed", "repeated", "excessive"], "observational_warmth",
    "Stepping out the door gets a few extra mindful warm-up minutes before heading out.",
    "Today's departure clearly runs on cozy handcrafted time rather than brisk hallway clocks.",
    "Putting on shoes by the front door somehow turned into an unhurried twenty-minute ceremony.",
    []
)
add_set(
    "punctuality_keys_irony", "Front Door Ritual", "mech_observational_parody",
    "timing_delay", ["delayed", "repeated", "excessive"], "everyday_irony",
    "Waiting by the doorway with coat on while one last essential item plays hide and seek.",
    "Every quick trip out the front door seems to include an optional last-minute scavenger hunt.",
    "Hands on the doorknob ready to go while keys and sunglasses finish their closing credits.",
    []
)
add_set(
    "punctuality_clock_comp", "Leisurely Timetable", "mech_understatement_minimalism",
    "timing_delay", ["delayed", "repeated", "excessive"], "playful_comparison",
    "Treating departure countdowns as gentle friendly suggestions rather than strict train schedules.",
    "Five minutes to get ready somehow speaks the same language as a cozy half-hour scenic tour.",
    "Our calendar insists it is late while somebody strolls calmly into their second jacket check.",
    []
)

add_set(
    "screen_guest_warmth", "Pocket Guest Seat", "mech_observational_parody",
    "attention_distraction", ["active", "repeated", "omitted_forgotten"], "observational_warmth",
    "A quick pause where the screen pulled up a tiny chair right beside our conversation.",
    "The phone clearly worried it might miss tonight's stories if it stayed peacefully in a pocket.",
    "Scrolling feeds and passing dinner bowls simultaneously like an Olympic multi-tasking exhibition.",
    []
)
add_set(
    "screen_guest_comp", "Two Conversations At Once", "mech_understatement_minimalism",
    "attention_distraction", ["active", "repeated", "omitted_forgotten"], "playful_comparison",
    "Tiny glowing screen updates quietly borrowing a slice of our evening conversation.",
    "Our dinner table politely competing with a pocket notification feed for headline attention.",
    "Even the salad bowl looked up to ask whether the glowing screen wanted a dinner fork too.",
    []
)
add_set(
    "screen_guest_irony", "Split Focus Companion", "mech_harmless_personification",
    "attention_distraction", ["active", "repeated", "omitted_forgotten"], "everyday_irony",
    "Sharing real-life company alongside one extra bright little screen joining from across the table.",
    "Nodding warmly on autopilot while a glowing thumb scrolls six articles ahead in thought.",
    "Three thoughtful nods per minute while both eyes faithfully babysit every banner alert.",
    []
)

add_set(
    "decision_menu_comp", "Menu Deliberation", "mech_peace_summit",
    "indecision", ["active", "delayed", "incomplete"], "playful_comparison",
    "Two thoughtful appetites taking their sweet time picking tonight's coziest dinner.",
    "Deciding where to eat quietly evolved into a polite five-round dinner brainstorm.",
    "Half an hour later, still heroically asking 'I don't mind, whatever you're craving'.",
    []
)
add_set(
    "decision_menu_warmth", "Polite Appetite Loop", "mech_observational_parody",
    "indecision", ["active", "delayed", "incomplete"], "observational_warmth",
    "Two warm hearts cheerfully tossing tonight's dinner vote gently back and forth.",
    "Every culinary suggestion wins an enthusiastic nod followed closely by 'anything else sound good?'.",
    "Forty menus reviewed lovingly with zero final verdicts before hunger calls a truce.",
    []
)
add_set(
    "decision_menu_irony", "Open-Ended Dinner Summit", "mech_understatement_minimalism",
    "indecision", ["active", "delayed", "incomplete"], "everyday_irony",
    "Unpacking tonight's dinner possibilities with all the patience of a weekend tasting menu.",
    "Choosing takeout turned gracefully into a gentle philosophical tour of every neighborhood kitchen.",
    "At this rate dessert will arrive tomorrow while dinner votes remain politely tied.",
    []
)

add_set(
    "preference_styles_irony", "Two Charming Styles", "mech_observational_parody",
    "preference_difference", ["active", "repeated", "incomplete"], "everyday_irony",
    "Two distinctly charming personal styles sharing the same cozy roof with gentle humor.",
    "Proof that two hearts can match completely while holding delightfully opposite opinions about {target}.",
    "Living peacefully side by side despite fiercely loyal opinions on how to handle {target}.",
    ["target"]
)
add_set(
    "preference_styles_warmth", "Matched Hearts Diverse Habits", "mech_understatement_minimalism",
    "preference_difference", ["active", "repeated", "incomplete"], "observational_warmth",
    "Two loving perspectives taking delightfully different creative routes around {target}.",
    "Coexisting fondly when both approaches to {target} carry completely separate rulebooks.",
    "Writing two proud rival instruction manuals for {target} while still sharing the couch.",
    ["target"]
)
add_set(
    "preference_styles_comp", "Home House-Style Variety", "mech_peace_summit",
    "preference_difference", ["active", "repeated", "incomplete"], "playful_comparison",
    "One shared home welcoming two charmingly distinct approaches toward {target}.",
    "Even with different opinions on {target}, both sides bring loyal trademark energy home.",
    "Our household quietly runs two competing fan clubs on the proper craft of {target}.",
    ["target"]
)

# =========================================================================
# 6. COMPOSITIONAL CATCH-ALLS & GENUINE MOCK AUTHORITY (<10% OCCASIONAL)
# =========================================================================
add_set(
    "comp_habit_warmth", "Grounded Everyday Habit", "mech_observational_parody",
    "compositional_habit", ["active", "repeated", "excessive", "incomplete", "negated", "omitted_forgotten", "delayed"], "observational_warmth",
    "A cozy everyday rhythm around {target} quietly adding its own personality to the house.",
    "Apparently handling {target} follows an unwritten personal tradition that nobody wrote down.",
    "The {target} taking center stage in today's unforgettable little household comedy.",
    ["target"]
)
add_set(
    "comp_habit_comp", "Unscripted Home Rhythm", "mech_harmless_personification",
    "compositional_habit", ["active", "repeated", "excessive", "incomplete", "negated", "omitted_forgotten", "delayed"], "playful_comparison",
    "One tiny everyday chapter where {target} keeps shared routines delightfully unpredictable.",
    "Funny how ordinary life with {target} always comes with an affectionate little twist.",
    "Another memorable episode in the ongoing domestic adventures starring our trusty {target}.",
    ["target"]
)
add_set(
    "comp_habit_irony", "Small Home Signature", "mech_understatement_minimalism",
    "compositional_habit", ["active", "repeated", "excessive", "incomplete", "negated", "omitted_forgotten", "delayed"], "everyday_irony",
    "Those tiny repeatable quirks with {target} give home life its warm unmistakable personality.",
    "Consistent energy around {target} keeping every ordinary week playfully lively.",
    "If household walls could chuckle, they'd definitely grin at this signature {target} routine.",
    ["target"]
)
add_set(
    "comp_mock_authority_rare", "Mock Bulletin Rare", "mech_royal_proclamation",
    "compositional_habit", ["active", "repeated", "excessive"], "occasional_mock_authority",
    "A lighthearted home headline celebrating today's quirky episode with the {target}.",
    "Unofficial living-room minutes politely note that the {target} sparked fresh comedic debate today.",
    "Breaking household bulletin: local committee grants honorary VIP status to today's {target} moment.",
    ["target"]
)

add_set(
    "boundary_respect_pause", "Autonomy & Boundary Respect", "mech_peace_summit",
    "boundary_dignity", ["refused", "negated", "repeated", "excessive"], "observational_warmth",
    "A calm space where your personal boundaries and clear 'no' deserve full respect.",
    "Honoring personal pace without pressure—your comfort and choice always come first.",
    "Respecting clear boundaries matters most; taking space to reflect privately is completely valid.",
    []
)

with open('knowledge/humor/constructions/constructions.json', 'w') as f:
    json.dump(constructions, f, indent=2)

from collections import Counter
fam_counts = Counter(c['humorFamily'] for c in constructions)
print(f"Rebuilt {len(constructions)} clean PG-HKB constructions ({len(constructions)//3} three-tone sets).")
print("HumorFamily distribution:", dict(fam_counts))
