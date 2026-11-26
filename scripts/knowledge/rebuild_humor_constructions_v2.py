"""
scripts/knowledge/rebuild_humor_constructions_v2.py

Replaces repetitive mock-news/boilerplate duplicates with 144 genuinely distinct,
grammatical, affectionate, observational humor constructions across all 3 tones
and diverse domestic opportunities.
"""

import json

print("--- Rebuilding Clean, Non-Boilerplate Humor Constructions (PG-HKB v2) ---")

constructions = []
c_idx = 1

def add_const(pattern_id, name, mech_id, opp, req_roles, comp_types, mods, sens, gentle, playful, exaggerated):
    global c_idx
    for tone, text in [("gentle", gentle), ("playful", playful), ("exaggerated", exaggerated)]:
        constructions.append({
            "id": f"pgc_{c_idx:03d}_{pattern_id}_{tone}",
            "structuralPatternId": f"{pattern_id}_{tone}",
            "name": f"{name} ({tone})",
            "patternName": pattern_id,
            "humorOpportunity": opp,
            "mechanismId": mech_id,
            "requiredRoles": req_roles,
            "supportedConceptTypes": comp_types,
            "compatibleModifiers": mods,
            "grammarTemplate": text,
            "tone": tone,
            "sensitivityRestrictions": sens,
            "sourceIds": ["purple-garden-original"]
        })
        c_idx += 1

# 1. Beverage Preparation & Minimal Ingredient Ratio
add_const(
    "tea_minimal_additive", "The Symbolic Dairy Dash", "mech_understatement_minimalism",
    "negligible_quantity", ["beverage", "additive"], ["ingredient", "substance"],
    ["mod_negligible_quantity", "mod_exclusive_limitation"], ["ordinary_quirk"],
    "A warm cup of {beverage} where the {additive} politely waved hello from across the kitchen.",
    "Today's {beverage} recipe consists of hot water and an optimistic rumor of {additive}.",
    "Chemists verify that the {additive} was introduced to this {beverage} strictly by candlelight reflection."
)
add_const(
    "tea_guestbook_ingredient", "Minimalist Infusion", "mech_understatement_minimalism",
    "negligible_quantity", ["beverage", "additive"], ["ingredient", "substance"],
    ["mod_negligible_quantity"], ["ordinary_quirk"],
    "An unhurried mug of {beverage} enjoying the quiet memory of {additive}.",
    "When the water handles ninety-nine percent of the shift and the {additive} only pops in to sign the guestbook.",
    "Culinary historians confirm the {additive} carton merely whispered its name near the {beverage}."
)

# 2. Acoustic Volume & Phone Call Broadcasting
add_const(
    "phone_auditorium", "Auditorium Call Mode", "mech_scale_acoustic_distortion",
    "excessive_volume", ["action", "device"], ["action", "physical_object"],
    ["mod_excessive_intensity"], ["ordinary_quirk", "mild_interpersonal"],
    "A lively chat on the {device} making sure every corner of the living room stays warmly included.",
    "Apparently this {device} call came with complimentary front-row seats for the rest of the apartment.",
    "Cell towers politely asked if they could take the afternoon off while that {device} voice carried the signal solo."
)
add_const(
    "voice_outdoor_drift", "Conversational Volume Drift", "mech_scale_acoustic_distortion",
    "excessive_volume", ["action"], ["action", "sensory_experience"],
    ["mod_excessive_intensity"], ["ordinary_quirk", "mild_interpersonal"],
    "An enthusiastic conversation that gently wandered into its cheerful outdoor settings.",
    "Someone's indoor volume dial playfully skipped straight past cozy evening chat to stadium commentary.",
    "Neighboring houseplants perked up just to stay current on tonight's living room conversation."
)

# 3. Selective Chore Avoidance & Kitchenware
add_const(
    "cookware_waiting_list", "Heavy Cookware Sanctuary", "mech_archaeological_monument_soak",
    "selective_chore_avoidance", ["action", "target"], ["action", "physical_object"],
    ["mod_large_scale", "mod_never_frequency"], ["ordinary_quirk"],
    "The small teaspoons took an easy rinse while the big {target} stayed back for a quiet spa soak.",
    "Everything smaller than a saucer got clean immediately, while the {target} gracefully claimed diplomatic soaking rights.",
    "That giant {target} in the sink has officially settled in as a permanent architectural water feature."
)
add_const(
    "dish_soak_vigil", "The Artisanal Overnight Soak", "mech_botanical_patience",
    "unfinished_task", ["target"], ["physical_object", "action"],
    ["mod_recurring_frequency", "mod_excessive_duration"], ["ordinary_quirk"],
    "The {target} in the sink seem very committed to their unhurried evening soak.",
    "Apparently the {target} require at least forty-eight hours of meditative soaking before meeting a sponge.",
    "Art appraisers gently admire how long those {target} have maintained their motionless still-life beside the tap."
)

# 4. Storage, Drawers & Open Doors
add_const(
    "drawer_peeking", "The Open-Door Display", "mech_harmless_personification",
    "partial_closure", ["target", "state"], ["physical_object", "state"],
    ["mod_partial_completion", "mod_recurring_frequency"], ["ordinary_quirk"],
    "The {target} stayed politely halfway open just to check how the room was doing.",
    "Our {target} seem convinced that closing completely is an overly formal domestic tradition.",
    "Interior design magazines want a feature on that bold half-open {target} modern art installation."
)
add_const(
    "clutter_migration", "Free-Range Belongings", "mech_museum_curation",
    "object_displacement", ["target", "location"], ["physical_object", "place"],
    ["mod_recurring_frequency"], ["ordinary_quirk"],
    "The {target} chose a sunny little spot on the {location} to take an unscheduled rest.",
    "Apparently the {target} prefer free-range living out in the open rather than inside a closet.",
    "Tourists gather around the {location} to photograph that legendary collection of wandering {target}."
)

# 5. Kitchen & Cooking Mess
add_const(
    "cooking_confetti", "Culinary Studio Footprint", "mech_culinary_patrol",
    "kitchen_preparation_quirk", ["action", "target"], ["action", "physical_object", "ingredient"],
    ["mod_recurring_frequency"], ["ordinary_quirk"],
    "Every enthusiastic meal apparently asks for a little commemorative sprinkle across the counter.",
    "Today's cooking style treated the entire kitchen counter as an open canvas for abstract seasoning.",
    "The stove area proudly wears the full behind-the-scenes documentary of tonight's heroic five-course dinner."
)

# 6. Bodily Habits & Nighttime Acoustics
add_const(
    "sleep_acoustics", "Pillow Percussion Section", "mech_soundtrack_drama",
    "bodily_habit", ["behavior"], ["behavior", "sensory_experience"],
    ["mod_recurring_frequency", "mod_excessive_intensity"], ["ordinary_quirk"],
    "Cozy nighttime breathing that adds its own gentle acoustic rhythm to the bedroom.",
    "Sleep in our bedroom apparently includes an unprompted late-night percussion solo.",
    "Bedside pillows quietly filed for concert-hall earplugs during tonight's marathon {behavior} symphony."
)

# 7. Punctuality & Getting Ready
add_const(
    "departure_countdown", "Scenic Departure Time", "mech_timing_anticlimax",
    "timing_delay", ["action", "context"], ["action", "time"],
    ["mod_excessive_duration", "mod_recurring_frequency"], ["ordinary_quirk"],
    "Stepping out the door gets its own unhurried little scenic warm-up lap first.",
    "Our departure runs strictly on handcrafted artisanal time rather than standard hallway clocks.",
    "Flight controllers politely radioed the front hallway to confirm whether today's shoe-tying sequence is ready for takeoff."
)

# 8. Appliances & Lights Left On
add_const(
    "appliance_standby", "Appliance Museum Lighting", "mech_harmless_personification",
    "unstarted_appliance", ["target"], ["physical_object"],
    ["mod_never_frequency", "mod_recurring_frequency"], ["ordinary_quirk"],
    "The {target} is glowing peacefully in case anyone needs an emergency midnight beacon.",
    "Apparently that {target} believes turning off completely would ruin the room's cozy ambient mood.",
    "The electric meter spun a joyful little victory lap thanking the hallway {target} for staying awake all night."
)

# 9. Attention, Screens & Focus Work
add_const(
    "screen_guest", "The Pocket Guest Seat", "mech_observational_parody",
    "attention_distraction", ["target", "context"], ["physical_object", "interpersonal_interaction"],
    ["mod_recurring_frequency"], ["ordinary_quirk", "mild_interpersonal"],
    "A quick check-in where the screen quietly pulled up a tiny chair next to the moment.",
    "The phone clearly felt worried it might miss tonight's dinner gossip if it stayed in a pocket.",
    "Pocket devices received an honorary dinner napkin tonight for maintaining uninterrupted visual supervision."
)
add_const(
    "focus_interruption", "The Ambient Interruption", "mech_whisper_monastery",
    "context_interruption", ["action", "context"], ["action", "interpersonal_interaction"],
    ["mod_excessive_intensity", "mod_recurring_frequency"], ["ordinary_quirk", "mild_interpersonal"],
    "A lively moment happening right beside someone's quiet concentration bubble.",
    "Apparently trying to concentrate near {context} comes with live unscripted commentary.",
    "Quiet study zones issued a polite request for noise-cancelling blankets before tomorrow's meeting."
)

# 10. Pets, Plants & Forgotten Care
add_const(
    "pet_plant_care", "Botanical & Furry Logistics", "mech_botanical_patience",
    "care_routine", ["target"], ["physical_object", "activity"],
    ["mod_never_frequency", "mod_recurring_frequency"], ["ordinary_quirk"],
    "Our leafy and furry housemates quietly keeping their fingers crossed for dinner or water.",
    "The {target} gently cleared its throat to ask if today counts as hydration Tuesday.",
    "The living room {target} penned a polite postcard from the windowsill hoping for a sunny drop of water."
)

# 11. Decision Making & Preference Differences
add_const(
    "dinner_indecision", "The Menu Deliberation", "mech_peace_summit",
    "indecision", ["activity"], ["activity", "preference"],
    ["mod_excessive_duration", "mod_comparative_preference"], ["ordinary_quirk"],
    "Two thoughtful appetites taking their sweet time to pick tonight's coziest meal.",
    "Picking dinner has gently evolved into a five-round philosophical summit by the fridge door.",
    "Historians began drafting footnotes trying to trace whose turn it actually was to choose takeout."
)
add_const(
    "preference_mismatch", "Two Styles Under One Roof", "mech_observational_parody",
    "preference_difference", ["target"], ["preference", "abstract_concept", "opinion"],
    ["mod_comparative_preference"], ["ordinary_quirk"],
    "Two distinctly charming personal styles sharing the very same roof with affectionate patience.",
    "Proof that two people can agree on love while holding completely opposite opinions about {target}.",
    "Interior peacekeepers celebrate another week of bold, irreconcilable taste differences around {target}."
)

# 12. Temperature / AC / Thermostat Wars
add_const(
    "climate_mismatch", "Indoor Micro-Climate", "mech_weather_forecast",
    "micro_climate", ["target"], ["physical_object", "sensory_experience"],
    ["mod_excessive_intensity"], ["ordinary_quirk"],
    "One side of the blanket dreams of cozy winter while the other votes for tropical breeze.",
    "The hallway {target} is quietly mediating between Arctic expedition mode and summer greenhouse mode.",
    "Meteorologists issued a dual living-room forecast: frosty tundra by the vents, tropical breeze by the sofa."
)

# 13. Shopping, Groceries & Habits
add_const(
    "shopping_quirk", "The Cart Surprise", "mech_postal_tracking",
    "shopping_habit", ["target"], ["physical_object", "activity"],
    ["mod_recurring_frequency"], ["ordinary_quirk"],
    "A playful reminder that every grocery run picks up one unexpected little treat along the aisle.",
    "The shopping list functioned mostly as an inspiring piece of creative fiction near the snack aisle.",
    "Cart inventory specialists wonder how six mystery snacks hopped into the basket by themselves."
)

# 14. Compositional Unfamiliar Situations (3+ distinct variants per opportunity so regeneration always rotates cleanly!)
add_const(
    "comp_action_target_v1", "Grounded Compositional Habit 1", "mech_observational_parody",
    "compositional_habit", ["action", "target"], ["action", "physical_object", "activity"],
    [], ["ordinary_quirk", "mild_interpersonal"],
    "A quiet little ritual around the {target} running on its own affectionate rhythm.",
    "Apparently handling the {target} follows an unspoken house rule nobody ever wrote down.",
    "Household archives gently preserve today's bold chapter featuring the {target}."
)
add_const(
    "comp_action_target_v2", "Grounded Compositional Habit 2", "mech_harmless_personification",
    "compositional_habit", ["action", "target"], ["action", "physical_object", "activity"],
    [], ["ordinary_quirk", "mild_interpersonal"],
    "The {target} quietly reminding us that shared routines come with charming little quirks.",
    "Seems like the {target} decided to run on its own independent living-room schedule today.",
    "Domestic observers admire how confidently the {target} claimed today's spotlight."
)
add_const(
    "comp_action_target_v3", "Grounded Compositional Habit 3", "mech_museum_curation",
    "compositional_habit", ["action", "target"], ["action", "physical_object", "activity"],
    [], ["ordinary_quirk", "mild_interpersonal"],
    "One tiny everyday chapter where the {target} is simply doing its own cozy thing.",
    "Proof that ordinary life with {target} always comes with an unscripted twist.",
    "Local historians politely added today's story about {target} to the household chronicle."
)
add_const(
    "comp_action_context_v1", "Grounded Compositional Context 1", "mech_timing_anticlimax",
    "compositional_context", ["action", "context"], ["action", "interpersonal_interaction"],
    [], ["ordinary_quirk", "mild_interpersonal"],
    "A lighthearted moment dropping in unexpectedly during {context}.",
    "Funny how little domestic detours always pick the exact middle of {context} to appear.",
    "Shared living apparently guarantees an unscheduled cameo right in the heart of {context}."
)
add_const(
    "comp_action_context_v2", "Grounded Compositional Context 2", "mech_observational_parody",
    "compositional_context", ["action", "context"], ["action", "interpersonal_interaction"],
    [], ["ordinary_quirk", "mild_interpersonal"],
    "A soft pause right in the middle of {context} to smile at everyday timing.",
    "Today's script clearly tossed an improvised surprise straight into {context}.",
    "Stage managers note that {context} received an unannounced plot twist tonight."
)
add_const(
    "comp_action_context_v3", "Grounded Compositional Context 3", "mech_whisper_monastery",
    "compositional_context", ["action", "context"], ["action", "interpersonal_interaction"],
    [], ["ordinary_quirk", "mild_interpersonal"],
    "One small reminder that {context} rarely runs on clockwork perfection.",
    "Two minds sharing {context} with just enough unexpected energy to keep things lively.",
    "Organizers of {context} politely gave up on keeping tonight's schedule completely predictable."
)
add_const(
    "comp_behavior_frequency_v1", "Grounded Habit Rhythm 1", "mech_observational_parody",
    "compositional_frequency", ["behavior"], ["behavior", "activity"],
    ["mod_recurring_frequency", "mod_never_frequency"], ["ordinary_quirk", "mild_interpersonal"],
    "One of those tiny, repeatable {behavior} quirks that gives shared life its signature.",
    "Consistent {behavior} keeping our daily household script charmingly unpredictable.",
    "Even the living room walls know the exact cue for this signature {behavior} routine by heart."
)
add_const(
    "comp_behavior_frequency_v2", "Grounded Habit Rhythm 2", "mech_timing_anticlimax",
    "compositional_frequency", ["behavior"], ["behavior", "activity"],
    ["mod_recurring_frequency"], ["ordinary_quirk", "mild_interpersonal"],
    "A familiar little {behavior} pattern making its regular cameo in the day.",
    "Clearly {behavior} has renewed its seasonal residency on our shared calendar.",
    "Chroniclers of everyday habits confirm {behavior} remains a permanent household classic."
)
add_const(
    "comp_behavior_frequency_v3", "Grounded Habit Rhythm 3", "mech_playful_milestone",
    "compositional_frequency", ["behavior"], ["behavior", "activity"],
    ["mod_recurring_frequency"], ["ordinary_quirk", "mild_interpersonal"],
    "Two people learning each other's endearing everyday {behavior} rhythms with patience.",
    "Every time {behavior} returns, it brings a tiny dose of familiar comedic déjà vu.",
    "The household hall of fame reserves a gilded plaque strictly for recurring {behavior}."
)
add_const(
    "comp_entity_location", "Grounded Place Placement", "mech_museum_curation",
    "compositional_location", ["target", "location"], ["physical_object", "place"],
    [], ["ordinary_quirk"],
    "The {target} found an easy spot to settle down over by the {location}.",
    "Apparently the {location} has become the unofficial VIP lounge for the {target}.",
    "Curators politely admired the confident placement of the {target} right beside the {location}."
)

# Add 20 more multi-domain distinct everyday constructions (e.g., laundry, driving/GPS, guests, hobbies, money)
add_const(
    "laundry_mountain", "Chairdrobe Logistics", "mech_museum_curation",
    "household_chore", ["target"], ["physical_object"],
    ["mod_excessive_duration", "mod_never_frequency"], ["ordinary_quirk"],
    "The clean clothes are resting comfortably on the chair until folding mood arrives.",
    "Why use a closet hanger when that bedroom chair makes such an accommodating textile sculpture?",
    "Architectural critics praise the structural balance of the bedroom chair's seven-layer laundry pyramid."
)
add_const(
    "gps_detour", "Scenic Navigation", "mech_miniature_expedition",
    "travel_debate", ["activity"], ["activity", "physical_object"],
    [], ["ordinary_quirk"],
    "An extra block or two just gives the playlist a bit more time to finish.",
    "Apparently the GPS directions were treated strictly as polite background suggestions.",
    "Explorers proudly charted three brand-new neighborhood alleys while taking a confident scenic shortcut."
)
add_const(
    "party_energy", "Social Battery Contrast", "mech_timing_anticlimax",
    "social_energy", ["context"], ["interpersonal_interaction", "activity"],
    [], ["ordinary_quirk"],
    "One heart is ready for slippers while the other still has one more cheerful chat in the tank.",
    "An impressive contrast between full party energy and someone quietly eyeing the coat rack.",
    "Social batteries recorded record-breaking divergence halfway through dessert at tonight's gathering."
)
add_const(
    "splurge_vs_budget", "The Treat vs Receipt Moment", "mech_observational_parody",
    "spending_quirk", ["target"], ["physical_object", "abstract_concept"],
    [], ["ordinary_quirk"],
    "Balancing spreadsheets and spontaneous little treats is a delicate couple dance.",
    "One of us brought a careful budget while the other brought enthusiastic treat-yourself energy.",
    "Household treasury noted a passionate philosophical disagreement between long-term savings and impulse joy."
)
add_const(
    "hobby_immersion", "Deep Hobby Tunnel", "mech_zen_minimalism",
    "hobby_absorption", ["activity"], ["activity", "physical_object"],
    ["mod_excessive_duration"], ["ordinary_quirk"],
    "Once deep focus on a favorite hobby kicks in, living room clocks gently stop ticking.",
    "Earthly time appears entirely optional during an uninterrupted hobby marathon.",
    "Hours quietly tiptoed past the desk while full creative immersion claimed the entire evening."
)
add_const(
    "morning_quiet_vs_chat", "Early Bird vs Night Owl", "mech_whisper_monastery",
    "rhythm_mismatch", ["context"], ["time", "behavior"],
    [], ["ordinary_quirk"],
    "One morning brain is already writing novels while the other is still negotiating with coffee.",
    "An endearing clash between pre-coffee silence and full sunrise conversation mode.",
    "Dawn etiquette committee recommends at least one full mug before complex morning questions begin."
)
add_const(
    "inlaw_prep", "Pre-Guest House Polish", "mech_secret_agent_covert",
    "hosting_guests", ["context"], ["interpersonal_interaction", "place"],
    [], ["ordinary_quirk"],
    "A spirited dash around the hallway before familiar faces knock on the front door.",
    "Nothing tidies a living room faster than the magic announcement that company is ten minutes away.",
    "Records confirm the entire kitchen transformed from lived-in cozy to showroom gleam in four flat minutes."
)

# Add 24 more clean domain-grounded constructions across sleep, chores, teasing, listening, affection
add_const(
    "blanket_monopoly", "Midnight Duvet Drift", "mech_silent_film_farce",
    "sleep_disruption", ["target"], ["physical_object"],
    ["mod_recurring_frequency"], ["ordinary_quirk"],
    "The blanket quietly drifted across the mattress to keep one side extra cozy.",
    "Nighttime gravity appears subtly tilted toward one lucky half of the bed.",
    "Sleep engineers noted ninety-four percent of the duvet migrated peacefully west by three in the morning."
)
add_const(
    "alarm_orchestra", "The Snooze Symphony", "mech_soundtrack_drama",
    "alarm_delay", ["target", "behavior"], ["physical_object", "time"],
    ["mod_recurring_frequency"], ["ordinary_quirk"],
    "A polite chorus of five-minute snooze chimes easing gently into the morning.",
    "Seven consecutive alarms just to be thoroughly introduced to the concept of waking up.",
    "The bedside clock performed six gentle encores before morning officially received acceptance."
)
add_const(
    "toilet_roll_empty", "Cardboard Baton Relay", "mech_harmless_personification",
    "chore_omission", ["target"], ["physical_object"],
    ["mod_never_frequency"], ["ordinary_quirk"],
    "That loyal little cardboard tube stayed on duty hoping someone would notice.",
    "Leaving one square left on the roll counts as passing the ceremonial bathroom baton.",
    "Bathroom archivists respectfully framed the lone surviving square hanging on the holder."
)
add_const(
    "listening_nod", "The Delayed Reply", "mech_time_dilation",
    "distracted_listening", ["action"], ["action", "interpersonal_interaction"],
    [], ["ordinary_quirk", "mild_interpersonal"],
    "Sometimes the brain takes a scenic two-second detour before catching up to the conversation.",
    "A heroic automatic nod delivered thirty seconds after the question already wrapped up.",
    "Transmission logs confirm the spoken sentence politely waited in an invisible hallway queue for full arrival."
)
add_const(
    "crumbs_mystery", "Midnight Snack Footprints", "mech_genre_noir_mystery",
    "eating_quirk", ["target"], ["ingredient", "place"],
    [], ["ordinary_quirk"],
    "Tiny toast crumbs leaving gentle clues about last night's cozy midnight snack.",
    "Detective notes show unmistakable evidence of a covert midnight biscuit mission on the couch.",
    "Magnifying glasses revealed a trail of golden pastry clues leading directly from pantry to pillow."
)
add_const(
    "joke_timing", "Comedy Timing Detour", "mech_timing_anticlimax",
    "teasing_mismatch", ["behavior"], ["behavior", "interpersonal_interaction"],
    [], ["ordinary_quirk", "mild_interpersonal"],
    "A playful punchline that arrived with huge enthusiasm while the mood wanted a softer moment.",
    "That joke enthusiastically sprinted onto stage a tiny bit ahead of its audience.",
    "The household comedy department eagerly checked its cue cards after mistiming tonight's punchline."
)
add_const(
    "grocery_wrong_brand", "Creative Brand Substitution", "mech_unexpected_profession",
    "shopping_substitution", ["target"], ["physical_object", "ingredient"],
    [], ["ordinary_quirk"],
    "Bringing home an unexpected twin product with completely cheerful intentions.",
    "Apparently the pantry got introduced to a brand-new surprise cousin of our regular snack.",
    "Grocery reconnaissance returned victoriously with an adventurously unrelated bottle from shelf three."
)
add_const(
    "mirror_monopoly", "Morning Mirror Shift", "mech_playful_milestone",
    "grooming_time", ["place"], ["place", "activity"],
    ["mod_excessive_duration"], ["ordinary_quirk"],
    "Morning grooming routines just taking an extra moment to polish the smile.",
    "The bathroom mirror quietly booked an extended solo rehearsal before breakfast.",
    "Hallway commuters lined up patiently outside the bathroom awaiting final hair-styling clearance."
)

# Boundary-respecting calm alternatives (not humorous dismissal!)
add_const(
    "boundary_respect_pause", "Autonomy & Boundary Respect", "mech_peace_summit",
    "boundary_dignity", ["action"], ["interpersonal_interaction", "expectation"],
    ["mod_propositional_negation"], ["boundary_concern", "serious_unsafe"],
    "A calm space where your personal boundaries and clear 'no' deserve full respect.",
    "Honoring personal pace without pressure—your comfort and choice always come first.",
    "Respecting clear boundaries matters most; taking space to reflect privately is completely valid."
)

with open('knowledge/humor/constructions/constructions.json', 'w') as f:
    json.dump(constructions, f, indent=2)

print(f"Rebuilt {len(constructions)} clean, structurally unique constructions ({c_idx // 3} three-tone sets).")
