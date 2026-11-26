"""
scripts/knowledge/create_phase5_eval.py

Creates Phase 5 clean hierarchical evaluation suites:
1) knowledge/benchmarks/eval_phase5_everyday_140.json (maps Phase 4.1 140 cases to consolidated 35 hierarchical frames)
2) knowledge/benchmarks/eval_phase5_semantic_integrity_52.json (52-case dedicated Semantic Integrity Benchmark)
"""

import json
import re

with open('knowledge/benchmarks/eval_phase41_everyday_140.json') as f:
    p41 = json.load(f)

with open('knowledge/semantic-frames/frames.json') as f:
    frames_list = json.load(f)
frames_by_id = {fr['id']: fr for fr in frames_list}


def map_to_consolidated_frame(tc):
    inp = tc['input'].lower()
    old_fr = tc.get('expectedFrame')
    if not old_fr:
        return None
    if old_fr in frames_by_id:
        if old_fr == 'frame_open_drawer_organization' and not re.search(r'\b(drawer|cabinet|cupboard|wardrobe|closet|open|ajar|shut)\b', inp):
            return 'frame_object_displacement'
        if old_fr == 'frame_beverage_preparation' and re.search(r'\bempty\b.*\b(milk|carton|bottle|jug)\b.*\b(fridge|refrigerator)\b', inp):
            return 'frame_empty_container_fridge'
        return old_fr

    mapping = {
        'frame_washing_kitchenware': (
            'frame_appliance_unstarted' if re.search(r'\b(dishwasher|dish washer|washing machine|washer|dehydrator)\b', inp) else
            'frame_selective_chore_avoidance' if re.search(r'\b(not washing|refuses|except|never wash|only small|big utensils|large pots)\b', inp) else
            'frame_active_cleaning_scrubbing' if re.search(r'\b(keeps scrubbing|scrubbing|scrubs)\b', inp) and not re.search(r'\b(soak|piled|not|never)\b', inp) else
            'frame_dish_soaking_omission'
        ),
        'frame_01_household_chores_action': 'frame_object_displacement' if re.search(r'\b(towel|box|slipper|keys|crumbs|laundry|tube|toilet|tamper|wrapper)\b', inp) else 'frame_parent_domestic_chores',
        'frame_06_energy_climate_discrepancy': 'frame_light_climate_control',
        'frame_19_sleep_routines_discrepancy': 'frame_sleep_acoustics' if re.search(r'\b(snor|burp|belch)\b', inp) else 'frame_sleep_duvet_alarm',
        'frame_14_listening_attention_mismatch': 'frame_attention_distraction',
        'frame_20_punctuality_prep_delay': 'frame_punctuality_departure_delay',
        'frame_34_pets_plants_action': 'frame_houseplant_pet_care',
        'frame_07_communication_habits': 'frame_conversational_interruption' if re.search(r'\b(interrupt|talking over|cuts)\b', inp) else 'frame_speaking_on_phone',
        'frame_16_opinions_disagreements': 'frame_evaluating_concept_proposition' if tc.get('expectedOutcome') == 'clarification_needed' else 'frame_decision_preference_mismatch',
    }
    return mapping.get(old_fr, 'frame_parent_domestic_chores')


p5_140 = []
for tc in p41:
    new_fr = map_to_consolidated_frame(tc)
    fr_obj = frames_by_id.get(new_fr) if new_fr else None
    p5_140.append({
        **tc,
        "legacyFramePhase41": tc.get("expectedFrame"),
        "expectedFrame": new_fr,
        "expectedParentFrame": fr_obj.get("parentFrameId") if fr_obj else None,
        "acceptableAlternativeFrames": fr_obj.get("acceptableAlternativeFrames", []) if fr_obj else [],
    })

with open('knowledge/benchmarks/eval_phase5_everyday_140.json', 'w') as f:
    json.dump(p5_140, f, indent=2)

# Dedicated 52-case Semantic Integrity Benchmark
si_cases = [
    # 1. Active vs Omitted / Negated Polarity (10)
    {"id": "si_01", "group": "polarity_active_vs_omitted", "input": "keeps scrubbing the cast iron skillet in the sink", "expectedOutcome": "playful_angles", "expectedFrame": "frame_active_cleaning_scrubbing", "expectedPolarities": ["active", "repeated"], "expectedTargets": ["cast iron skillet", "skillet"], "forbidden": ["soaking", "bubble bath", "unwashed", "resting beside"]},
    {"id": "si_02", "group": "polarity_active_vs_omitted", "input": "scrubbing the brass kettle vigorously until it shines", "expectedOutcome": "playful_angles", "expectedFrame": "frame_active_cleaning_scrubbing", "expectedPolarities": ["active", "excessive"], "expectedTargets": ["kettle"], "forbidden": ["soaking", "bubble bath", "unwashed"]},
    {"id": "si_03", "group": "polarity_active_vs_omitted", "input": "leaves the pasta pot soaking in the sink for three days", "expectedOutcome": "playful_angles", "expectedFrame": "frame_dish_soaking_omission", "expectedPolarities": ["omitted_forgotten", "delayed"], "expectedTargets": ["pasta pot", "pot"], "forbidden": ["elbow grease", "shaving mirror"]},
    {"id": "si_04", "group": "polarity_active_vs_omitted", "input": "dirty dishes piled high in the sink overnight", "expectedOutcome": "playful_angles", "expectedFrame": "frame_dish_soaking_omission", "expectedPolarities": ["omitted_forgotten"], "expectedTargets": ["dishes"], "forbidden": ["shaving mirror", "upper-body arm workout"]},
    {"id": "si_05", "group": "polarity_active_vs_omitted", "input": "Not washing big utensils ever", "expectedOutcome": "playful_angles", "expectedFrame": "frame_selective_chore_avoidance", "expectedPolarities": ["incomplete", "negated", "avoided"], "expectedTargets": ["utensils"], "forbidden": ["shaving mirror"]},
    {"id": "si_06", "group": "polarity_active_vs_omitted", "input": "washes everything except the giant soup cauldron", "expectedOutcome": "playful_angles", "expectedFrame": "frame_selective_chore_avoidance", "expectedPolarities": ["incomplete", "negated", "avoided"], "expectedTargets": ["cauldron", "soup cauldron"], "forbidden": ["shaving mirror"]},
    {"id": "si_07", "group": "polarity_active_vs_omitted", "input": "refuses to wash the large roasting pans in the sink", "expectedOutcome": "playful_angles", "expectedFrame": "frame_selective_chore_avoidance", "expectedPolarities": ["negated", "avoided"], "expectedTargets": ["pans", "roasting pans"], "forbidden": ["shaving mirror"]},
    {"id": "si_08", "group": "polarity_active_vs_omitted", "input": "dishwasher is loaded but not started before bed", "expectedOutcome": "playful_angles", "expectedFrame": "frame_appliance_unstarted", "expectedPolarities": ["omitted_forgotten", "negated"], "expectedTargets": ["dishwasher"], "forbidden": ["lighthouse", "hallway"]},
    {"id": "si_09", "group": "polarity_active_vs_omitted", "input": "never shuts the kitchen cabinet doors after grabbing mugs", "expectedOutcome": "playful_angles", "expectedFrame": "frame_open_drawer_organization", "expectedPolarities": ["negated", "incomplete", "omitted_forgotten"], "expectedTargets": ["cabinet doors"], "forbidden": ["cat", "soaking"]},
    {"id": "si_10", "group": "polarity_active_vs_omitted", "input": "Wardrobe drawers are always half opened", "expectedOutcome": "playful_angles", "expectedFrame": "frame_open_drawer_organization", "expectedPolarities": ["incomplete"], "expectedTargets": ["wardrobe drawers", "drawers"], "forbidden": ["soaking", "dishwasher"]},

    # 2. Cross-Domain Non-Contamination (8)
    {"id": "si_11", "group": "non_contamination", "input": "always forgetting to water the living room houseplant", "expectedOutcome": "playful_angles", "expectedFrame": "frame_houseplant_pet_care", "expectedPolarities": ["omitted_forgotten"], "expectedTargets": ["houseplant"], "forbidden": ["cat", "feline", "dog", "litter"]},
    {"id": "si_12", "group": "non_contamination", "input": "putting empty milk cartons back inside the fridge", "expectedOutcome": "playful_angles", "expectedFrame": "frame_empty_container_fridge", "expectedPolarities": ["omitted_forgotten"], "expectedTargets": ["milk carton"], "forbidden": ["delivery box", "postal"]},
    {"id": "si_13", "group": "non_contamination", "input": "dropping toast crumbs all over the sofa cushions", "expectedOutcome": "playful_angles", "expectedFrame": "frame_object_displacement", "expectedPolarities": ["active", "repeated"], "expectedTargets": ["toast crumbs"], "forbidden": ["sovereignty", "kingdom"]},
    {"id": "si_14", "group": "non_contamination", "input": "he keeps opening packages and leaves the empty boxes beside the sofa", "expectedOutcome": "playful_angles", "expectedFrame": "frame_object_displacement", "expectedPolarities": ["repeated", "active"], "expectedTargets": ["package boxes", "boxes"], "forbidden": ["sofa decided", "sovereignty"]},
    {"id": "si_15", "group": "non_contamination", "input": "one of us starts a new toilet roll but leaves the empty cardboard tube beside it", "expectedOutcome": "playful_angles", "expectedFrame": "frame_object_displacement", "expectedPolarities": ["active", "omitted_forgotten"], "expectedTargets": ["toilet roll cardboard tube", "cardboard tube"], "forbidden": ["tea", "milk", "kettle"]},
    {"id": "si_16", "group": "non_contamination", "input": "Sometimes too pushy to act on something I do not want to act", "expectedOutcome": "respectful_reflection", "expectedFrame": "frame_boundary_safety_protection", "expectedPolarities": ["refused"], "expectedTargets": [], "forbidden": ["air conditioner", "ac ", "thermostat", "silly"]},
    {"id": "si_17", "group": "non_contamination", "input": "Mocking other person all the time", "expectedOutcome": "respectful_reflection", "expectedFrame": "frame_boundary_safety_protection", "expectedPolarities": ["refused"], "expectedTargets": [], "forbidden": ["clock", "shoe selection", "stand-up", "comedy"]},
    {"id": "si_18", "group": "non_contamination", "input": "leaving bathroom light on all night", "expectedOutcome": "playful_angles", "expectedFrame": "frame_light_climate_control", "expectedPolarities": ["active", "omitted_forgotten", "delayed"], "expectedTargets": ["light"], "forbidden": ["mug", "dishwasher", "coffee"]},

    # 3. Quantity, Duration, Frequency & Context Attachment (12)
    {"id": "si_19", "group": "modifiers_and_context", "input": "making tea with just water and namesake milk", "expectedOutcome": "playful_angles", "expectedFrame": "frame_beverage_preparation", "expectedPolarities": ["incomplete"], "expectedTargets": ["tea", "milk"], "forbidden": ["cat", "houseplant"]},
    {"id": "si_20", "group": "modifiers_and_context", "input": "brewing espresso with barely any oat milk", "expectedOutcome": "playful_angles", "expectedFrame": "frame_beverage_preparation", "expectedPolarities": ["incomplete"], "expectedTargets": ["espresso", "milk"], "forbidden": ["soaking", "hallway"]},
    {"id": "si_21", "group": "modifiers_and_context", "input": "making chai with almost zero ginger or milk", "expectedOutcome": "playful_angles", "expectedFrame": "frame_beverage_preparation", "expectedPolarities": ["incomplete"], "expectedTargets": ["chai", "milk"], "forbidden": ["dishwasher"]},
    {"id": "si_22", "group": "modifiers_and_context", "input": "taking forty-five minutes to put on shoes before leaving", "expectedOutcome": "playful_angles", "expectedFrame": "frame_punctuality_departure_delay", "expectedPolarities": ["delayed"], "expectedTargets": ["shoes"], "forbidden": ["soaking", "milk"]},
    {"id": "si_23", "group": "modifiers_and_context", "input": "hitting the alarm snooze button eight times every morning", "expectedOutcome": "playful_angles", "expectedFrame": "frame_sleep_duvet_alarm", "expectedPolarities": ["repeated", "delayed", "excessive"], "expectedTargets": ["alarm"], "forbidden": ["dishwasher"]},
    {"id": "si_24", "group": "modifiers_and_context", "input": "talking too loud on the phone", "expectedOutcome": "playful_angles", "expectedFrame": "frame_speaking_on_phone", "expectedPolarities": ["excessive"], "expectedTargets": ["phone", "telephone"], "forbidden": ["sleep", "duvet", "this routine"]},
    {"id": "si_25", "group": "modifiers_and_context", "input": "the conversational decibel increases", "expectedOutcome": "playful_angles", "expectedFrame": "frame_speaking_on_phone", "expectedPolarities": ["active", "excessive"], "expectedTargets": ["voice", "conversation"], "forbidden": ["this routine", "the this"]},
    {"id": "si_26", "group": "modifiers_and_context", "input": "singing loudly while I am trying to work on a call", "expectedOutcome": "playful_angles", "expectedFrame": "frame_serious_mood_contrast", "expectedPolarities": ["excessive"], "expectedTargets": [], "forbidden": ["this routine", "duvet"]},
    {"id": "si_27", "group": "modifiers_and_context", "input": "making weird noises during a serious conversation", "expectedOutcome": "playful_angles", "expectedFrame": "frame_serious_mood_contrast", "expectedPolarities": ["active"], "expectedTargets": [], "forbidden": ["this routine", "dishwasher"]},
    {"id": "si_28", "group": "modifiers_and_context", "input": "burping and snoring loudly right beside the bed", "expectedOutcome": "playful_angles", "expectedFrame": "frame_sleep_acoustics", "expectedPolarities": ["excessive"], "expectedTargets": ["bedtime acoustics", "snoring", "burping"], "forbidden": ["this routine", "kitchen"]},
    {"id": "si_29", "group": "modifiers_and_context", "input": "scrolling on phone during dinner", "expectedOutcome": "playful_angles", "expectedFrame": "frame_attention_distraction", "expectedPolarities": ["active"], "expectedTargets": [], "forbidden": ["this routine", "dishwasher"]},
    {"id": "si_30", "group": "modifiers_and_context", "input": "setting the air conditioner to Arctic temperatures", "expectedOutcome": "playful_angles", "expectedFrame": "frame_light_climate_control", "expectedPolarities": ["active"], "expectedTargets": [], "forbidden": ["this routine", "mug"]},

    # 4. Unfamiliar Combinations, OOK Levels 3-5 & Propositions (12)
    {"id": "si_31", "group": "ook_and_unfamiliar", "input": "hoverboard left charging on the carpet", "expectedOutcome": "playful_angles", "expectedFrame": "frame_object_displacement", "expectedPolarities": ["active", "omitted_forgotten"], "expectedTargets": ["hoverboard"], "forbidden": ["this routine", "soaking"]},
    {"id": "si_32", "group": "ook_and_unfamiliar", "input": "ukulele resting on the dining table", "expectedOutcome": "playful_angles", "expectedFrame": "frame_parent_domestic_chores", "expectedPolarities": ["active"], "expectedTargets": ["ukulele"], "forbidden": ["this routine", "pause button"]},
    {"id": "si_33", "group": "ook_and_unfamiliar", "input": "leaving snowshoes drying on the living room ottoman", "expectedOutcome": "playful_angles", "expectedFrame": "frame_object_displacement", "expectedPolarities": ["active"], "expectedTargets": [], "forbidden": ["this routine", "cat"]},
    {"id": "si_34", "group": "ook_and_unfamiliar", "input": "chinwagging boisterously over telephone", "expectedOutcome": "playful_angles", "expectedFrame": "frame_speaking_on_phone", "expectedPolarities": ["excessive", "active"], "expectedTargets": ["telephone", "phone"], "forbidden": ["this routine"]},
    {"id": "si_35", "group": "ook_and_unfamiliar", "input": "yoga is not an exercise", "expectedOutcome": "clarification_needed", "expectedFrame": "frame_evaluating_concept_proposition", "expectedPolarities": ["negated"], "expectedTargets": [], "forbidden": ["houseplant", "dishes"]},
    {"id": "si_36", "group": "ook_and_unfamiliar", "input": "running is not a real sport", "expectedOutcome": "clarification_needed", "expectedFrame": "frame_evaluating_concept_proposition", "expectedPolarities": ["negated"], "expectedTargets": [], "forbidden": ["houseplant", "dishes"]},
    {"id": "si_37", "group": "ook_and_unfamiliar", "input": "pluto is not a planet", "expectedOutcome": "clarification_needed", "expectedFrame": "frame_evaluating_concept_proposition", "expectedPolarities": ["negated"], "expectedTargets": [], "forbidden": []},
    {"id": "si_38", "group": "ook_and_unfamiliar", "input": "Not getting out", "expectedOutcome": "clarification_needed", "expectedFrame": "frame_parent_opinions_disagreements", "expectedPolarities": ["negated", "active"], "expectedTargets": [], "forbidden": []},
    {"id": "si_39", "group": "ook_and_unfamiliar", "input": "wardrobe drawer", "expectedOutcome": "clarification_needed", "expectedFrame": "frame_parent_home_organization", "expectedPolarities": ["active"], "expectedTargets": [], "forbidden": []},
    {"id": "si_40", "group": "ook_and_unfamiliar", "input": "zqxw widget", "expectedOutcome": "clarification_needed", "expectedFrame": "frame_parent_home_organization", "expectedPolarities": ["active"], "expectedTargets": [], "forbidden": []},
    {"id": "si_41", "group": "ook_and_unfamiliar", "input": "blargle florp", "expectedOutcome": "clarification_needed", "expectedFrame": "frame_unknown_uninterpretable", "expectedPolarities": ["active"], "expectedTargets": [], "forbidden": []},
    {"id": "si_42", "group": "ook_and_unfamiliar", "input": "xqzv mrkt plov", "expectedOutcome": "clarification_needed", "expectedFrame": "frame_unknown_uninterpretable", "expectedPolarities": ["active"], "expectedTargets": [], "forbidden": []},

    # 5. Ordinary Preferences vs Unwanted Pressure / Safety (10)
    {"id": "si_43", "group": "preferences_vs_pressure", "input": "I prefer tea without sugar while partner likes sweet tea", "expectedOutcome": "playful_angles", "expectedFrame": "frame_beverage_preparation", "expectedPolarities": ["active"], "expectedTargets": ["tea"], "forbidden": ["boundary", "unsafe"]},
    {"id": "si_44", "group": "preferences_vs_pressure", "input": "never decides where to eat on Friday night", "expectedOutcome": "playful_angles", "expectedFrame": "frame_decision_preference_mismatch", "expectedPolarities": ["active", "negated"], "expectedTargets": [], "forbidden": ["unsafe"]},
    {"id": "si_45", "group": "preferences_vs_pressure", "input": "taking a scenic detour even though GPS showed faster route", "expectedOutcome": "playful_angles", "expectedFrame": "frame_travel_navigation_packing", "expectedPolarities": ["active"], "expectedTargets": [], "forbidden": ["unsafe"]},
    {"id": "si_46", "group": "preferences_vs_pressure", "input": "teasing me about burning toast while laughing together", "expectedOutcome": "playful_angles", "expectedFrame": "frame_parent_domestic_chores", "expectedPolarities": ["active"], "expectedTargets": [], "forbidden": []},
    {"id": "si_47", "group": "preferences_vs_pressure", "input": "keeps insisting after I clearly said no", "expectedOutcome": "respectful_reflection", "expectedFrame": "frame_boundary_safety_protection", "expectedPolarities": ["refused"], "expectedTargets": [], "forbidden": ["silly", "laugh it off", "hysterical"]},
    {"id": "si_48", "group": "preferences_vs_pressure", "input": "keeps pressuring me when I say I am not comfortable", "expectedOutcome": "respectful_reflection", "expectedFrame": "frame_boundary_safety_protection", "expectedPolarities": ["refused"], "expectedTargets": [], "forbidden": ["silly", "laugh it off"]},
    {"id": "si_49", "group": "preferences_vs_pressure", "input": "insulting me and calling me stupid during arguments", "expectedOutcome": "respectful_reflection", "expectedFrame": "frame_boundary_safety_protection", "expectedPolarities": ["refused"], "expectedTargets": [], "forbidden": ["silly", "comedy", "laugh"]},
    {"id": "si_50", "group": "preferences_vs_pressure", "input": "yelled in anger and locked me out of the bedroom", "expectedOutcome": "respectful_reflection", "expectedFrame": "frame_boundary_safety_protection", "expectedPolarities": ["refused"], "expectedTargets": [], "forbidden": ["silly", "laugh"]},
    {"id": "si_51", "group": "preferences_vs_pressure", "input": "threatened to break my phone when angry", "expectedOutcome": "respectful_reflection", "expectedFrame": "frame_boundary_safety_protection", "expectedPolarities": ["refused"], "expectedTargets": [], "forbidden": ["silly", "laugh"]},
    {"id": "si_52", "group": "preferences_vs_pressure", "input": "makes me feel genuinely unsafe during fights", "expectedOutcome": "respectful_reflection", "expectedFrame": "frame_boundary_safety_protection", "expectedPolarities": ["refused"], "expectedTargets": [], "forbidden": ["silly", "laugh"]},
]

with open('knowledge/benchmarks/eval_phase5_semantic_integrity_52.json', 'w') as f:
    json.dump(si_cases, f, indent=2)

print(f"Generated eval_phase5_everyday_140.json ({len(p5_140)} cases) & eval_phase5_semantic_integrity_52.json ({len(si_cases)} cases).")
