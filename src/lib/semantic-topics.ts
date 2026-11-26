/**
 * Semantic Topic Taxonomy for Couple Annoyances and Playful Reframing.
 *
 * Covers 17 broad families with 65+ couple-centric subtopics.
 * Provides multi-variant, non-blaming tone profiles:
 * - Gentle and cute (soft, affectionate, humanizing)
 * - More playful (light domestic humor, mini-stories)
 * - Slightly exaggerated (theatrical absurdity without cruelty)
 */

export interface TopicToneProfiles {
  gentle: string[];
  playful: string[];
  exaggerated: string[];
}

export interface SemanticTopic {
  id: string;
  family: string;
  label: string;
  entities: string[];
  synonyms: string[];
  actions: string[];
  locations?: string[];
  phrases?: string[];
  relatedTopics?: string[];
  semanticHints?: string[];
  behaviors?: string[];
  sensitivity?: "light" | "interpersonal" | "boundary";
  excludeWhenTokens?: string[];
  toneProfiles: TopicToneProfiles;
}

export const SEMANTIC_TOPICS: SemanticTopic[] = [
  // ==========================================
  // FAMILY A: Household upkeep
  // ==========================================
  {
    id: "dishes_sink",
    family: "household_upkeep",
    label: "Dishes in sink",
    entities: ["dishes", "plates", "bowls", "pans", "pots", "cutlery", "forks", "spoons", "coffee mug", "coffee mugs", "mug", "mugs"],
    synonyms: ["dish", "cookware", "tableware", "crockery", "cup", "cups"],
    actions: ["piled", "stacked", "left", "sitting", "soaking", "unwashed", "dirty"],
    locations: ["sink", "basin", "counter", "kitchen", "table"],
    phrases: ["dishes in the sink", "soaking in the sink", "pile of dishes", "unwashed coffee mug"],
    relatedTopics: ["dishwasher_unstarted", "dishwasher_unemptied", "kitchen_counter_mess"],
    toneProfiles: {
      gentle: [
        "The dishes and mugs are enjoying a warm little pool party in the sink before bedtime.",
        "A peaceful gathering of plates having a calm reunion in the kitchen basin.",
        "The dishes seem to believe soaking is a very essential part of their wellness spa.",
        "One little stack of plates patiently waiting for its afternoon bath.",
      ],
      playful: [
        "The kitchen sink has officially opened its seasonal ceramic water park.",
        "A delicate architectural tower of plates attempting to set a world record.",
        "The forks and spoons are holding a quiet symposium at the bottom of the basin.",
        "Apparently soaking dishes is an artistic ritual requiring at least twelve hours.",
      ],
      exaggerated: [
        "Breaking news: archaeologists arrive to excavate legendary ancient ceramic ruins in the sink.",
        "Alert: the leaning tower of plates has been designated an official domestic landmark.",
        "Scientific symposium convenes to study the infinite soaking potential of this frying pan.",
        "The sink has declared sovereign oceanic jurisdiction over all submerged tableware.",
      ],
    },
  },
  {
    id: "dishwasher_unstarted",
    family: "household_upkeep",
    label: "Dishwasher not started",
    entities: ["dishwasher", "dish washer", "dish-washer", "machine", "cycle"],
    synonyms: ["appliance", "washer"],
    actions: ["not started", "unstarted", "forgot to start", "never started", "didn't run", "waiting"],
    locations: ["kitchen"],
    phrases: ["dishwasher not started", "forgot to run dishwasher", "forgot to push start"],
    relatedTopics: ["dishes_sink", "dishwasher_unemptied"],
    toneProfiles: {
      gentle: [
        "The dishwasher is resting peacefully, waiting for someone to press its magic start button.",
        "The loaded dishwasher is taking a quiet breath before it begins its evening dance.",
        "All the mugs inside are buckled in and ready for their warm wash cycle.",
        "The dishwasher is fully prepped and just waiting for its opening cue.",
      ],
      playful: [
        "The dishwasher is fully packed but apparently waiting for opening night tickets to go on sale.",
        "The dishes are on strike until someone performs the official button-pushing ceremony.",
        "The dishwasher has decided it only operates during prime theatrical hours.",
        "All dressed up with everywhere to clean, but waiting for the green light.",
      ],
      exaggerated: [
        "Alert: the dishwasher union demands a formal ribbon-cutting ceremony before starting its spin.",
        "Breaking: dishes inside stage a peaceful protest awaiting the sacred detergent tablet.",
        "National authorities confirm the start button requires a presidential executive order tonight.",
        "The dishwasher is holding out for royal clearance before embarking on its voyage.",
      ],
    },
  },
  {
    id: "dishwasher_unemptied",
    family: "household_upkeep",
    label: "Dishwasher not emptied",
    entities: ["dishwasher", "dish washer", "clean dishes", "clean mugs"],
    synonyms: ["clean machine"],
    actions: ["not emptied", "unemptied", "still full", "never unloaded", "forgot to unload", "left clean"],
    locations: ["kitchen"],
    phrases: ["clean dishwasher sitting full", "nobody unloads the dishwasher", "dishwasher left full"],
    relatedTopics: ["dishwasher_unstarted", "dishes_sink"],
    toneProfiles: {
      gentle: [
        "The sparkling clean dishes are enjoying their cozy little steam sauna.",
        "Clean plates are resting comfortably in their warm stainless-steel haven.",
        "The mugs are perfectly happy lounging together in their shiny clean bunker.",
        "Everything inside is squeaky clean and taking an unhurried resting pause.",
      ],
      playful: [
        "The dishwasher has transitioned from cleaning appliance into a convenient secondary cupboard.",
        "Why put clean plates in cupboards when they look so modern living right in the machine?",
        "The mugs have decided that living in the dishwasher is far more convenient.",
        "A boutique pop-up tableware boutique currently open directly inside the dishwasher door.",
      ],
      exaggerated: [
        "Breaking: interior designers praise revolutionary open-concept living inside the dishwasher.",
        "Alert: clean plates refuse repatriation to high cupboards, citing dishwasher luxury amenities.",
        "Cabinet makers file formal complaint as dishwasher takes over ninety percent of kitchen storage.",
        "Census confirms entire ceramic populace has permanently relocated into the dishwasher.",
      ],
    },
  },
  {
    id: "laundry_clothes_floor",
    family: "household_upkeep",
    label: "Clothes/laundry left around",
    entities: ["clothes", "laundry", "socks", "shirt", "pants", "jeans", "hoodie", "t-shirt"],
    synonyms: ["garments", "wardrobe", "outfit"],
    actions: ["left on floor", "scattered", "lying around", "dropped", "on the floor", "piled"],
    locations: ["floor", "bedroom", "chair", "sofa", "carpet"],
    phrases: ["clothes on the floor", "pile of clothes", "laundry everywhere"],
    relatedTopics: ["towels_wet", "general_clutter"],
    toneProfiles: {
      gentle: [
        "Those soft clothes seem to enjoy resting comfortably right where the day ended.",
        "A cozy little garment trail marking today's comfortable adventures through the house.",
        "A friendly pair of socks relaxing on the carpet after a long journey.",
        "The clothes found a peaceful resting spot on the floor to recharge.",
      ],
      playful: [
        "The bedroom chair has officially achieved its full potential as a mountain of fabric.",
        "The clothes have staged an artistic floor installation titled 'Comfort in Repose'.",
        "A scenic hiking path through the living room marked by occasional friendly hoodies.",
        "The carpet is experimenting with soft, textile-forward interior decorating.",
      ],
      exaggerated: [
        "Breaking news: floor claims permanent sovereignty over the current seasonal wardrobe.",
        "Mount Laundry has officially been registered as the bedroom's highest geological peak.",
        "Botanists discover a rare fabric ecosystem flourishing natively across the bedroom carpet.",
        "World runway council announces carpet floor as the ultimate avant-garde fashion showcase.",
      ],
    },
  },
  {
    id: "towels_wet",
    family: "household_upkeep",
    label: "Wet towels left around",
    entities: ["towel", "bath towel", "towels", "washcloth"],
    synonyms: ["damp towel"],
    actions: ["wet", "damp", "left on floor", "on the bed", "dropped", "hanging", "soaked"],
    locations: ["bathroom", "bed", "floor", "door", "bedroom"],
    phrases: ["wet towel on the bed", "damp towel on floor", "towel left crumpled"],
    relatedTopics: ["bathroom_mess", "laundry_clothes_floor"],
    toneProfiles: {
      gentle: [
        "One little towel taking a cozy nap after drying everyone off so well.",
        "A faithful towel resting quietly after its warm morning shower duties.",
        "The towel seems to appreciate a gentle pause before returning to its rail.",
        "A sleepy damp towel lounging peacefully where the morning routine paused.",
      ],
      playful: [
        "The towel is experimenting with becoming a decorative moisture blanket for the bed.",
        "A courageous bath towel attempting to recreate the humid atmosphere of a rainforest.",
        "The towel is auditioning for the role of indoor water feature on the bedroom floor.",
        "Apparently wet towels believe they dry fastest when crumpled into a mysterious ball.",
      ],
      exaggerated: [
        "Breaking news: local bed declared a certified wetland habitat by domestic authorities.",
        "Alert: towel claims squatter rights on the duvet, citing its moisture contributions.",
        "Meteorologists track isolated tropical rainstorms originating directly from the crumpled towel.",
        "Geological survey detects fresh natural springs forming beneath the bathroom floor towel.",
      ],
    },
  },
  {
    id: "trash_recycling",
    family: "household_upkeep",
    label: "Trash and recycling overflow",
    entities: ["trash", "rubbish", "garbage", "bin", "recycling", "can", "waste"],
    synonyms: ["refuse", "wastebasket"],
    actions: ["overflowing", "full", "not taken out", "piled high", "stuffed", "forgot to empty"],
    locations: ["kitchen", "hallway", "door", "under the sink"],
    phrases: ["trash is overflowing", "bin is full", "forgot to take out the trash", "take out the recycling"],
    relatedTopics: ["general_clutter", "packaging_boxes"],
    toneProfiles: {
      gentle: [
        "The little bin is feeling very proud of how much it has gathered for the household.",
        "A loyal wastebasket that has quietly done its duty and is ready for its morning refresh.",
        "The recycling bin is brimming with memories of delicious recent meals and packages.",
        "A cozy little bin holding everything safely until its next walk outside.",
      ],
      playful: [
        "The bin is currently participating in high-stakes domestic Jenga with empty cartons.",
        "A courageous game of garbage Tetris where gravity is merely a gentle suggestion.",
        "The recycling bin is attempting to touch the kitchen ceiling in a bid for greatness.",
        "Apparently taking the bin bag outside requires an official royal proclamation.",
      ],
      exaggerated: [
        "Breaking news: municipal waste authorities recognize the kitchen bin as an independent pyramid.",
        "Alert: structural engineers called in to inspect top-heavy architectural recycling sculpture.",
        "Guinness World Records reviews incredible one-finger balancing act atop the kitchen trash.",
        "The bin has declared itself a mountain summit and awaits the first flag of conquest.",
      ],
    },
  },
  {
    id: "cabinets_drawers_open",
    family: "household_upkeep",
    label: "Cabinets and drawers left open",
    entities: ["cabinet", "cupboard", "drawer", "cabinets", "drawers", "wardrobe drawers", "dresser drawers"],
    synonyms: ["presses", "cupboards", "wardrobe door", "wardrobe"],
    actions: ["open", "left open", "ajar", "wide open", "unshut", "never closed", "half opened", "half open"],
    locations: ["kitchen", "bedroom", "bathroom", "dresser", "wardrobe"],
    phrases: ["cabinet doors open", "drawers left open", "cupboard wide open", "drawers are always half opened", "wardrobe drawers"],
    relatedTopics: ["general_clutter", "kitchen_counter_mess"],
    toneProfiles: {
      gentle: [
        "The cabinet drawers and cupboards seem to enjoy keeping one little eye open to peek at the room.",
        "Friendly little cabinet drawers opening their arms to take a deep, relaxed stretch.",
        "The wardrobe drawers are enjoying the fresh room air and resting comfortably ajar.",
        "A hospitable room where drawers and doors simply love greeting you warmly.",
      ],
      playful: [
        "The wardrobe drawers have officially adopted a permanent open-door policy.",
        "Apparently closing drawers all the way would spoil the dramatic reveal of favorite cozy clothes.",
        "The open drawers have formed a clever, step-by-step staircase for ambitious daydreamers.",
        "A modern design movement celebrating half-opened drawers as intentional architectural flair.",
      ],
      exaggerated: [
        "Breaking news: wardrobe drawers refuse complete closure pending formal treaty negotiations.",
        "Alert: local half-opened drawers declared an interactive three-dimensional modern art installation.",
        "Living room obstacle course expanded as drawers claim extra dimensional clearance.",
        "Architectural digest nominates our half-open wardrobe drawers for avant-garde domestic innovation.",
      ],
    },
  },
  {
    id: "bed_unmade",
    family: "household_upkeep",
    label: "Bed not made",
    entities: ["bed", "duvet", "sheets", "pillows", "blanket", "comforter"],
    synonyms: ["bedding", "mattress"],
    actions: ["unmade", "messy", "tangled", "rumpled", "not made", "twisted"],
    locations: ["bedroom"],
    phrases: ["bed not made", "messy bed", "rumpled sheets"],
    relatedTopics: ["sleep_routines", "general_clutter"],
    toneProfiles: {
      gentle: [
        "The duvet is resting in a cozy cloud, perfectly ready for tonight's cuddles.",
        "A warm nest of blankets keeping the sweet memories of sleep safe and sound.",
        "The bed is holding onto its soft morning hug until bedtime comes around again.",
        "A relaxed comforter taking an unhurried day off from military hospital corners.",
      ],
      playful: [
        "The pillows have arranged themselves into an avant-garde modern sculpture.",
        "A boutique hotel experience where the bed stays authentically lived-in all day.",
        "The duvet has chosen an impressionist wave aesthetic over boring hospital corners.",
        "Making the bed is postponed so the mattress can breathe in the ambient room vibes.",
      ],
      exaggerated: [
        "Breaking: bed linen union passes unanimous resolution declaring hospital corners obsolete.",
        "Art critics praise the dramatic emotional turmoil represented by the tangled duvet.",
        "Geological survey confirms duvet has formed natural hills and mountain valleys for the day.",
        "Bed declares itself an official cozy refuge territory exempt from morning tidiness decrees.",
      ],
    },
  },
  {
    id: "toilet_roll_empty",
    family: "household_upkeep",
    label: "Toilet roll empty or not replaced",
    entities: ["toilet roll", "toilet paper", "cardboard tube", "roll", "holder", "tube"],
    synonyms: ["loo roll", "tissue roll"],
    actions: ["empty", "not replaced", "left beside", "ran out", "finished", "sitting on top"],
    locations: ["bathroom", "toilet", "loo", "restroom"],
    phrases: ["empty toilet paper roll", "cardboard tube left on holder", "toilet roll not replaced", "empty tube beside"],
    relatedTopics: ["bathroom_mess", "packaging_residue"],
    toneProfiles: {
      gentle: [
        "The little cardboard tube has finished its faithful service and rests peacefully.",
        "A sweet little empty roll that faithfully held things together until the very last sheet.",
        "The roll holder is patiently waiting to welcome its fresh new fluffy companion.",
        "A quiet pause in the bathroom while the next soft roll steps up to the plate.",
      ],
      playful: [
        "The empty cardboard tube has achieved tenure and refuses to vacate its post on the holder.",
        "A delicate ritual where the new toilet roll must balance precariously atop the empty tube.",
        "Replacing the toilet roll is treated like defusing a delicate clockwork device.",
        "The cardboard cylinder is holding down the fort until official relief troops arrive.",
      ],
      exaggerated: [
        "Breaking: cardboard cylinder declares sovereignty over the chrome bathroom dispenser.",
        "Alert: international engineering team summoned to solve mystery of how the new roll goes on the spindle.",
        "Historic monument status granted to the brave lone cardboard tube resting on the ceramic cistern.",
        "Bathroom authorities declare a state of soft-tissue emergency pending roll installation.",
      ],
    },
  },

  // ==========================================
  // FAMILY B: Lights / energy / climate
  // ==========================================
  {
    id: "lights_left_on",
    family: "energy_climate",
    label: "Lights left on",
    entities: ["light", "lamp", "lights", "spotlight", "chandelier", "bulb"],
    synonyms: ["illumination", "fixture"],
    actions: ["left on", "staying on", "always on", "burning", "forgot to turn off", "shining"],
    locations: ["bathroom", "hallway", "kitchen", "living room", "bedroom", "porch", "closet"],
    phrases: ["bathroom light on", "lights left burning", "left the lights on"],
    relatedTopics: ["heater_ac_open", "thermostat_debate"],
    toneProfiles: {
      gentle: [
        "Looks like the light enjoys staying up a little longer than everyone else.",
        "The lamp seems very dedicated to keeping the space warmly and lovingly lit.",
        "One friendly light keeping a sweet, quiet watch over the sleeping house.",
        "The bulb is doing its best to make sure nobody bumps a toe in the night.",
      ],
      playful: [
        "Apparently the bathroom light has decided it needs its own 24-hour spotlight.",
        "The hallway lamp is auditioning for an around-the-clock coastal lighthouse role.",
        "The kitchen lights believe they are responsible for heating the entire solar system.",
        "A bright and cheery domestic festival where every switch celebrates being turned on.",
      ],
      exaggerated: [
        "Breaking news: the bathroom light has officially applied for permanent diplomatic residency.",
        "Alert: astronomers confirm the hallway light is visible from orbit and guiding satellites.",
        "The electric meter is currently spinning fast enough to power a small particle accelerator.",
        "Municipal power grid thanks our living room for single-handedly financing this quarter's budget.",
      ],
    },
  },
  {
    id: "heater_ac_open",
    family: "energy_climate",
    label: "Window or door open with AC / heating",
    entities: ["balcony door", "window", "heater", "radiator", "ac", "air conditioner"],
    synonyms: ["heating", "climate control", "open window", "open balcony"],
    actions: ["open while heating", "open with ac", "blowing outside", "wasting heat", "running"],
    locations: ["balcony", "window", "living room", "patio"],
    phrases: ["balcony door open while heater is running", "window open with ac on", "heating the neighborhood"],
    relatedTopics: ["lights_left_on", "thermostat_debate"],
    excludeWhenTokens: ["act", "action", "acting", "actual"],
    toneProfiles: {
      gentle: [
        "A kindhearted attempt to share our cozy home temperature with the friendly outdoor birds.",
        "Two lovers of fresh breezes balancing warm radiators with cool outdoor air.",
        "A peaceful meeting of outdoor breezes and indoor warmth mingling together.",
        "The room is finding its own gentle harmony between cozy blankets and crisp air.",
      ],
      playful: [
        "We are very generously attempting to heat the entire neighborhood one balcony at a time.",
        "The radiator and the open balcony door are engaged in a high-stakes climate summit.",
        "A bold scientific experiment to create an indoor-outdoor tropical microclimate.",
        "The heater is trying its best to warm up every passing cloud outside.",
      ],
      exaggerated: [
        "Breaking news: local couple takes personal responsibility for heating the Northern Hemisphere.",
        "Meteorological institute thanks this balcony for altering the regional seasonal forecast.",
        "The air conditioner and open window enter official peace negotiations brokered by the thermostat.",
        "Neighbors gather outside the window with beach towels to enjoy the donated tropical warmth.",
      ],
    },
  },
  {
    id: "thermostat_debate",
    family: "energy_climate",
    label: "Thermostat and temperature debates",
    entities: ["thermostat", "temperature", "heat", "cold", "fan", "ac", "degrees"],
    synonyms: ["climate", "microclimate", "room temperature"],
    actions: ["too cold", "too hot", "freezing", "sweltering", "turned down", "turned up", "adjusting", "complaining"],
    locations: ["living room", "bedroom", "house", "room"],
    phrases: [
      "freezing in the house",
      "thermostat turned down",
      "too hot in here",
      "disagree on temperature",
      "complains about room temperature",
    ],
    relatedTopics: ["heater_ac_open", "lights_left_on"],
    excludeWhenTokens: ["act", "action", "acting", "actual"],
    toneProfiles: {
      gentle: [
        "Two loving travelers who just happen to enjoy slightly different weather and personal seasons.",
        "A sweet, cozy dance between someone who loves summer and someone who loves crisp autumn.",
        "Two hearts warm enough to bridge a five-degree temperature difference.",
        "A cozy cuddle opportunity disguised as a thermostat debate.",
      ],
      playful: [
        "One of us is dressed for an Arctic dogsled expedition while the other is in beachwear.",
        "The thermostat dial has become the most contested button in our domestic democracy.",
        "The living room currently features two distinct, localized weather forecasts.",
        "A quiet covert operation to adjust the thermostat dial when nobody is looking.",
      ],
      exaggerated: [
        "Breaking: United Nations climate summit called to resolve severe living room temperature rift.",
        "Polar bears sighted migrating across the hallway while the kitchen declares a Sahara heatwave.",
        "The thermostat undergoes biometric security lockdown to prevent midnight undercover dial shifts.",
        "Diplomatic peace treaties signed in wool blankets to survive the great living room climate debate.",
      ],
    },
  },

  // ==========================================
  // FAMILY C: Personal belongings
  // ==========================================
  {
    id: "shoes_slippers_hallway",
    family: "personal_belongings",
    label: "Shoes / slippers / flippers left out",
    entities: ["shoes", "slippers", "flippers", "flip-flops", "trainers", "sneakers", "boots", "sandals"],
    synonyms: ["footwear", "clogs"],
    actions: ["scattered", "in the hallway", "middle of room", "removed anywhere", "tripping", "left out", "by the front door", "by the door"],
    locations: ["hallway", "entrance", "doorway", "front door", "living room", "house"],
    phrases: ["flippers are removed anywhere", "shoes in the hallway", "slippers left out", "tripping over shoes", "trainers left by the front door"],
    relatedTopics: ["laundry_clothes_floor", "general_clutter"],
    toneProfiles: {
      gentle: [
        "A cozy pair of slippers and flippers resting quietly wherever the journey paused.",
        "Those soft shoes seem so happy to be home that they settled down right away.",
        "Friendly footwear standing by, ready to welcome cozy feet whenever needed.",
        "A pair of shoes taking an honest rest after carrying someone we love all day.",
      ],
      playful: [
        "The slippers have embarked on an independent expedition across the living room carpet.",
        "An obstacle course carefully designed to keep our daily agility in peak condition.",
        "Those shoes have formed a welcoming committee positioned directly in the front doorway.",
        "Apparently shoes believe the floor is a vast open pasture meant for free-range roaming.",
      ],
      exaggerated: [
        "Breaking news: rogue footwear establishes an independent sovereign republic in the hallway.",
        "Alert: local floor designated an international runway showcase for wandering slippers.",
        "Olympic committee introduces hallway shoe hurdle navigation as a brand-new competitive sport.",
        "Footwear population achieves sentience and begins peaceful migration toward the sofa.",
      ],
    },
  },
  {
    id: "keys_wallet_misplaced",
    family: "personal_belongings",
    label: "Keys or wallet misplaced",
    entities: ["keys", "car keys", "wallet", "purse", "badge", "glasses"],
    synonyms: ["keyring", "cards"],
    actions: ["lost", "misplaced", "disappeared", "can't find", "missing", "hunting for", "forgot where"],
    locations: ["counter", "bag", "sofa", "drawer"],
    phrases: ["where are the keys", "can't find wallet", "keys misplaced again", "lost my glasses"],
    relatedTopics: ["charger_wandering", "general_clutter"],
    toneProfiles: {
      gentle: [
        "Those little keys are just playing a quiet, affectionate game of hide-and-seek.",
        "A sweet pause in the morning while everyday belongings find their way back home.",
        "The wallet is resting comfortably in a secret cozy nook waiting for a smile.",
        "Important little items taking a gentle breather before the next outdoor trip.",
      ],
      playful: [
        "The keys have decided to test our detective skills before allowing us to leave the house.",
        "The wallet is playing domestic hide-and-seek and is currently in first place.",
        "Apparently car keys have an active social life in places we would never suspect.",
        "A morning ritual where the sofa cushions collect their customary offering of lost items.",
      ],
      exaggerated: [
        "Breaking: Scotland Yard dispatched to locate the mysterious whereabouts of the front door key.",
        "Archaeological expedition uncovers forgotten civilizations beneath the cushions before finding the wallet.",
        "The keys have entered the witness protection program under an assumed identity inside a handbag.",
        "Scientists confirm the car keys exist in a quantum state of being everywhere except in the key bowl.",
      ],
    },
  },
  {
    id: "charger_wandering",
    family: "personal_belongings",
    label: "Phone charger migrating",
    entities: ["charger", "cable", "phone charger", "cord", "charging cable", "adapter"],
    synonyms: ["plug", "power cord"],
    actions: ["migrating", "moved", "missing", "disappeared", "taken", "stolen", "swapped", "wandering", "borrows", "borrowed", "without returning"],
    locations: ["bedroom", "living room", "kitchen", "office", "sofa"],
    phrases: ["charger keeps migrating", "who took my charger", "charger moved to another room", "cable is missing", "borrows charger without returning it"],
    relatedTopics: ["devices_uncharged", "phone_habits"],
    toneProfiles: {
      gentle: [
        "The little charger seems to enjoy exploring the house almost as much as we do.",
        "A faithful power cord that loves sharing its energy with whoever needs a warm boost.",
        "The charger found a cozy new socket to brighten someone's battery.",
        "A traveler cable quietly doing its best to keep both of our worlds connected.",
      ],
      playful: [
        "The phone charger has packed its bags and embarked on a grand tour of every room.",
        "A delicate domestic borrowing program where cables permanently reassign their own bedrooms.",
        "The charger is practicing nomad life and refuses to settle down in a single wall socket.",
        "An innocent cable that simply follows the sun and the highest battery emergency.",
      ],
      exaggerated: [
        "Authorities confirm the white charging cable has abandoned its assigned post and gone nomadic.",
        "Alert: international cable registry reports widespread migration across household borders.",
        "The charger establishes diplomatic relations with a brand-new outlet behind the bedside table.",
        "Federal investigators track serial cable movement through three separate domestic jurisdictions.",
      ],
    },
  },

  // ==========================================
  // FAMILY D: Food / kitchen habits
  // ==========================================
  {
    id: "empty_bottles_fridge",
    family: "kitchen_food",
    label: "Empty bottles/containers back in fridge",
    entities: ["bottles", "empty bottle", "carton", "milk carton", "jar", "container", "package"],
    synonyms: ["glassware", "jug", "box"],
    actions: ["back in fridge", "put back empty", "almost empty", "one drop left", "returned to fridge"],
    locations: ["fridge", "refrigerator", "shelf", "door"],
    phrases: ["empty bottles in the fridge", "empty carton back in fridge", "one sip left in the carton", "putting empty things in fridge"],
    relatedTopics: ["last_bite_groceries", "kitchen_counter_mess"],
    toneProfiles: {
      gentle: [
        "Those empty bottles seem to appreciate the chilly, refreshing air inside the fridge.",
        "A loyal little carton resting in the cold, holding onto its proud memories of breakfast.",
        "The empty bottle just wanted to stay close to its delicious shelf neighbors.",
        "A polite glass bottle keeping a spot cool until the next grocery trip arrives.",
      ],
      playful: [
        "The fridge has opened a modern art gallery dedicated to the beauty of empty glass containers.",
        "Saving that microscopic last sip of milk ensures nobody can be accused of finishing the carton.",
        "The empty bottle is holding prime real estate on the fridge door out of pure optimism.",
        "An invisible portion of juice thoughtfully preserved for future microscopic hydration.",
      ],
      exaggerated: [
        "Breaking news: empty milk carton claims constitutional right to permanent refrigeration.",
        "Museum of Contemporary Art bids millions for stunning fridge exhibit: 'The Last Single Drop'.",
        "Carton retains three molecules of liquid to legally avoid being declared finished.",
        "Scientists investigate the mysterious preserving power of the fridge on completely dry bottles.",
      ],
    },
  },
  {
    id: "last_bite_groceries",
    family: "kitchen_food",
    label: "Finishing the last food item / not replacing",
    entities: ["groceries", "snack", "last slice", "last bite", "treat", "chocolate", "coffee", "cereal"],
    synonyms: ["leftovers", "food", "snacks"],
    actions: ["eaten", "finished", "ate the last", "not replaced", "gone", "disappeared"],
    locations: ["fridge", "pantry", "cupboard", "kitchen"],
    phrases: ["ate the last slice", "finished the snacks", "didn't replace the coffee", "someone ate the last"],
    relatedTopics: ["empty_bottles_fridge", "groceries_turn"],
    toneProfiles: {
      gentle: [
        "That delicious snack brought someone so much happiness today, which is what food is for.",
        "A happy stomach that truly appreciated the very best final bite of the treat.",
        "A sweet little empty wrapper proving that our kitchen snacks are genuinely loved.",
        "The pantry is ready and excited to welcome a fresh stock of favorite goodies.",
      ],
      playful: [
        "The legendary final cookie has performed its ultimate magic trick and vanished into thin air.",
        "A mysterious culinary phantom that appears only when delicious snacks are down to one.",
        "The last slice of cake knew it was destined for greatness and fulfilled its tasty destiny.",
        "An unwritten domestic rule: leaving one tiny crumb means technically the snack is not gone.",
      ],
      exaggerated: [
        "Breaking: high-level domestic inquiry opened into the tragic disappearance of the final treat.",
        "CSI crumb technicians arrive at the kitchen counter to dust the empty biscuit tin for prints.",
        "Emergency grocery airlift requested following the sudden evaporation of favorite pantry snacks.",
        "Historians record the great pantry shortage of our era following the vanishing of the last chocolate.",
      ],
    },
  },
  {
    id: "dinner_decision_indecision",
    family: "kitchen_food",
    label: "Deciding what to eat / dinner indecision",
    entities: ["dinner", "food", "takeaway", "meal", "cooking", "restaurant"],
    synonyms: ["supper", "lunch"],
    actions: ["can't decide", "don't know", "whatever you want", "take forever", "indecisive", "debating", "never decides where to eat", "changing plans"],
    locations: ["kitchen", "sofa", "phone"],
    phrases: ["what do you want for dinner", "can't decide what to eat", "takes forever to pick dinner", "don't mind you choose", "never decides where to eat", "keeps changing plans"],
    relatedTopics: ["groceries_turn", "shared_planning"],
    toneProfiles: {
      gentle: [
        "Two thoughtful appetites taking their sweet time to find the coziest meal for tonight.",
        "A loving moment of dreaming together about all the tasty possibilities in the world.",
        "A gentle culinary pause while we wait for our stomachs to agree on something comforting.",
        "Taking our time because sharing a meal together is always the sweetest part of the day.",
      ],
      playful: [
        "A classic 45-minute domestic seminar on 'I don't know, what are you feeling like?'.",
        "Deciding what to eat has officially taken longer than cooking a five-course banquet.",
        "The sacred tennis match of 'Whatever you want' being gently lobbed back and forth.",
        "Browsing takeaway menus as a spectator sport without ever actually placing an order.",
      ],
      exaggerated: [
        "Breaking: United Nations peacekeepers intervene in three-hour standoff over dinner choices.",
        "Generations pass and empires rise and fall while we decide between Thai noodles and pizza.",
        "Historians confirm the phrase 'I'm happy with whatever' is the most dangerous riddle in history.",
        "Menu apps crash under the sheer gravitational weight of our unresolved culinary deliberations.",
      ],
    },
  },
  {
    id: "packaging_boxes",
    family: "kitchen_food",
    label: "Delivery boxes and empty packaging left out",
    entities: ["boxes", "packages", "packaging", "cardboard", "delivery boxes", "cartons", "wrappers", "parcels", "delivery"],
    synonyms: ["parcels", "mail", "delivery parcels"],
    actions: ["left out", "beside sofa", "opening packages", "piled", "scattered", "empty", "not flattened", "unopened", "left unopened", "by the sofa"],
    locations: ["sofa", "hallway", "living room", "entrance", "floor"],
    phrases: [
      "opens packages and leaves the empty boxes",
      "empty boxes beside the sofa",
      "cardboard boxes everywhere",
      "delivery boxes piled up",
      "delivery parcels left unopened by the sofa",
    ],
    relatedTopics: ["trash_recycling", "general_clutter"],
    toneProfiles: {
      gentle: [
        "Those delivery boxes are just holding the warm excitement of today's little arrivals.",
        "A cozy gathering of cardboard keeping company near the sofa after a fun unboxing.",
        "The boxes seem very proud of having delivered something special safely home.",
        "A friendly reminder that good things made their way to our doorstep today.",
      ],
      playful: [
        "The living room has temporarily franchised its very own postal fulfillment center.",
        "The cardboard boxes have formed an exclusive residential community right beside the sofa.",
        "An avant-garde living room sculpture celebrating the joys of online delivery services.",
        "Opening packages is the fun part; breaking down boxes is apparently an unwritten side quest.",
      ],
      exaggerated: [
        "Breaking news: skyscraper of empty delivery boxes receives formal municipal building permits.",
        "Alert: cats worldwide book tickets to visit the glorious cardboard fortress beside our sofa.",
        "Architects nominate our living room for national urban planning award in box density.",
        "The postal service assumes our living room is a regional depot and begins routing trucks here.",
      ],
    },
  },

  // ==========================================
  // FAMILY E: Time / punctuality
  // ==========================================
  {
    id: "running_late_ready",
    family: "time_punctuality",
    label: "Running late / taking long to get ready",
    entities: ["clock", "shoes", "outfit", "hair", "schedule"],
    synonyms: ["departure", "appointment"],
    actions: [
      "running late",
      "taking forever",
      "taking so long",
      "not ready",
      "taking long",
      "hurry",
      "delayed",
      "slow",
      "get ready",
      "getting ready",
    ],
    locations: ["bathroom", "hallway", "door", "bedroom", "morning"],
    phrases: [
      "running late again",
      "takes forever to get ready",
      "always rushing at the last minute",
      "we are late",
      "taking so long to get ready",
      "taking so long to get ready in the morning",
    ],
    relatedTopics: ["directions_navigation", "sleep_alarms"],
    toneProfiles: {
      gentle: [
        "Time seems to be moving on its own gentle, unhurried, handcrafted afternoon rhythm.",
        "Taking a few extra loving moments so someone steps out the door feeling completely wonderful.",
        "A peaceful pause to breathe together before the busy outside world rushes in.",
        "Making sure our smiles and outfits are just right before we face the day.",
      ],
      playful: [
        "Operating on scenic detour time rather than high-speed express schedule time.",
        "The five-minute warning has stretched into a lovely, flexible piece of theoretical physics.",
        "Today is following a boutique, artisanal schedule where departure time is open to interpretation.",
        "Putting on shoes is treated as a major multi-stage rocket launch sequence.",
      ],
      exaggerated: [
        "Breaking: standard global time zones suspended inside our hallway to accommodate shoe selection.",
        "Scientists confirm the space-time continuum actively dilates whenever we prepare to leave the house.",
        "The calendar month changes while we confirm that keys, wallet, and lip balm are accounted for.",
        "Airport flight controllers request permission to coordinate our front door departure window.",
      ],
    },
  },

  // ==========================================
  // FAMILY F: Sleep / routines
  // ==========================================
  {
    id: "sleep_alarms_snooze",
    family: "sleep_routines",
    label: "Snoozing alarms / alarm volume",
    entities: ["alarm", "snooze", "alarm clock", "phone alarm", "morning"],
    synonyms: ["wake up", "chime"],
    actions: ["snoozing", "keeps going off", "ignoring", "too loud", "ringing", "hitting snooze"],
    locations: ["bedroom", "bedside", "bed"],
    phrases: ["keeps snoozing the alarm", "alarm goes off ten times", "alarm is so loud", "hits snooze forever"],
    relatedTopics: ["bed_unmade", "phone_screen_bed"],
    toneProfiles: {
      gentle: [
        "The morning alarm is just singing gentle wake-up lullabies to someone who loves cozy dreams.",
        "A sleepy morning dance where the duvet is simply too warm and inviting to leave.",
        "The alarm clock is doing its best to cheer for a brand-new day ahead.",
        "A cozy cuddle delay while sleep gently takes its final bow.",
      ],
      playful: [
        "The snooze button is receiving the best aerobic finger workout in modern athletic history.",
        "The phone alarm plays a five-part morning musical concert with nine-minute intermissions.",
        "Waking up is being negotiated in delicate five-minute installments with the pillow.",
        "The bed has deployed high-strength magnetic pull against all known morning intentions.",
      ],
      exaggerated: [
        "Breaking: local snooze button union demands hazard pay following seventeenth consecutive morning strike.",
        "Neighborhood symphony orchestra complains phone alarm is stealing their best trumpet crescendos.",
        "NASA detects seismic activity originating directly from repeated aggressive snooze taps.",
        "The morning alarm receives an honorary Grammy Award for longest continuous repetitive performance.",
      ],
    },
  },
  {
    id: "phone_screen_bed",
    family: "sleep_routines",
    label: "Phone / screen in bed",
    entities: ["phone", "screen", "glow", "scrolling", "video", "tiktok", "instagram"],
    synonyms: ["device", "mobile"],
    actions: ["in bed", "scrolling in the dark", "blue light", "staying awake", "staring at phone"],
    locations: ["bed", "bedroom", "dark"],
    phrases: ["on the phone in bed", "scrolling in the dark", "blue light in bedroom", "watching videos in bed"],
    relatedTopics: ["phone_distraction_meals", "sleep_alarms_snooze"],
    toneProfiles: {
      gentle: [
        "A gentle blue moonbeam from a phone keeping quiet company until sleep arrives.",
        "Someone winding down with their quiet little digital story before sweet dreams.",
        "The phone glow is ready to dim so eyes and hearts can rest peacefully together.",
        "A soft evening pause before trading the screen for a cozy goodnight cuddle.",
      ],
      playful: [
        "The bedroom currently features its very own midnight outdoor cinema experience.",
        "A dedicated research expedition into obscure internet lore conducted entirely under the covers.",
        "The pillow is providing front-row VIP seating for endless cat videos.",
        "One more quick scroll has magically transformed into an hour-long documentary viewing.",
      ],
      exaggerated: [
        "Breaking: midnight smartphone glow mistaken by ships at sea for newly erected lighthouse.",
        "Astronomers identify mysterious bright blue star constellation originating on the left side of the mattress.",
        "The internet runs out of fresh content at 2 AM as the bedtime scrolling marathon reaches final levels.",
        "Phone battery begs for mercy and cool blankets after running three hours of midnight trivia reels.",
      ],
    },
  },

  // ==========================================
  // FAMILY G: Phones / digital habits
  // ==========================================
  {
    id: "phone_distraction_meals",
    family: "digital_habits",
    label: "Phone distraction during meals or talks",
    entities: ["phone", "screen", "mobile", "device", "notifications", "gaming", "video games", "social media"],
    synonyms: ["cell", "smartphone", "games", "game", "social"],
    actions: ["scrolling", "looking at phone", "during dinner", "while talking", "distracted", "checking", "gaming", "spends too long gaming", "looking at social media"],
    locations: ["table", "dinner", "meal", "couch", "restaurant"],
    phrases: [
      "phone during meals",
      "scrolling while talking",
      "always looking at phone",
      "phone on the dinner table",
      "answers while looking at phone",
      "spends too long gaming",
      "looking at social media instead of talking to me",
    ],
    relatedTopics: ["phone_screen_bed", "communication_listening"],
    toneProfiles: {
      gentle: [
        "The phone is feeling a little left out and just wanted to join the warm dinner conversation.",
        "A curious little device that loves sitting by while two favorite humans share their day.",
        "The screen can wait peacefully in a pocket while the real magic happens across the table.",
        "A sweet reminder that the best story of the day is the one being told right here.",
      ],
      playful: [
        "The smartphone has officially been set a place at the dining table as our third guest.",
        "A multi-tasking champion attempting to chew, nod, and scroll through world news simultaneously.",
        "The phone seems convinced that dinner cannot be properly digested without three fresh memes.",
        "Table manners updated to include an honorary digital appetizer of endless notifications.",
      ],
      exaggerated: [
        "Breaking news: the smartphone petitions court to be legally recognized as a biological dinner companion.",
        "Guinness Record set for balancing fork in left hand while thumb scrolls sixteen miles of feeds.",
        "Phone screen receives formal dinner toast for outstanding attendance at every home-cooked meal.",
        "Scientists declare dinner plates and illuminated phone screens have formed an unbreakable bond.",
      ],
    },
  },

  // ==========================================
  // FAMILY H: Communication
  // ==========================================
  {
    id: "communication_listening",
    family: "communication",
    label: "Listening / distracted listening / forgetting what was said",
    entities: ["words", "story", "conversation", "listening", "ears", "voice", "question"],
    synonyms: ["talking", "discussion"],
    actions: [
      "not listening",
      "distracted",
      "forgot what I said",
      "tuning out",
      "repeating",
      "interrupting",
      "gets distracted while I speak",
      "repeats the same question",
      "answers while looking at phone",
    ],
    locations: ["room", "sofa", "kitchen"],
    phrases: [
      "you never listen",
      "did you hear me",
      "forgot what I just said",
      "not listening to me",
      "forgets what I just said",
      "gets distracted while I speak",
      "repeats the same question",
      "answers while looking at phone",
    ],
    relatedTopics: ["phone_distraction_meals", "quality_time"],
    toneProfiles: {
      gentle: [
        "Two busy minds learning each day's rhythm and tuning back into each other's sweet frequency.",
        "A gentle moment to pause, take a deep breath, and share the story one more warm time.",
        "Ears and hearts taking a soft reset to listen with all the love in the room.",
        "A sweet invitation to look into each other's eyes and start the story fresh.",
      ],
      playful: [
        "The memory buffer had a tiny domestic glitch and requested an immediate friendly rerun.",
        "A private podcast where sometimes we need to hit the 'rewind fifteen seconds' button.",
        "Listening ears currently downloading an important background system update.",
        "The story was so good it definitely deserves an exclusive director's cut encore.",
      ],
      exaggerated: [
        "Breaking: local conversation requests instant slow-motion video replay from domestic referees.",
        "Secret service cryptography team brought in to decode the mysterious fate of the last three sentences.",
        "Sound waves achieve temporary orbit in the living room while waiting for ears to finish buffering.",
        "Royal broadcast network re-airs today's five o'clock chat with exclusive subtitles for clarity.",
      ],
    },
  },

  // ==========================================
  // FAMILY I: Shared responsibilities
  // ==========================================
  {
    id: "groceries_turn",
    family: "shared_responsibilities",
    label: "Groceries and chores turn taking",
    entities: ["groceries", "chores", "turn", "shopping", "errands", "list"],
    synonyms: ["tasks", "responsibilities"],
    actions: [
      "forgetting whose turn",
      "forgets whose turn",
      "forgets whose turn it is",
      "whose turn is it",
      "who buys",
      "who cleans",
      "forgot to buy",
      "not doing turn",
    ],
    locations: ["store", "supermarket", "kitchen", "house"],
    phrases: [
      "we keep forgetting whose turn it is to buy groceries",
      "whose turn is it",
      "who should do the shopping",
      "not my turn",
      "forgets whose turn it is",
    ],
    relatedTopics: ["last_bite_groceries", "dinner_decision_indecision"],
    toneProfiles: {
      gentle: [
        "Two busy teammates navigating life's little errand dance with lots of heart.",
        "A sweet shared journey where both of us are doing our best to keep the nest stocked.",
        "A gentle team huddle to decide who gets to be today's grocery hero.",
        "The grocery list is just waiting for two partners to give it a loving high-five.",
      ],
      playful: [
        "The grocery crown is passed back and forth like a high-stakes Olympic relay baton.",
        "A mystery game where neither of us remembers who held the sacred supermarket shopping basket last.",
        "The fridge is hosting a quiet philosophical summit on the true meaning of 'your turn'.",
        "Flip a coin, roll some dice, or see who can look more innocent when the milk runs out.",
      ],
      exaggerated: [
        "Breaking: supreme court called into emergency session to rule on the disputed 2026 grocery turn.",
        "Historians study ancient parchment treaties trying to establish who last purchased olive oil.",
        "International arbiters propose a neutral peacekeeping mission to the local supermarket dairy aisle.",
        "A constitutional amendment drafted to officially codify chore turns in the household register.",
      ],
    },
  },

  // ==========================================
  // FAMILY J: Quality time / affection
  // ==========================================
  {
    id: "quality_time",
    family: "quality_time",
    label: "Quality time postponed or missing",
    entities: ["date", "time together", "plans", "evening", "weekend", "cuddle"],
    synonyms: ["romance", "outings"],
    actions: ["postponed", "cancelled", "too busy", "no time", "forgot date", "not making time"],
    locations: ["couch", "home", "restaurant"],
    phrases: ["no time together", "date night cancelled", "always too busy", "need more quality time"],
    relatedTopics: ["phone_distraction_meals", "communication_listening"],
    toneProfiles: {
      gentle: [
        "Two loving hearts whose busy calendars are just begging for a quiet five-minute pause together.",
        "A gentle sign that we miss each other and our souls are hungry for a cozy cuddle.",
        "The best date doesn't need fancy plans—just two pairs of eyes smiling in the same room.",
        "A tender reminder that our favorite place to be is simply right next to each other.",
      ],
      playful: [
        "Our date night plans are currently on an adventurous holding pattern over the living room.",
        "The sofa has officially reserved front-row tickets for our next exclusive cuddle session.",
        "Busy schedules attempt to outmaneuver two people who secretly just want to eat snacks together.",
        "A five-minute quiet tea pause counts as a Michelin-star date in our domestic playbook.",
      ],
      exaggerated: [
        "Breaking: local couple's cuddle appointment postponed until 2045 due to competing busy calendars.",
        "The sofa files a formal grievance demanding mandatory romantic cuddle quotas be reinstated.",
        "Secret agents deployed to intercept both partners and force a mandatory ten-minute quiet snuggle.",
        "United Nations passes resolution declaring quality sofa time an essential domestic human right.",
      ],
    },
  },

  // ==========================================
  // FAMILY K: Social / family situations
  // ==========================================
  {
    id: "social_energy_leaving",
    family: "social_family",
    label: "Staying too long at social events / energy mismatch",
    entities: ["party", "guests", "friends", "visit", "social", "gathering", "family"],
    synonyms: ["event", "get-together"],
    actions: ["staying too long", "ready to leave", "want to go home", "social battery empty", "talking forever"],
    locations: ["party", "outside", "friends house", "event"],
    phrases: ["ready to go home", "staying too long", "social battery drained", "want to leave the party"],
    relatedTopics: ["running_late_ready", "quality_time"],
    toneProfiles: {
      gentle: [
        "One social butterfly and one cozy homebody learning to fly in lovely sweet harmony.",
        "A warm team signal that the cozy blanket at home is calling our names.",
        "Honoring different social batteries with gentle smiles and secret knowing winks.",
        "Two loving partners sharing a quiet look that says: our favorite party is each other.",
      ],
      playful: [
        "The secret 'let's leave' eye signals are currently rivaling military submarine sonar.",
        "One social battery is at one hundred percent while the other is in emergency power-saving mode.",
        "The car parked outside is radiating pure comforting magnetic homeward energy.",
        "Saying goodbye at the doorway is currently on track to become its own full-length documentary.",
      ],
      exaggerated: [
        "Breaking: covert operative eye-blink code deployed across crowded room signaling immediate tactical retreat.",
        "Social battery drops to negative forty percent as the conversation enters its third goodbye lap.",
        "Guinness World Record shattered for the longest Irish exit negotiation in modern party history.",
        "Rescue helicopter placed on standby over the driveway to airlift tired partner back to the sofa.",
      ],
    },
  },

  // ==========================================
  // FAMILY L: Bathroom / personal routines
  // ==========================================
  {
    id: "bathroom_occupancy_showers",
    family: "bathroom_routines",
    label: "Long showers / bathroom occupancy",
    entities: ["bathroom", "shower", "mirror", "hot water", "steam"],
    synonyms: ["bath", "tub"],
    actions: ["taking forever", "so long in the shower", "all the hot water", "steamed up", "hogging"],
    locations: ["bathroom", "shower"],
    phrases: ["takes forever in the shower", "used all the hot water", "bathroom occupied forever", "steamed up bathroom"],
    relatedTopics: ["towels_wet", "toilet_roll_empty", "lights_left_on"],
    toneProfiles: {
      gentle: [
        "The shower is doing a wonderful job washing away the day's worries in warm, soft steam.",
        "Someone taking sweet care of themselves with a comforting, well-deserved hot shower.",
        "A cozy little spa retreat right inside our friendly home bathroom.",
        "The bathroom is just enveloping someone with warmth and peaceful relaxation.",
      ],
      playful: [
        "The bathroom mirror has officially disappeared into a permanent tropical cloud forest.",
        "Taking a shower long enough to become an honorary citizen of Atlantis.",
        "The hot water heater is currently giving an Olympic gold-medal endurance performance.",
        "A peaceful sanctuary where nobody can interrupt the world-class shower karaoke concert.",
      ],
      exaggerated: [
        "Breaking: bathroom declared an international geothermal hot spring reserve.",
        "Steam levels inside bathroom surpass tropical rainforest records; exotic parrots expected to nest.",
        "The hot water heater passes away peacefully after heroic twenty-minute continuous boiling run.",
        "Archaeologists wait outside the bathroom door hoping to glimpse the legendary occupant.",
      ],
    },
  },

  // ==========================================
  // FAMILY M: Noise / sensory habits
  // ==========================================
  {
    id: "noise_tv_volume",
    family: "noise_sensory",
    label: "TV / music volume or loud noises",
    entities: ["tv", "volume", "music", "noise", "speakers", "sound", "chewing"],
    synonyms: ["audio", "loudness"],
    actions: ["too loud", "blaring", "noisy", "turn it down", "loud volume", "humming"],
    locations: ["living room", "bedroom", "kitchen"],
    phrases: ["tv is too loud", "music blaring", "turn down the tv", "chewing loudly", "too noisy"],
    relatedTopics: ["phone_screen_bed", "communication_listening"],
    toneProfiles: {
      gentle: [
        "Two pairs of ears experiencing sound on slightly different personal decibel journeys.",
        "A gentle reminder that sometimes our quietest moments sound the sweetest.",
        "Sound waves that are just a little too excited to share their movie soundtrack.",
        "A loving opportunity to bring the room's energy down to a calm, cozy whisper.",
      ],
      playful: [
        "The TV volume is set to provide free cinema entertainment for the entire street.",
        "The subwoofer is currently vibrating the salt shakers into a completely new kitchen arrangement.",
        "Action movie explosions so vivid we might need hard hats on the sofa tonight.",
        "A private IMAX experience right in the middle of our humble living room.",
      ],
      exaggerated: [
        "Breaking: living room sound system detected on regional earthquake monitoring stations.",
        "Action movie dialogue audible from the international space station; astronauts enjoy the plot.",
        "Subwoofer vibrations threaten tectonic stability of the local municipal foundation.",
        "The volume bar reaches maximum levels and begins creating fresh audio dimensions.",
      ],
    },
  },

  // ==========================================
  // FAMILY N: Travel / navigation
  // ==========================================
  {
    id: "directions_navigation",
    family: "travel_navigation",
    label: "Directions / GPS / navigation debate",
    entities: ["gps", "directions", "maps", "route", "turn", "map", "car"],
    synonyms: ["navigation", "satnav"],
    actions: ["lost", "missed turn", "wrong way", "arguing over directions", "knows better than gps", "shortcut"],
    locations: ["car", "road", "highway"],
    phrases: ["the direction debate", "missed the turn", "refuses to follow gps", "taking a shortcut"],
    relatedTopics: ["car_transport", "running_late_ready"],
    toneProfiles: {
      gentle: [
        "Two loving explorers traveling through the world with two slightly different maps.",
        "A sweet scenic detour turning an ordinary journey into a shared little road trip.",
        "Every turn brings us closer, no matter which path our tires choose to take.",
        "A lovely chance to take in the views together while the route figures itself out.",
      ],
      playful: [
        "Taking the scenic detour to thoroughly test the car’s suspension and patience.",
        "The GPS was politely voted out by the executive passenger council.",
        "Our shortcut has added forty-five minutes of breathtaking, unplanned local scenery.",
        "The navigation voice has given up and simply asks us to enjoy the mystery tour.",
      ],
      exaggerated: [
        "Breaking: Magellan and Columbus consult local couple for bold new theories in navigation.",
        "The GPS politely disconnects itself after seventeenth consecutive 'Recalculating' alert.",
        "Road trip enters fifth dimension of uncharted territory following brilliant secret shortcut.",
        "Local tourism board awards medal for discovering roads unknown even to mapmakers.",
      ],
    },
  },

  // ==========================================
  // FAMILY O: Car / transport
  // ==========================================
  {
    id: "car_transport_clutter",
    family: "car_transport",
    label: "Car fuel low or clutter in car",
    entities: ["car", "fuel", "gas", "ev", "trash in car", "clutter"],
    synonyms: ["vehicle", "automobile", "ev charging"],
    actions: ["empty tank", "not filled", "low fuel", "cluttered car", "cups in car", "empty"],
    locations: ["car", "glovebox", "seats", "trunk"],
    phrases: ["fuel tank on empty", "car is full of clutter", "didn't fill the gas", "cups left in the car"],
    relatedTopics: ["directions_navigation", "trash_recycling"],
    toneProfiles: {
      gentle: [
        "The trusty family car taking a quiet breather after carrying everyone so reliably.",
        "A faithful vehicle that has shared so many good drives and is ready for a warm drink of fuel.",
        "A cozy little car that carries the sweet artifacts of our shared travels together.",
        "The car waiting patiently for a quick tidy-up before the next weekend adventure.",
      ],
      playful: [
        "The fuel gauge needle is performing a daring cliffhanger stunt right on top of the 'E'.",
        "The passenger seat cup holder has opened a secondary museum for takeaway coffee lids.",
        "Driving on pure hope and positive domestic vibrations until the next petrol station.",
        "The car interior is auditioning for an adventure survival documentary.",
      ],
      exaggerated: [
        "Breaking: automotive engineers marvel at car operating for forty miles on zero fumes.",
        "Archaeological dig team uncovers ancient receipt strata beneath the passenger footwell.",
        "The low fuel warning light achieves permanent neon fixture status on the dashboard.",
        "Vehicle achieves self-sustaining ecosystem inside the glovebox and center console.",
      ],
    },
  },

  // ==========================================
  // FAMILY P: Pets / plants / shared care
  // ==========================================
  {
    id: "pets_plants_care",
    family: "pets_plants",
    label: "Pet feeding / walking or plant watering",
    entities: ["pet", "dog", "cat", "plants", "plant", "food", "water", "litter box"],
    synonyms: ["animal", "houseplants", "flora"],
    actions: ["forgot to feed", "not walked", "dry plants", "not watered", "drooping", "feeding"],
    locations: ["living room", "garden", "window", "bowl"],
    phrases: ["who fed the cat", "forgot to water the plants", "dog needs a walk", "plants are drooping"],
    relatedTopics: ["groceries_turn", "shared_responsibilities"],
    toneProfiles: {
      gentle: [
        "The friendly houseplants are doing their gentle little thirsty dance for a cool sip.",
        "A loyal furry friend looking up with big loving eyes, excited for their evening treat.",
        "The green leaves are resting calmly, waiting for a little drop of loving moisture.",
        "Two warmhearted plant parents doing their best to keep the green babies thriving.",
      ],
      playful: [
        "The cat claims with absolute conviction that nobody has fed it in sixteen human years.",
        "The monstera plant has sent a formal botanical telegram requesting urgent hydration.",
        "The dog is practicing an Oscar-worthy performance of tragic starvation near the food bowl.",
        "The houseplant has adopted a dramatic opera-faint pose until someone brings the watering can.",
      ],
      exaggerated: [
        "Breaking: the cat calls local news outlets to report feline famine five minutes after breakfast.",
        "Houseplant holds dramatic press conference announcing total drought emergency on the windowsill.",
        "Dog produces certified notarized affidavit proving walk was overdue by three full minutes.",
        "Botanists rush to preserve heroic living room fern surviving on sheer willpower and dust.",
      ],
    },
  },

  // ==========================================
  // FAMILY Q: Packaging / household residue
  // ==========================================
  {
    id: "packaging_residue",
    family: "packaging_residue",
    label: "Cardboard, delivery boxes, wrappers and tubes",
    entities: ["packaging", "cardboard", "box", "boxes", "tube", "tubes", "wrapper", "wrappers", "plastic"],
    synonyms: ["cartons", "packaging material", "bubble wrap"],
    actions: ["left around", "beside the sofa", "not recycled", "piled", "dropped", "unflattened"],
    locations: ["sofa", "hallway", "floor", "kitchen", "counter"],
    phrases: ["leaves the empty boxes", "cardboard tube beside it", "empty packaging left out", "unflattened boxes"],
    relatedTopics: ["packaging_boxes", "toilet_roll_empty", "trash_recycling"],
    toneProfiles: {
      gentle: [
        "Those little boxes and tubes have done their job protecting good things and are ready to rest.",
        "A peaceful trace of today's fun deliveries resting quietly where the unboxing happened.",
        "The cardboard is sitting gently, holding the memory of excitement when packages arrived.",
        "A quiet reminder that modern life brings so many little gifts straight to our door.",
      ],
      playful: [
        "The living room is currently hosting an international trade expo of empty cardboard structures.",
        "Cardboard boxes have formed a peaceful encampment beside the sofa while awaiting recycling day.",
        "Flattening boxes is treated as an optional bonus challenge in our domestic video game.",
        "An artistic installation exploring the negative space inside empty Amazon delivery cartons.",
      ],
      exaggerated: [
        "Breaking: domestic cardboard territory expands to claim sovereign status over the sofa rug.",
        "City council issues zoning permits for the impressive architectural box complex by the coffee table.",
        "Cardboard packaging establishes independent postal trading outpost in our living room.",
        "Structural engineers marvel at load-bearing capabilities of unflattened packaging stacks.",
      ],
    },
  },

  // ==========================================
  // FAMILY R: Interpersonal communication & boundaries
  // ==========================================
  {
    id: "communication_volume",
    family: "communication",
    label: "Conversational volume / raised voice / loud talking",
    entities: ["voice", "decibel", "decibels", "volume", "tone", "shout", "speaking", "conversation", "discussion"],
    synonyms: ["talking", "speech", "loudness"],
    actions: ["increases", "getting louder", "louder", "shouting", "yelling", "raises voice", "raising voice", "too loud", "booming"],
    behaviors: ["loud speaking", "raised voice", "shouting", "conversational volume", "volume increase"],
    locations: ["room", "house", "living room"],
    phrases: ["the conversational decibel increases", "conversation gets louder", "talks very loudly", "raises voice during discussions", "voice getting loud"],
    sensitivity: "interpersonal",
    toneProfiles: {
      gentle: [
        "Two passionate voices learning each other's natural listening levels with patience.",
        "A warm conversational rhythm where a gentle breath can bring the room back to a cozy whisper.",
        "Sound waves that got a bit excited to share a thought, ready to return to a calm fireside tone.",
        "A loving reminder that our quietest words often carry the deepest connection.",
      ],
      playful: [
        "The living room discussion briefly transitioned into stadium broadcast mode.",
        "Someone's conversational amplifier accidentally skipped a few volume notches.",
        "A passionate monologue that temporarily tested the acoustic limits of our walls.",
        "Discussion volume briefly reached world-tour concert soundcheck status.",
      ],
      exaggerated: [
        "Breaking: local conversation registers on atmospheric sound radar three counties over.",
        "Acoustic scientists dispatch urgent measuring equipment to document the living room broadcast.",
        "International decibel regulators hold emergency meeting to negotiate volume ceilings.",
        "The volume dial reaches festival main stage levels before returning to indoor diplomacy.",
      ],
    },
  },
  {
    id: "interpersonal_mocking",
    family: "communication",
    label: "Mocking / teasing / joking at expense",
    entities: ["joke", "jokes", "humor", "mocking", "teasing", "sarcasm", "banter"],
    synonyms: ["poking fun", "making fun", "ribbing"],
    actions: ["mocking", "teasing", "making fun of", "laughing at", "roasting", "poking fun", "jokes at expense", "teasing goes too far"],
    behaviors: ["mocking", "teasing", "roasting", "sarcastic comments"],
    locations: ["house", "room"],
    phrases: ["mocking other person all the time", "mocks me often", "teasing goes too far", "jokes during serious conversations", "making fun of me"],
    sensitivity: "interpersonal",
    toneProfiles: {
      gentle: [
        "Two playful hearts learning when the comedy hour is over and warmth takes the spotlight.",
        "A gentle moment to pause the teasing and wrap each other in genuine sweetness.",
        "A loving sign that our jokes need a quiet rest so kindness can speak clearly.",
        "A tender pause to make sure both hearts feel cherished rather than roasted.",
      ],
      playful: [
        "The household stand-up comedy routine ran a few minutes past its scheduled curtain call.",
        "Someone left the comedy channel on high rotation when plain cozy conversation was needed.",
        "The home roast department is officially closed for an evening intermission.",
        "A playful comedian whose mic needs a gentle domestic unplugging for the night.",
      ],
      exaggerated: [
        "Breaking: comedy festival tour extends indefinitely without audience consent.",
        "Household comedy club union called to order as satire quotas exceed annual limits.",
        "Stand-up comedy special enters fourth consecutive hour despite empty auditorium.",
        "National satire board issues mandatory gentle-snuggle order to balance out the punchlines.",
      ],
    },
  },
  {
    id: "boundary_pushiness",
    family: "boundaries",
    label: "Pressure / being pushy / unwanted persuasion",
    entities: ["pressure", "decision", "choice", "boundary", "pushiness", "pace", "comfort"],
    synonyms: ["insistence", "persuasion", "urgency"],
    actions: ["pushy", "pressuring", "insisting", "forcing", "nagging", "pushing to act", "unwanted persuasion", "not taking no", "insisting after I say no"],
    behaviors: ["pushiness", "pressuring to act", "insisting", "unwanted persuasion", "rushing decisions"],
    locations: ["house", "room"],
    phrases: [
      "too pushy to act on something I do not want to act",
      "sometimes too pushy to act on something i do not want to act",
      "pushes me to do things",
      "keeps insisting after I say no",
      "being too pushy",
      "pressuring me",
      "pushy to act",
    ],
    sensitivity: "boundary",
    toneProfiles: {
      gentle: [
        "Sometimes enthusiasm moves a little faster than both people's natural comfort and pace.",
        "A quiet space to honor that each of us needs our own time and freedom to choose.",
        "A gentle breath to let pressure melt away and give each other room to be ourselves.",
        "Patience has room to breathe when we let each other move at our own authentic rhythm.",
      ],
      playful: [
        "One person's eager green light met the other person's very valid yellow caution flag.",
        "The campaign committee for immediate action is politely asked to adjourn for tea.",
        "Enthusiasm dialed itself up to turbo speed while the comfort gauge needed cruise control.",
        "A spirited sales pitch that respectfully needs to wait for the customer's ready signal.",
      ],
      exaggerated: [
        "Urgent executive summit convenes while the motion remains tabled indefinitely for consensus.",
        "Diplomatic treaties affirm that personal veto power remains absolute and unquestioned.",
        "High-pressure lobby delegation politely escorted to the waiting room until further notice.",
        "Supreme domestic council rules that no action occurs until both delegates give full approval.",
      ],
    },
  },
  {
    id: "bodily_habits_noise",
    family: "noise_sensory",
    label: "Bodily noises / snoring / burping / chewing / tapping",
    entities: ["snoring", "burping", "chewing", "breathing", "humming", "tapping", "body", "noise"],
    synonyms: ["snore", "burp", "chew", "sound", "noises"],
    actions: ["burping", "snoring", "chewing loudly", "tapping constantly", "humming", "making noises", "belching"],
    behaviors: ["snoring", "burping", "chewing loudly", "tapping", "humming"],
    locations: ["bedroom", "bed", "sofa", "room"],
    phrases: [
      "burping and snoring",
      "snoring and burping",
      "chewing loudly",
      "tapping constantly",
      "keeps humming",
      "burping",
      "snoring",
    ],
    sensitivity: "light",
    toneProfiles: {
      gentle: [
        "A sleepy household symphony where our bodies produce their own unprompted acoustic concerts.",
        "A soft reminder of our human quirks humming away in the background of shared life.",
        "Gentle nighttime acoustics reminding us how deeply relaxed someone feels around us.",
        "Two human beings sharing space, complete with all their spontaneous natural sound effects.",
      ],
      playful: [
        "The human sound effects department is working full overtime tonight without a script.",
        "An unplanned percussive and brass ensemble rehearsing right next to our pillow.",
        "A live acoustic broadcast demonstrating the full resonance of the human body.",
        "The snoring and rhythm section have teamed up to perform an avant-garde bedtime album.",
      ],
      exaggerated: [
        "Breaking: regional seismologists confirm bedroom acoustics rival prehistoric cave echoes.",
        "Auditory research institute requests recording rights for tonight's spontaneous biological orchestra.",
        "Bedside decibels register on tectonic monitoring equipment across three neighboring zip codes.",
        "Local acoustics guild nominates sleep noises for best experimental surround-sound design.",
      ],
    },
  },
  {
    id: "routine_leaving_stuck",
    family: "sleep_routines",
    label: "Staying in / not getting out / reluctance to leave",
    entities: ["house", "bed", "home", "door", "outside", "couch"],
    synonyms: ["inside", "staying"],
    actions: ["not getting out", "staying home", "staying inside", "refusing to leave", "won't leave", "doesn't want to get out"],
    behaviors: ["not getting out", "staying in bed", "refusing to leave", "staying home"],
    locations: ["house", "bed", "room", "door"],
    phrases: [
      "not getting out",
      "always wants to stay home",
      "doesn't want to get out of bed",
      "takes forever to leave",
      "not wanting to go out",
    ],
    sensitivity: "light",
    toneProfiles: {
      gentle: [
        "The nest has cast its magnetic cozy spell, making the outside world seem very far away.",
        "A quiet day where staying snug feels much more appealing than stepping into the bustle.",
        "A gentle, unhurried afternoon letting our energy recharge before heading out into the world.",
        "Two hearts finding comfort in the sweet gravity of our warm, familiar space.",
      ],
      playful: [
        "The sofa has deployed an invisible gravitational tractor beam preventing outdoor escape.",
        "Today is an official pajama preservation holiday celebrated strictly indoors.",
        "The front door has been deemed a theoretical concept for the remainder of the afternoon.",
        "Entering cocoon mode where moving beyond the hallway requires specialized mountain gear.",
      ],
      exaggerated: [
        "Breaking: household declares complete state of hibernation; expedition to outside world cancelled.",
        "Cozy blanket fortress achieves sovereign independence from all outdoor obligations.",
        "Scientific consensus agrees the front doorway has been temporarily sealed by extreme cozy gravity.",
        "United Nations recognizes living room as a protected sanctuary of absolute indoor stillness.",
      ],
    },
  },
  {
    id: "communication_interrupting",
    family: "communication",
    label: "Interrupting / talking over / leaving conversations halfway",
    entities: ["sentence", "story", "conversation", "words", "turn", "talk"],
    synonyms: ["discussion", "chat"],
    actions: ["interrupting", "talking over", "cutting off", "leaves conversations halfway", "finishing sentences", "repeats the same question"],
    behaviors: ["interrupting", "talking over", "cutting off", "leaving conversation halfway"],
    locations: ["room", "house", "table"],
    phrases: ["keeps interrupting", "talking over", "leaves conversations halfway", "interrupts me", "cuts me off"],
    sensitivity: "interpersonal",
    toneProfiles: {
      gentle: [
        "Two lively minds eager to share, learning each other's conversational traffic lights.",
        "A patient pause to let sentences reach their warm, finished landing spot.",
        "A loving moment to hold space so every sentence gets to finish its gentle journey.",
        "Two eager storytellers tuning back into the rhythm of taking turns.",
      ],
      playful: [
        "Our conversation resembles an energetic relay race where the baton gets passed early.",
        "A high-speed dialogue where both talk-show hosts are talking at the exact same second.",
        "Sentences executing high-flying acrobatic leaps before the previous sentence lands.",
        "A friendly auctioneer mode occasionally activating during evening chats.",
      ],
      exaggerated: [
        "Breaking: congressional debate parliamentarian called to restore orderly floor privileges.",
        "Sentence completion committee drafts emergency protocol for turn-taking preservation.",
        "Acoustic radar detects supersonic conversational interception mid-flight.",
        "Domestic debate tournament enters sudden-death lightning round of overlapping speeches.",
      ],
    },
  },
  {
    id: "borrowed_items_unreturned",
    family: "personal_belongings",
    label: "Taking things without putting them back",
    entities: ["things", "items", "stuff", "tools", "belongings", "scissors", "pen"],
    synonyms: ["objects", "supplies"],
    actions: ["takes things without putting them back", "takes without returning", "never puts back", "borrowed", "moved"],
    phrases: ["takes things without putting them back", "doesn't put things back", "never returns things", "borrowing without returning"],
    sensitivity: "light",
    toneProfiles: {
      gentle: [
        "A few household items enjoying an impromptu field trip away from their normal shelf.",
        "Small tools and belongings exploring new corners of the nest before heading home.",
        "A peaceful reminder that our favorite things always love being reunited with their home base.",
        "A gentle team huddle to guide wandering objects back to where they belong.",
      ],
      playful: [
        "Household tools have formed an underground exploration club without a return map.",
        "A free-range item policy where scissors and pens roam wild across every tabletop.",
        "The living room is running a temporary open-air storage facility on every horizontal surface.",
        "Items practicing independence day and refusing to return to their assigned drawers.",
      ],
      exaggerated: [
        "Breaking: international custody trial begins for the mysterious location of missing household tools.",
        "Items achieve permanent nomad status and petition for autonomous living room territory.",
        "Interpol issues yellow notices to locate tools last seen wandering away from the desk.",
        "The great domestic diaspora: ninety percent of items report living anywhere except their home shelf.",
      ],
    },
  },
];
