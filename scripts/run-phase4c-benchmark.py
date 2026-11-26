import json
import subprocess
import sys

# 50 Phase 4B.1 Probes + 15 New Phase 4C Contrast Probes = 65 Probes
probe_definitions = [
    # 50 Phase 4B.1 probes
    ("she eats too slow", "frame_parent_culinary_beverages"),
    ("he walks too slowly", "frame_parent_timing_scheduling"),
    ("she eats very quickly", "frame_parent_culinary_beverages"),
    ("cooking dinner very slowly", "frame_parent_culinary_beverages"),
    ("driving too fast on the highway", "frame_unknown_uninterpretable"), # or clarification/safety
    ("he talks too loud", "frame_parent_communication_voice"),
    ("listening to loud music", "frame_subjective_preference_contrast"),
    ("scrubbing the counter too hard", "frame_active_cleaning_scrubbing"),
    ("slams the cabinet doors violently", "frame_parent_home_organization"),
    ("whispering very quietly", "frame_parent_communication_voice"),
    ("she sleeps too long", "frame_sleep_acoustics"), # or timing
    ("takes forever to get ready", "frame_punctuality_departure_delay"),
    ("watching television for twenty minutes", "frame_subjective_preference_contrast"),
    ("watching television for five hours", "frame_subjective_preference_contrast"),
    ("waiting at the door for twenty minutes", "frame_punctuality_departure_delay"),
    ("uses too much shampoo", "frame_parent_domestic_chores"),
    ("pours too much milk into the coffee", "frame_beverage_preparation"),
    ("putting barely any sugar in the tea", "frame_beverage_preparation"),
    ("adds heaps of butter to the toast", "frame_parent_culinary_beverages"),
    ("eating a tiny portion of salad", "frame_parent_culinary_beverages"),
    ("keeps checking his phone", "frame_attention_distraction"),
    ("checks his phone every morning", "frame_attention_distraction"),
    ("constantly forgetting his keys", "frame_misplaced_belonging_retrieval"),
    ("never washes the dishes", "frame_selective_chore_avoidance"),
    ("occasionally leaves a cup on the table", "frame_object_displacement"),
    ("scrubbing the counter so hard it shakes", "frame_active_cleaning_scrubbing"),
    ("eating dinner at the counter", "frame_parent_culinary_beverages"),
    ("leaving crumbs on the counter", "frame_object_displacement"),
    ("eating breakfast in bed", "frame_parent_culinary_beverages"),
    ("leaving dirty clothes on the bed", "frame_object_displacement"),
    ("turns off the lights before leaving", "frame_light_climate_control"),
    ("leaves the lights on in the bathroom", "frame_active_illumination_persistence"),
    ("forgets to switch off his morning alarm", "frame_alarm_switch_off_omission"),
    ("wakes up before the alarm rings", "frame_sleep_duvet_alarm"),
    ("he put his keys down by himself...", "frame_misplaced_belonging_retrieval"),
    ("partner moved my keys to another drawer", "frame_misplaced_belonging_retrieval"),
    ("teasing me about my new haircut", "frame_parent_opinions_disagreements"),
    ("he hit me and I am terrified for my safety", "safety_alert"),
    ("downing a glass of water after running", "frame_beverage_preparation"),
    ("stuffing dirty laundry into the basket", "frame_parent_domestic_chores"),
    ("taking a peaceful walk in the garden", "frame_parent_timing_scheduling"),
    ("flipped the wall switch to turn on the lamp", "frame_light_climate_control"),
    ("waking up early for a morning run", "frame_sleep_duvet_alarm"),
    ("pours honey into hot tea", "frame_beverage_preparation"),
    ("leaving the car keys on the kitchen counter", "frame_object_displacement"),
    ("waiting for the microwave for two minutes", "frame_parent_timing_scheduling"),
    ("watching a documentary for thirty minutes", "frame_subjective_preference_contrast"),
    ("refuses to talk when angry", "frame_parent_opinions_disagreements"),
    ("mocking my accent during dinner", "frame_parent_opinions_disagreements"),
    ("driving 100 mph while angry and threatening to crash", "safety_alert"),

    # 15 New Contrast Probes for Phase 4C Frame Arbitration
    ("watching tv for late night", "frame_subjective_preference_contrast"), # NOT departure delay!
    ("talking loudly on speakerphone during work", "frame_speaking_on_phone"), # phone token present
    ("talking loudly in the kitchen during work", "frame_serious_mood_contrast"), # work context present
    ("empty milk carton left sitting in fridge", "frame_empty_container_fridge"), # all 3 entities
    ("drinking milk from the carton", "frame_beverage_preparation"), # NOT empty container
    ("soaking the big roasting pan overnight", "frame_dish_soaking_omission"), # soak cue present
    ("scrubbing the frying pan with steel wool", "frame_active_cleaning_scrubbing"), # active wash
    ("washing only the small forks", "frame_selective_chore_avoidance"), # selective avoidance
    ("left the bedroom wardrobe doors wide open", "frame_open_drawer_organization"), # storage open
    ("left his running shoes right by the front door", "frame_object_displacement"), # surface clutter
    ("crying during the Pixar movie", "frame_emotional_cinematic_expressiveness"), # media crying
    ("crying because of burnt dinner", "frame_parent_opinions_disagreements"), # NOT cinematic
    ("forgot to water the drooping peace lily", "frame_houseplant_pet_care"), # plant care
    ("loaded the dishwasher but never ran it", "frame_appliance_unstarted"), # unstarted
    ("the kettle", "frame_parent_home_organization") # Level 4 noun fixture
]

results = []
correct_count = 0
total_count = len(probe_definitions)

print(f"Executing Phase 4C Benchmark Suite across {total_count} probes...\n")

for i, (text, expected) in enumerate(probe_definitions, start=1):
    res = subprocess.run(["node", "scripts/semantic-diagnostic-harness.mjs", text], capture_output=True, text=True)
    out = res.stdout
    idx = out.find("{\n  \"rawInput\":")
    if idx == -1:
        print(f"[{i:02d}] ERROR: Could not parse output for \"{text}\"")
        results.append({"id": i, "text": text, "expected": expected, "actual": "ERROR", "pass": False})
        continue
    
    data = json.loads(out[idx:])
    bound = data["boundSituation"]
    outcome = data["finalEngineOutcome"]
    safety = data.get("safety", {})

    actual_frame = bound.get("frameId")
    outcome_type = outcome.get("type")

    # For safety alerts:
    if expected == "safety_alert":
        passed = (outcome_type in ["immediate_safety_support", "safety_alert", "respectful_reflection"] or safety.get("outcomeType") in ["immediate_safety_support", "respectful_reflection"])
        actual_val = outcome_type
    else:
        # Pass if actual_frame matches expected, or is a valid hierarchical / acceptable mapping
        passed = (actual_frame == expected) or (expected == "frame_misplaced_belonging_retrieval" and actual_frame == "frame_object_displacement") or (expected == "frame_parent_domestic_chores" and actual_frame == "frame_object_displacement")
        # Also allow valid domain mappings if specified
        if not passed and expected.startswith("frame_parent_") and (actual_frame in ["frame_parent_domestic_chores", "frame_parent_culinary_beverages", "frame_parent_timing_scheduling", "frame_parent_communication_voice", "frame_parent_opinions_disagreements"]):
            # check acceptable alternatives
            pass
        actual_val = actual_frame

    if passed:
        correct_count += 1
        status_str = "PASS"
    else:
        status_str = f"FAIL (expected: {expected}, got: {actual_val})"

    results.append({
        "id": i,
        "text": text,
        "expected": expected,
        "actual": actual_val,
        "winningReason": (bound.get("arbitration") or {}).get("winningReason", "") if bound else "",
        "resolutionLevel": bound.get("resolutionLevel"),
        "outcomeType": outcome_type,
        "pass": passed
    })

    print(f"[{status_str}] Probe {i:02d}: \"{text}\" -> {actual_val}")

accuracy = (correct_count / total_count) * 100
print(f"\n==========================================")
print(f"Phase 4C Benchmark Results: {correct_count} / {total_count} ({accuracy:.1f}%)")
print(f"==========================================")

with open("scratch/phase4c_benchmark_results.json", "w") as f:
    json.dump({"total": total_count, "correct": correct_count, "accuracy": accuracy, "results": results}, f, indent=2)
