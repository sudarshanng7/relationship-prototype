// Frozen independent evaluation dataset across all 65 MVP situation families
// Crafted with diverse natural formulations, colloquial vocabulary, compound nouns, and realistic multi-clause framing.
// These inputs were written independently without using template substitution rules.

export const FROZEN_INDEPENDENT_EVALUATION_DATASET = [
  // Cat 01: Household chores and cleaning
  {
    familyId: "sit_01_unwashed_cups_plates",
    cat: 1,
    input: "Every afternoon there are three ceramic coffee mugs stacked right beside the kitchen basin",
    expectedOutcome: "playful_angles",
    expectedCategory: 1
  },
  {
    familyId: "sit_02_avoiding_large_cookware",
    cat: 1,
    input: "Cleans all the tiny silverware and saucers but always sidesteps the heavy roasting pan",
    expectedOutcome: "playful_angles",
    expectedCategory: 1
  },
  {
    familyId: "sit_03_dishes_soaking",
    cat: 1,
    input: "Claims the lasagna casserole dish has to soak underwater until tomorrow afternoon",
    expectedOutcome: "playful_angles",
    expectedCategory: 1
  },
  {
    familyId: "sit_04_vigorous_cleaning",
    cat: 1,
    input: "Polishing the quartz countertop with so much muscle the whole island vibrates",
    expectedOutcome: "playful_angles",
    expectedCategory: 1
  },
  {
    familyId: "sit_05_laundry_in_washer",
    cat: 1,
    input: "Finishes running the wash cycle but leaves the damp towels sitting in the drum overnight",
    expectedOutcome: "playful_angles",
    expectedCategory: 1
  },
  {
    familyId: "sit_06_forgetting_bins",
    cat: 1,
    input: "Totally spaced out rolling the recycling wheelie bin down the driveway before the truck arrived",
    expectedOutcome: "playful_angles",
    expectedCategory: 1
  },

  // Cat 02: Tidiness and organization
  {
    familyId: "sit_07_open_drawers_cupboards",
    cat: 2,
    input: "Walks out of the master bedroom leaving dresser drawers pulled open like stepping stones",
    expectedOutcome: "playful_angles",
    expectedCategory: 2
  },
  {
    familyId: "sit_08_clothes_on_chair",
    cat: 2,
    input: "Drapes worn flannel shirts and track pants over the wooden rocking chair instead of hanging them up",
    expectedOutcome: "playful_angles",
    expectedCategory: 2
  },
  {
    familyId: "sit_09_shoes_entrance",
    cat: 2,
    input: "Kicks off leather sneakers right smack in the middle of the entryway rug",
    expectedOutcome: "playful_angles",
    expectedCategory: 2
  },
  {
    familyId: "sit_10_leaving_packaging",
    cat: 2,
    input: "Unboxes online deliveries and leaves brown cardboard shipping cartons piled near the credenza",
    expectedOutcome: "playful_angles",
    expectedCategory: 2
  },
  {
    familyId: "sit_11_sofa_cushions_blankets",
    cat: 2,
    input: "Gets up from the sectional sofa leaving wool throw blankets rolled into a giant pretzel",
    expectedOutcome: "playful_angles",
    expectedCategory: 2
  },

  // Cat 03: Forgetfulness and misplaced belongings
  {
    familyId: "sit_12_searching_for_keys",
    cat: 3,
    input: "Paces back and forth turning sofa cushions inside out hunting for the car key fob",
    expectedOutcome: "playful_angles",
    expectedCategory: 3
  },
  {
    familyId: "sit_13_forgot_where_put_items",
    cat: 3,
    input: "Set down the wireless headphones five minutes ago and has no clue which room they are in",
    expectedOutcome: "playful_angles",
    expectedCategory: 3
  },
  {
    familyId: "sit_14_looking_for_nearby_item",
    cat: 3,
    input: "Frantically searching the entire kitchen for reading glasses that are resting right on top of their head",
    expectedOutcome: "playful_angles",
    expectedCategory: 3
  },

  // Cat 04: Lighting, appliances and temperature
  {
    familyId: "sit_15_bathroom_lights_on",
    cat: 4,
    input: "Breezes out of the guest bathroom leaving vanity bulbs glowing like a Broadway marquee",
    expectedOutcome: "playful_angles",
    expectedCategory: 4
  },
  {
    familyId: "sit_16_tv_left_running",
    cat: 4,
    input: "Leaves the big smart television streaming nature documentaries to completely empty armchairs",
    expectedOutcome: "playful_angles",
    expectedCategory: 4
  },
  {
    familyId: "sit_17_thermostat_ac_debate",
    cat: 4,
    input: "Crank down the hallway climate control until everyone inside needs a goose-down parka",
    expectedOutcome: "playful_angles",
    expectedCategory: 4
  },
  {
    familyId: "sit_18_fridge_empty_container",
    cat: 4,
    input: "Finishes the apple cider and puts the featherlight empty jug right back on the refrigerator shelf",
    expectedOutcome: "playful_angles",
    expectedCategory: 4
  },
  {
    familyId: "sit_19_appliance_loaded_unstarted",
    cat: 4,
    input: "Packed every single plate and utensil into the dishwasher rack but forgot to press the start button",
    expectedOutcome: "playful_angles",
    expectedCategory: 4
  },

  // Cat 05: Bathroom and grooming habits
  {
    familyId: "sit_20_toothpaste_cap_tube",
    cat: 5,
    input: "Squeezes the peppermint toothpaste from the exact center and forgets to screw the lid back on",
    expectedOutcome: "playful_angles",
    expectedCategory: 5
  },
  {
    familyId: "sit_21_wet_towels_bathroom",
    cat: 5,
    input: "Steps out of the hot shower and drops a damp bath towel into a damp pile on the bathmat",
    expectedOutcome: "playful_angles",
    expectedCategory: 5
  },
  {
    familyId: "sit_22_shower_takes_forever",
    cat: 5,
    input: "Stays under the hot shower stream for fifty uninterrupted minutes until the mirrors vanish in steam",
    expectedOutcome: "playful_angles",
    expectedCategory: 5
  },

  // Cat 06: Cooking and food preparation
  {
    familyId: "sit_23_namesake_milk_tea",
    cat: 6,
    input: "Pours a tiny splash of oat milk into hot water and calls it an authentic artisan latte",
    expectedOutcome: "playful_angles",
    expectedCategory: 6
  },
  {
    familyId: "sit_24_overcomplicating_recipes",
    cat: 6,
    input: "Mobilizes seven distinct pans, three whisks, and a thermometer just to toast a plain bagel",
    expectedOutcome: "playful_angles",
    expectedCategory: 6
  },
  {
    familyId: "sit_25_cooking_tasting_ritual",
    cat: 6,
    input: "Dips a wooden ladle into the marinara stew fifteen consecutive times while stirring dinner",
    expectedOutcome: "playful_angles",
    expectedCategory: 6
  },

  // Cat 07: Eating, drinking and sharing food
  {
    familyId: "sit_26_stealing_fries_plate",
    cat: 7,
    input: "Insists she is completely full then keeps plucking golden french fries directly off my dish",
    expectedOutcome: "playful_angles",
    expectedCategory: 7
  },
  {
    familyId: "sit_27_eating_last_slice",
    cat: 7,
    input: "Swipes the very last slice of sourdough pizza straight off the cardboard box without checking with anyone",
    expectedOutcome: "playful_angles",
    expectedCategory: 7
  },
  {
    familyId: "sit_28_leaving_one_sip",
    cat: 7,
    input: "Leaves a single microscopic thimble of iced tea at the bottom of the tall tumbler",
    expectedOutcome: "playful_angles",
    expectedCategory: 7
  },

  // Cat 08: Sleep and bedtime habits
  {
    familyId: "sit_29_snoring_bedtime_noises",
    cat: 8,
    input: "Drifting off into deep slumber and emitting rhythmic chainsaw snores that shake the bedside lamp",
    expectedOutcome: "playful_angles",
    expectedCategory: 8
  },
  {
    familyId: "sit_30_stealing_blankets",
    cat: 8,
    input: "Twirls in their sleep like an alligator and drags the entire down comforter over to their side",
    expectedOutcome: "playful_angles",
    expectedCategory: 8
  },
  {
    familyId: "sit_31_falling_asleep_movie",
    cat: 8,
    input: "Begs to watch a suspenseful crime thriller then dozes off sound asleep eight minutes in",
    expectedOutcome: "playful_angles",
    expectedCategory: 8
  },

  // Cat 09: Morning routines and alarms
  {
    familyId: "sit_32_alarm_ringing_unstopped",
    cat: 9,
    input: "Sleeps blissfully through an ear-piercing digital alarm chime that echoes across the whole hallway",
    expectedOutcome: "playful_angles",
    expectedCategory: 9
  },
  {
    familyId: "sit_33_multiple_snooze_alarms",
    cat: 9,
    input: "Sets seven staggered wakeup alerts between 6am and 7am and taps snooze on every single one",
    expectedOutcome: "playful_angles",
    expectedCategory: 9
  },
  {
    familyId: "sit_34_slow_morning_boot",
    cat: 9,
    input: "Stumbles into the kitchen like a slow-loading computer operating at five percent cognitive capacity",
    expectedOutcome: "playful_angles",
    expectedCategory: 9
  },

  // Cat 10: Speaking and conversational habits
  {
    familyId: "sit_35_loud_phone_speaking",
    cat: 10,
    input: "Takes conference speakerphone calls at stadium rock volume while wandering through the kitchen",
    expectedOutcome: "playful_angles",
    expectedCategory: 10
  },
  {
    familyId: "sit_36_conversational_decibel",
    cat: 10,
    input: "Tells an everyday anecdote about grocery shopping with the vocal power of an opera performer",
    expectedOutcome: "playful_angles",
    expectedCategory: 10
  },
  {
    familyId: "sit_37_repeating_same_story",
    cat: 10,
    input: "Shares that exact story about their college road trip for the ninth time this month",
    expectedOutcome: "playful_angles",
    expectedCategory: 10
  },

  // Cat 11: Humor, teasing and comic timing
  {
    familyId: "sit_38_silly_noise_serious_moment",
    cat: 11,
    input: "Lets out an absurd Donald Duck squawk right in the middle of budgeting discussions",
    expectedOutcome: "playful_angles",
    expectedCategory: 11
  },
  {
    familyId: "sit_39_bad_puns_wordplay",
    cat: 11,
    input: "Drops agonizingly cheesy dad jokes whenever anyone mentions grocery items at dinner",
    expectedOutcome: "playful_angles",
    expectedCategory: 11
  },

  // Cat 12: Emotional and expressive quirks
  {
    familyId: "sit_40_crying_at_movies",
    cat: 12,
    input: "Wipes away genuine tears during sentimental pet adoption television commercials",
    expectedOutcome: "playful_angles",
    expectedCategory: 12
  },
  {
    familyId: "sit_41_emotional_fictional_attachment",
    cat: 12,
    input: "Gets deeply heartbroken and solemn when an animated raccoon loses its family in a cartoon",
    expectedOutcome: "playful_angles",
    expectedCategory: 12
  },

  // Cat 13: Opinions, tastes and preferences
  {
    familyId: "sit_42_watches_boring_videos",
    cat: 13,
    input: "Mesmerized for two solid hours watching videos of industrial timber processing machinery",
    expectedOutcome: "playful_angles",
    expectedCategory: 13
  },
  {
    familyId: "sit_43_opinion_proposition_exercise",
    cat: 13,
    input: "Passionately argues that gentle stretching routines should never count as genuine physical workout",
    expectedOutcome: "playful_angles",
    expectedCategory: 13
  },

  // Cat 14: Decision-making and indecision
  {
    familyId: "sit_44_dinner_indecision_debate",
    cat: 14,
    input: "Takes forty-five minutes scrolling through food delivery menus without picking a single takeout dish",
    expectedOutcome: "playful_angles",
    expectedCategory: 14
  },
  {
    familyId: "sit_45_anything_is_fine_response",
    cat: 14,
    input: "Claims any dinner cuisine is wonderful then vetoes four distinct restaurant proposals in a row",
    expectedOutcome: "playful_angles",
    expectedCategory: 14
  },

  // Cat 15: Affectionate and playful habits
  {
    familyId: "sit_46_funny_nicknames",
    cat: 15,
    input: "Invents ridiculous rhyming pet names like Captain Pumpernickel when talking to me in the kitchen",
    expectedOutcome: "playful_angles",
    expectedCategory: 15
  },
  {
    familyId: "sit_47_cute_repetitive_rituals",
    cat: 15,
    input: "Does a goofy three-step victory dance whenever finding matching clean socks in the basket",
    expectedOutcome: "playful_angles",
    expectedCategory: 15
  },

  // Cat 16: Personal and bodily habits
  {
    familyId: "sit_48_finger_tapping_humming",
    cat: 16,
    input: "Drumming pencils and tapping fingertips rhythmically on the tabletop during dinner",
    expectedOutcome: "playful_angles",
    expectedCategory: 16
  },
  {
    familyId: "sit_49_random_house_singing",
    cat: 16,
    input: "Belting out improvised opera melodies about finding mustard in the pantry",
    expectedOutcome: "playful_angles",
    expectedCategory: 16
  },

  // Cat 17: Phones, technology and digital habits
  {
    familyId: "sit_50_phone_scrolling_bed_dinner",
    cat: 17,
    input: "Hypnotized scrolling through viral video feeds while sitting at the candlelit dinner table",
    expectedOutcome: "playful_angles",
    expectedCategory: 17
  },
  {
    familyId: "sit_51_hundred_browser_tabs",
    cat: 17,
    input: "Hoarding eighty-four open research tabs on mobile safari and refusing to close any of them",
    expectedOutcome: "playful_angles",
    expectedCategory: 17
  },

  // Cat 18: Entertainment, hobbies and fitness
  {
    familyId: "sit_52_rewatching_same_shows",
    cat: 18,
    input: "Rewatching the entire comfort sitcom series for the twelfth time instead of starting anything new",
    expectedOutcome: "playful_angles",
    expectedCategory: 18
  },
  {
    familyId: "sit_53_intense_hobby_absorption",
    cat: 18,
    input: "Disappears into the garage workshop for six hours perfecting the finish on miniature wooden birdhouses",
    expectedOutcome: "playful_angles",
    expectedCategory: 18
  },

  // Cat 19: Punctuality, preparation and planning
  {
    familyId: "sit_54_departure_door_delay",
    cat: 19,
    input: "Stands fully booted by the front entrance while partner looks for their jacket for twenty minutes",
    expectedOutcome: "playful_angles",
    expectedCategory: 19
  },
  {
    familyId: "sit_55_last_minute_packing",
    cat: 19,
    input: "Stuffing mismatched socks and toiletries into the duffle bag three minutes before the airport shuttle arrives",
    expectedOutcome: "playful_angles",
    expectedCategory: 19
  },

  // Cat 20: Shopping, spending preferences and errands
  {
    familyId: "sit_56_buying_another_mug",
    cat: 20,
    input: "Purchasing yet another pottery coffee mug when our kitchen cupboard is already bursting at the seams",
    expectedOutcome: "playful_angles",
    expectedCategory: 20
  },
  {
    familyId: "sit_57_browsing_every_supermarket_aisle",
    cat: 20,
    input: "Methodically walking down every single grocery row when we only came in to buy paper towels",
    expectedOutcome: "playful_angles",
    expectedCategory: 20
  },

  // Cat 21: Travel, driving and navigation
  {
    familyId: "sit_58_direction_debate_gps",
    cat: 21,
    input: "Argues with the turn-by-turn navigation voice and takes an adventurous forty-minute detour through farm roads",
    expectedOutcome: "playful_angles",
    expectedCategory: 21
  },
  {
    familyId: "sit_59_overpacking_weekend_bags",
    cat: 21,
    input: "Packing four heavy suitcases and eight pairs of boots for a two-night weekend trip to the suburbs",
    expectedOutcome: "playful_angles",
    expectedCategory: 21
  },

  // Cat 22: Work, study and concentration
  {
    familyId: "sit_60_talking_during_focus",
    cat: 22,
    input: "Busts into the home study with funny internet gossip while partner is on an important client video call",
    expectedOutcome: "playful_angles",
    expectedCategory: 22
  },
  {
    familyId: "sit_61_desk_mug_collection",
    cat: 22,
    input: "Accumulates a fortress of seven empty ceramic mugs across the computer desk over the week",
    expectedOutcome: "playful_angles",
    expectedCategory: 22
  },

  // Cat 23: Social life, family and celebrations
  {
    familyId: "sit_62_long_goodbyes_party",
    cat: 23,
    input: "Engages in an epic thirty-minute farewell speech while lingering with the front door wide open",
    expectedOutcome: "playful_angles",
    expectedCategory: 23
  },
  {
    familyId: "sit_63_taking_hundred_photos",
    cat: 23,
    input: "Makes everyone freeze their forks for fifteen minutes to stage fifty food pictures from multiple angles",
    expectedOutcome: "playful_angles",
    expectedCategory: 23
  },

  // Cat 24: Caregiving, pets, plants and shared routines
  {
    familyId: "sit_64_forgetting_to_water_plants",
    cat: 24,
    input: "The living room ferns are thirsty and sagging because nobody gave them water all fortnight",
    expectedOutcome: "playful_angles",
    expectedCategory: 24
  },
  {
    familyId: "sit_65_talking_to_pets_voice",
    cat: 24,
    input: "Speaking to the ginger cat in high-pitched baby coos asking how its important executive day went",
    expectedOutcome: "playful_angles",
    expectedCategory: 24
  }
];
