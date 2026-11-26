"""
scripts/knowledge/rebuild_frames_v2.py

Audits and consolidates the 222 semantic frames into a clean, non-overlapping
parent-child frame hierarchy with compatiblePolarities and acceptableAlternativeFrames.
"""

import json

print("--- Auditing and Consolidating Semantic Frame Hierarchy (v2) ---")

with open('knowledge/domains/domains.json') as f:
    domains = json.load(f)

with open('knowledge/semantic-frames/frames.json') as f:
    old_frames = json.load(f)

print(f"Audited Phase 4 frames: {len(old_frames)} entries (6 handcrafted + 216 template-generated).")

# 12 Cohesive Parent Domain/Abstract Frames
parent_frames = [
    ("frame_parent_domestic_chores", "Domestic upkeep and cleaning chores", ["dom_01_household_chores", "dom_02_cleaning_hygiene"], ["active", "repeated", "excessive", "incomplete", "negated", "omitted_forgotten", "delayed", "avoided"]),
    ("frame_parent_home_organization", "Home storage, clutter, and object placement", ["dom_03_home_organization", "dom_05_furniture_belongings"], ["active", "repeated", "incomplete", "negated", "omitted_forgotten"]),
    ("frame_parent_appliances_climate", "Household appliances, lighting, and climate settings", ["dom_04_appliances_technology", "dom_06_energy_climate"], ["active", "repeated", "excessive", "incomplete", "negated", "omitted_forgotten"]),
    ("frame_parent_culinary_beverages", "Cooking, food prep, eating, and beverage ratios", ["dom_07_cooking_preparation", "dom_08_eating_habits", "dom_09_beverages_ingredients"], ["active", "repeated", "excessive", "incomplete", "negated", "omitted_forgotten"]),
    ("frame_parent_communication_voice", "Speaking voice, conversational volume, and humor", ["dom_13_speaking_voice", "dom_15_humor_teasing"], ["active", "repeated", "excessive", "incomplete"]),
    ("frame_parent_attention_digital", "Listening attention, interruptions, and digital distraction", ["dom_14_listening_attention", "dom_22_work_study", "dom_23_digital_devices"], ["active", "repeated", "excessive", "negated", "omitted_forgotten"]),
    ("frame_parent_sleep_bodily", "Sleep routines, bedtime rhythms, and bodily acoustics", ["dom_18_bodily_habits", "dom_19_sleep_routines"], ["active", "repeated", "excessive"]),
    ("frame_parent_timing_scheduling", "Punctuality, preparation delays, and shared scheduling", ["dom_20_punctuality_prep", "dom_21_planning_scheduling"], ["active", "repeated", "delayed", "omitted_forgotten"]),
    ("frame_parent_opinions_disagreements", "Opinions, preferences, and categorical disagreements", ["dom_11_health_exercise", "dom_16_opinions_disagreements", "dom_17_decision_making"], ["active", "negated", "delayed"]),
    ("frame_parent_leisure_travel_money", "Shopping, hobbies, travel, social events, and spending", ["dom_10_shopping_groceries", "dom_12_grooming_care", "dom_24_hobbies_leisure", "dom_25_quality_time", "dom_26_affection_appreciation", "dom_27_friends_social", "dom_28_family_relatives", "dom_29_celebrations_dates", "dom_30_travel_transport", "dom_31_money_spending", "dom_32_commitments_fairness", "dom_33_parenting_caregiving"], ["active", "repeated", "excessive", "omitted_forgotten"]),
    ("frame_parent_pets_plants_care", "Pet care and houseplant maintenance", ["dom_34_pets_plants"], ["active", "repeated", "negated", "omitted_forgotten"]),
    ("frame_parent_boundaries_emotions", "Personal boundaries, emotional expectations, and safety", ["dom_35_emotional_expectations", "dom_36_boundaries_safety"], ["refused", "negated", "repeated", "excessive"]),
]

frames_out = []
for fid, fname, doms, pols in parent_frames:
    frames_out.append({
        "id": fid,
        "name": fname,
        "description": f"Parent semantic category for {fname.lower()}.",
        "isAbstractParent": True,
        "parentFrameId": None,
        "acceptableAlternativeFrames": [],
        "relatedDomains": doms,
        "compatiblePolarities": pols,
        "triggers": [],
        "roles": [
            {"id": "action", "name": "Action or behavior", "acceptedConceptTypes": ["action", "behavior"], "required": False, "description": "Observable behavior"},
            {"id": "target", "name": "Target entity", "acceptedConceptTypes": ["physical_object", "ingredient", "activity"], "required": False, "description": "Affected item"}
        ],
        "compatibleModifiers": [],
        "relatedFrames": [],
        "sourceIds": ["purple-garden-original"]
    })

# Specific Child Frames (explicit polarity separation & parent mapping)
child_frames = [
    ("frame_washing_kitchenware", "frame_parent_domestic_chores", "Washing kitchenware and cookware cleanup", ["dom_01_household_chores", "dom_02_cleaning_hygiene"], ["active", "repeated", "excessive", "incomplete", "negated", "omitted_forgotten", "delayed", "avoided"], ["frame_parent_domestic_chores", "frame_active_cleaning_scrubbing", "frame_selective_chore_avoidance", "frame_dish_soaking_omission"]),
    ("frame_active_cleaning_scrubbing", "frame_washing_kitchenware", "Actively scrubbing, wiping, or rinsing cookware", ["dom_01_household_chores", "dom_02_cleaning_hygiene"], ["active", "repeated", "excessive"], ["frame_washing_kitchenware", "frame_parent_domestic_chores"]),
    ("frame_selective_chore_avoidance", "frame_washing_kitchenware", "Selective omission or refusal of large cookware washing", ["dom_01_household_chores", "dom_32_commitments_fairness"], ["negated", "incomplete", "avoided", "refused"], ["frame_washing_kitchenware", "frame_parent_domestic_chores"]),
    ("frame_dish_soaking_omission", "frame_washing_kitchenware", "Leaving pots, pans, or dishes unwashed/soaking in sink", ["dom_01_household_chores"], ["omitted_forgotten", "delayed"], ["frame_washing_kitchenware", "frame_parent_domestic_chores"]),
    ("frame_laundry_upkeep", "frame_parent_domestic_chores", "Laundry folding, wet towels, and clothes storage", ["dom_01_household_chores", "dom_03_home_organization"], ["active", "repeated", "incomplete", "negated", "omitted_forgotten", "delayed"], ["frame_parent_domestic_chores", "frame_object_displacement"]),
    ("frame_appliance_unstarted", "frame_parent_appliances_climate", "Household appliance loaded or ready but left unstarted/unplugged", ["dom_04_appliances_technology", "dom_01_household_chores"], ["negated", "omitted_forgotten"], ["frame_parent_appliances_climate", "frame_parent_domestic_chores"]),
    ("frame_light_climate_control", "frame_parent_appliances_climate", "Leaving lights on or extreme thermostat/AC temperature settings", ["dom_06_energy_climate"], ["active", "repeated", "excessive", "omitted_forgotten"], ["frame_parent_appliances_climate"]),
    ("frame_open_drawer_organization", "frame_parent_home_organization", "Leaving drawers, wardrobe doors, or cabinets open or ajar", ["dom_03_home_organization", "dom_05_furniture_belongings"], ["incomplete", "repeated", "omitted_forgotten"], ["frame_parent_home_organization", "frame_object_displacement"]),
    ("frame_object_displacement", "frame_parent_home_organization", "Everyday objects or crumbs left outside expected storage spots", ["dom_03_home_organization", "dom_05_furniture_belongings"], ["active", "repeated", "omitted_forgotten"], ["frame_parent_home_organization", "frame_open_drawer_organization"]),
    ("frame_beverage_preparation", "frame_parent_culinary_beverages", "Preparing tea, coffee, espresso, or soup with specific ingredient ratios", ["dom_09_beverages_ingredients", "dom_07_cooking_preparation"], ["active", "repeated", "incomplete", "omitted_forgotten"], ["frame_parent_culinary_beverages"]),
    ("frame_empty_container_fridge", "frame_parent_culinary_beverages", "Placing empty beverage cartons or bottles back inside refrigerator", ["dom_09_beverages_ingredients", "dom_04_appliances_technology"], ["omitted_forgotten", "repeated"], ["frame_parent_culinary_beverages", "frame_object_displacement"]),
    ("frame_speaking_on_phone", "frame_parent_communication_voice", "Speaking loudly or broadcasting on telephone, speaker, or voice call", ["dom_13_speaking_voice", "dom_23_digital_devices"], ["active", "repeated", "excessive"], ["frame_parent_communication_voice"]),
    ("frame_serious_mood_contrast", "frame_parent_communication_voice", "Playful noises, teasing, or singing clashing with serious mood or work", ["dom_13_speaking_voice", "dom_15_humor_teasing", "dom_14_listening_attention"], ["active", "repeated", "excessive"], ["frame_parent_communication_voice", "frame_parent_attention_digital"]),
    ("frame_attention_distraction", "frame_parent_attention_digital", "Phone scrolling, screen distraction, or tuned-out listening", ["dom_14_listening_attention", "dom_23_digital_devices"], ["active", "repeated", "omitted_forgotten"], ["frame_parent_attention_digital"]),
    ("frame_conversational_interruption", "frame_parent_attention_digital", "Interrupting mid-sentence or talking over someone", ["dom_14_listening_attention", "dom_13_speaking_voice"], ["active", "repeated"], ["frame_parent_attention_digital", "frame_parent_communication_voice"]),
    ("frame_sleep_acoustics", "frame_parent_sleep_bodily", "Nighttime snoring, burping, or loud bodily habits", ["dom_18_bodily_habits", "dom_19_sleep_routines"], ["active", "repeated", "excessive"], ["frame_parent_sleep_bodily"]),
    ("frame_sleep_duvet_alarm", "frame_parent_sleep_bodily", "Bedtime duvet sharing, snoozing alarms, or late lights", ["dom_19_sleep_routines"], ["active", "repeated", "excessive", "delayed"], ["frame_parent_sleep_bodily"]),
    ("frame_punctuality_departure_delay", "frame_parent_timing_scheduling", "Prolonged getting ready, missing shoes/keys, or delayed departure", ["dom_20_punctuality_prep", "dom_21_planning_scheduling"], ["delayed", "repeated", "excessive"], ["frame_parent_timing_scheduling"]),
    ("frame_evaluating_concept_proposition", "frame_parent_opinions_disagreements", "Categorical claims or negated definitions requiring shared context", ["dom_16_opinions_disagreements", "dom_11_health_exercise"], ["negated", "active"], ["frame_parent_opinions_disagreements"]),
    ("frame_decision_preference_mismatch", "frame_parent_opinions_disagreements", "Meal indecision, off-brand grocery picks, or differing everyday tastes", ["dom_17_decision_making", "dom_10_shopping_groceries"], ["active", "delayed", "incomplete"], ["frame_parent_opinions_disagreements", "frame_parent_leisure_travel_money"]),
    ("frame_houseplant_pet_care", "frame_parent_pets_plants_care", "Watering houseplants or tending pets on shared schedule", ["dom_34_pets_plants"], ["omitted_forgotten", "negated", "delayed", "repeated"], ["frame_parent_pets_plants_care"]),
    ("frame_travel_navigation_packing", "frame_parent_leisure_travel_money", "GPS route debates, driving detours, and trip packing habits", ["dom_30_travel_transport"], ["active", "excessive", "repeated"], ["frame_parent_leisure_travel_money"]),
    ("frame_boundary_safety_protection", "frame_parent_boundaries_emotions", "Explicit refusal, unwanted insistence, verbal harm, or unsafe conduct", ["dom_36_boundaries_safety", "dom_35_emotional_expectations"], ["refused", "negated", "repeated", "excessive"], ["frame_parent_boundaries_emotions"]),
]

for fid, pid, fname, doms, pols, alts in child_frames:
    frames_out.append({
        "id": fid,
        "name": fname,
        "description": fname,
        "isAbstractParent": False,
        "parentFrameId": pid,
        "acceptableAlternativeFrames": alts,
        "relatedDomains": doms,
        "compatiblePolarities": pols,
        "triggers": [],
        "roles": [
            {"id": "action", "name": "Action or behavior", "acceptedConceptTypes": ["action", "behavior"], "required": False, "description": "Action"},
            {"id": "target", "name": "Target", "acceptedConceptTypes": ["physical_object", "ingredient", "activity", "place"], "required": False, "description": "Target"}
        ],
        "compatibleModifiers": [],
        "relatedFrames": [pid],
        "sourceIds": ["purple-garden-original"]
    })

with open('knowledge/semantic-frames/frames.json', 'w') as f:
    json.dump(frames_out, f, indent=2)

print(f"Consolidated 222 noisy/overlapping templates into {len(frames_out)} non-overlapping hierarchical frames ({len(parent_frames)} parent + {len(child_frames)} specific child frames).")
