import re

resolver_path = 'src/lib/knowledge-resolver.ts'
with open(resolver_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update targetConcept declaration at top of arbitrateSituationFrame
old_arb_top = '  const targetName = (boundRoles.target?.canonicalName || "").toLowerCase();\n  const actionName = (boundRoles.action?.canonicalName || "").toLowerCase();'
new_arb_top = '  const targetConcept = boundRoles.target;\n  const targetName = (boundRoles.target?.canonicalName || "").toLowerCase();\n  const actionName = (boundRoles.action?.canonicalName || "").toLowerCase();'

if old_arb_top in text:
    text = text.replace(old_arb_top, new_arb_top, 1)
    print("Replaced arbitrateSituationFrame top")
else:
    print("arbitrateSituationFrame top already updated or not found")

# 2. Frame 9: Appliance
target_f9 = """// 9. frame_appliance_unstarted
  {
    const hasAppliance = /\\b(dishwasher|washing machine|washer|dehydrator|microwave|toaster|oven|air fryer)\\b/i.test(normalizedText) ||
      /\\b(dishwasher|washer)\\b/i.test(targetName);
    const hasUnstarted = /\\b(not started|unstarted|not run|never ran|didn't run|runned|forgot|overnight)\\b/i.test(normalizedText);

    const eligible = hasAppliance && hasUnstarted;
    let score = 0;
    const sup: string[] = [];
    const con: string[] = [];
    if (eligible) {
      score += 85;
      sup.push("loaded_unstarted_appliance_matched");
    } else {"""

replacement_f9 = """// 9. frame_appliance_unstarted
  {
    const targetIdx = targetConcept ? knowledgeGraphService.findConceptIndexByName(targetConcept.canonicalName) : -1;
    const graphApp = targetIdx !== -1 ? knowledgeGraphService.isAppliance(targetIdx) : { match: false };
    const hasAppliance = /\\b(dishwasher|washing machine|washer|dehydrator|microwave|toaster|oven|air fryer)\\b/i.test(normalizedText) ||
      /\\b(dishwasher|washer)\\b/i.test(targetName) ||
      graphApp.match;
    const hasUnstarted = /\\b(not started|unstarted|not run|never ran|didn't run|runned|forgot|overnight)\\b/i.test(normalizedText);

    const eligible = hasAppliance && hasUnstarted;
    let score = 0;
    const sup: string[] = [];
    const con: string[] = [];
    if (eligible) {
      score += 85;
      sup.push("loaded_unstarted_appliance_matched");
      if (graphApp.match && graphApp.path) {
        score += 15;
        sup.push("knowledge_derived (" + graphApp.path + ")");
      }
    } else {"""

if target_f9 in text:
    text = text.replace(target_f9, replacement_f9, 1)
    print("Replaced Frame 9")
else:
    print("Frame 9 not found!")

# 3. Frame 13: Cookware
target_f13 = """// 13. Cookware / Cleaning Frames: active scrubbing vs soaking omission vs selective avoidance
  {
    const hasExplicitWashVerb = /\\b(scrub|scrubbing|scrubs|wash|washing|washes|rinse|rinsing|rinses|wipe|wiping|wipes|clean|cleaning|cleans|polish|polishing)\\b/i.test(normalizedText) ||
      /\\b(scrub|wash|wipe|clean|rinse)\\b/i.test(actionName);
    const hasCookwareOrSurface = /\\b(pan|pans|pot|pots|skillet|skillets|dish|dishes|utensil|utensils|cutlery|forks?|spoons?|knives|cauldron|plate|plates|mug|mugs|blender|wok|counter|table|sink)\\b/i.test(normalizedText) ||
      /\\b(skillet|pan|pot|dish|utensil|cauldron|plate|counter|table|sink)\\b/i.test(targetName);
    const hasOmissionOrSoakCue = /\\b(soak|soaking|piled|dirty|sitting|unwashed|forgot|forgets|forgetting)\\b/i.test(normalizedText);
    const hasAvoidanceCue = actionPolarity === "negated" || actionPolarity === "avoided" ||
      /\\b(except|refuses?|only|only small|only the small|only the|big utensils|large pots|roasting pans)\\b/i.test(normalizedText);"""

replacement_f13 = """// 13. Cookware / Cleaning Frames: active scrubbing vs soaking omission vs selective avoidance
  {
    const targetIdx = targetConcept ? knowledgeGraphService.findConceptIndexByName(targetConcept.canonicalName) : -1;
    const graphCookware = targetIdx !== -1 ? knowledgeGraphService.isCookware(targetIdx) : { match: false };
    const hasExplicitWashVerb = /\\b(scrub|scrubbing|scrubs|wash|washing|washes|rinse|rinsing|rinses|wipe|wiping|wipes|clean|cleaning|cleans|polish|polishing)\\b/i.test(normalizedText) ||
      /\\b(scrub|wash|wipe|clean|rinse)\\b/i.test(actionName);
    const hasCookwareOrSurface = /\\b(pan|pans|pot|pots|skillet|skillets|dish|dishes|utensil|utensils|cutlery|forks?|spoons?|knives|cauldron|plate|plates|mug|mugs|blender|wok|counter|table|sink)\\b/i.test(normalizedText) ||
      /\\b(skillet|pan|pot|dish|utensil|cauldron|plate|counter|table|sink)\\b/i.test(targetName) ||
      graphCookware.match;
    const hasOmissionOrSoakCue = /\\b(soak|soaking|piled|dirty|sitting|unwashed|forgot|forgets|forgetting)\\b/i.test(normalizedText);
    const hasAvoidanceCue = actionPolarity === "negated" || actionPolarity === "avoided" ||
      /\\b(except|refuses?|only|only small|only the small|only the|big utensils|large pots|roasting pans)\\b/i.test(normalizedText);"""

if target_f13 in text:
    text = text.replace(target_f13, replacement_f13, 1)
    print("Replaced Frame 13")
else:
    print("Frame 13 not found!")

# 4. Frame 14: Beverage
target_f14 = """// 14. frame_beverage_preparation
  {
    const notEmptyFridge = !scores.find(s => s.frameId === "frame_empty_container_fridge")?.eligible;
    const hasBeverage = (/\\b(tea|coffee|espresso|latte|chai|cuppa|soup|broth|milk|juice|water)\\b/i.test(normalizedText) ||
      /\\b(tea|coffee|espresso|latte|chai|cuppa|soup|broth)\\b/i.test(targetName) ||
      (Boolean(boundRoles.beverage) && !/\\b(toast|bread|pan)\\b/i.test(boundRoles.beverage.canonicalName))) &&
      !/\\btoast\\b/i.test(normalizedText);
    const hasPrepActionOrQuantity = /\\b(pour|pours|pouring|add|adds|adding|brew|brewing|make|making|water|milk|sugar|salt|finish|finishes|finishing|takes ages|spent ages|spends ages|took forever|taking forever)\\b/i.test(normalizedText) ||
      Boolean(boundRoles.additive);
    const notToastOnly = !/\\btoast\\b/i.test(normalizedText) || hasBeverage;

    const eligible = notEmptyFridge && hasBeverage && hasPrepActionOrQuantity && notToastOnly;
    let score = 0;
    const sup: string[] = [];
    const con: string[] = [];
    if (eligible) {
      score += 80;
      sup.push("beverage_preparation_matched");
    } else {"""

replacement_f14 = """// 14. frame_beverage_preparation
  {
    const targetIdx = targetConcept ? knowledgeGraphService.findConceptIndexByName(targetConcept.canonicalName) : -1;
    const bevIdx = boundRoles.beverage ? knowledgeGraphService.findConceptIndexByName(boundRoles.beverage.canonicalName) : -1;
    const graphBev = (targetIdx !== -1 ? knowledgeGraphService.isBeverage(targetIdx) : { match: false }).match
      ? knowledgeGraphService.isBeverage(targetIdx)
      : (bevIdx !== -1 ? knowledgeGraphService.isBeverage(bevIdx) : { match: false });
    const notEmptyFridge = !scores.find(s => s.frameId === "frame_empty_container_fridge")?.eligible;
    const hasBeverage = (/\\b(tea|coffee|espresso|latte|chai|cuppa|soup|broth|milk|juice|water)\\b/i.test(normalizedText) ||
      /\\b(tea|coffee|espresso|latte|chai|cuppa|soup|broth)\\b/i.test(targetName) ||
      graphBev.match ||
      (Boolean(boundRoles.beverage) && !/\\b(toast|bread|pan)\\b/i.test(boundRoles.beverage.canonicalName))) &&
      !/\\btoast\\b/i.test(normalizedText);
    const hasPrepActionOrQuantity = /\\b(pour|pours|pouring|add|adds|adding|brew|brewing|make|making|water|milk|sugar|salt|finish|finishes|finishing|takes ages|spent ages|spends ages|took forever|taking forever)\\b/i.test(normalizedText) ||
      Boolean(boundRoles.additive);
    const notToastOnly = !/\\btoast\\b/i.test(normalizedText) || hasBeverage;

    const eligible = notEmptyFridge && hasBeverage && hasPrepActionOrQuantity && notToastOnly;
    let score = 0;
    const sup: string[] = [];
    const con: string[] = [];
    if (eligible) {
      score += 80;
      sup.push("beverage_preparation_matched");
      if (graphBev.match && graphBev.path) {
        score += 15;
        sup.push("knowledge_derived (" + graphBev.path + ")");
      }
    } else {"""

if target_f14 in text:
    text = text.replace(target_f14, replacement_f14, 1)
    print("Replaced Frame 14")
else:
    print("Frame 14 not found!")

# 5. Frame 15: Storage
target_f15 = """// 15. frame_open_drawer_organization
  {
    const hasStorage = /\\b(drawer|drawers|wardrobe|closet|cabinet|cupboard|fridge door|refrigerator door|jar|tub|tubs|lid)\\b/i.test(normalizedText) ||
      /\\b(drawers?|cabinet|cupboard|wardrobe|closet)\\b/i.test(targetName);
    const hasOpenState = /\\b(open|opened|ajar|half|shut|shuts|close|closed|unclosed)\\b/i.test(normalizedText);
    const notSlammingViolently = !/\\b(violently|slam|slams|slamming)\\b/i.test(normalizedText) || hasOpenState;

    const eligible = hasStorage && hasOpenState && notSlammingViolently && actionPolarity !== "active";
    let score = 0;
    const sup: string[] = [];
    const con: string[] = [];
    if (eligible) {
      score += 80;
      sup.push("open_drawer_or_cabinet_matched");
    } else {"""

replacement_f15 = """// 15. frame_open_drawer_organization
  {
    const targetIdx = targetConcept ? knowledgeGraphService.findConceptIndexByName(targetConcept.canonicalName) : -1;
    const graphStorage = targetIdx !== -1 ? knowledgeGraphService.isStorageContainer(targetIdx) : { match: false };
    const hasStorage = /\\b(drawer|drawers|wardrobe|closet|cabinet|cupboard|fridge door|refrigerator door|jar|tub|tubs|lid)\\b/i.test(normalizedText) ||
      /\\b(drawers?|cabinet|cupboard|wardrobe|closet)\\b/i.test(targetName) ||
      graphStorage.match;
    const hasOpenState = /\\b(open|opened|ajar|half|shut|shuts|close|closed|unclosed)\\b/i.test(normalizedText);
    const notSlammingViolently = !/\\b(violently|slam|slams|slamming)\\b/i.test(normalizedText) || hasOpenState;

    const eligible = hasStorage && hasOpenState && notSlammingViolently && actionPolarity !== "active";
    let score = 0;
    const sup: string[] = [];
    const con: string[] = [];
    if (eligible) {
      score += 80;
      sup.push("open_drawer_or_cabinet_matched");
      if (graphStorage.match && graphStorage.path) {
        score += 15;
        sup.push("knowledge_derived (" + graphStorage.path + ")");
      }
    } else {"""

if target_f15 in text:
    text = text.replace(target_f15, replacement_f15, 1)
    print("Replaced Frame 15")
else:
    print("Frame 15 not found!")

# 6. Frame 16: Footwear / Displacement
target_f16 = """// 16. frame_object_displacement
  {
    const hasDisplacementTokens = /\\b(toilet roll|cardboard tube|empty box|delivery box|packages?|boxes|crumbs|slippers|flippers|flip flops|trainers|shoes|running shoes|boots|keys|cup|mug|towels|laundry|clothes|cushions|snowshoes?|tamper|blocks|hoverboard|chargers?|charging cables?|cables?|spread across|sitting beside|dropped|dropping|all over|parked|next to|drying on|forgetting about the stuff|stuff that has been put|belongings|placed by)\\b/i.test(normalizedText) ||
      (/\\b(leave|leaves|leaving)\\b/i.test(normalizedText) && /\\b(table|bed|counter|desk|floor|sink)\\b/i.test(normalizedText)) ||
      (/\\b(forget|forgetting|forgot)\\b/i.test(normalizedText) && /\\b(stuff|things|belongings|items|placed|put|keys)\\b/i.test(normalizedText)) ||
      Boolean(boundRoles.destination);

    const eligible = Boolean(hasDisplacementTokens);
    let score = 0;
    const sup: string[] = [];
    const con: string[] = [];
    if (eligible) {
      score += 75;
      sup.push("object_displacement_trail_matched");
    } else {"""

replacement_f16 = """// 16. frame_object_displacement
  {
    const targetIdx = targetConcept ? knowledgeGraphService.findConceptIndexByName(targetConcept.canonicalName) : -1;
    const graphFootwear = targetIdx !== -1 ? knowledgeGraphService.isFootwearOrBelonging(targetIdx) : { match: false };
    const hasDisplacementTokens = /\\b(toilet roll|cardboard tube|empty box|delivery box|packages?|boxes|crumbs|slippers|flippers|flip flops|trainers|shoes|running shoes|boots|keys|cup|mug|towels|laundry|clothes|cushions|snowshoes?|tamper|blocks|hoverboard|chargers?|charging cables?|cables?|spread across|sitting beside|dropped|dropping|all over|parked|next to|drying on|forgetting about the stuff|stuff that has been put|belongings|placed by)\\b/i.test(normalizedText) ||
      (/\\b(leave|leaves|leaving)\\b/i.test(normalizedText) && /\\b(table|bed|counter|desk|floor|sink)\\b/i.test(normalizedText)) ||
      (/\\b(forget|forgetting|forgot)\\b/i.test(normalizedText) && /\\b(stuff|things|belongings|items|placed|put|keys)\\b/i.test(normalizedText)) ||
      graphFootwear.match ||
      Boolean(boundRoles.destination);

    const eligible = Boolean(hasDisplacementTokens);
    let score = 0;
    const sup: string[] = [];
    const con: string[] = [];
    if (eligible) {
      score += 75;
      sup.push("object_displacement_trail_matched");
      if (graphFootwear.match && graphFootwear.path) {
        score += 15;
        sup.push("knowledge_derived (" + graphFootwear.path + ")");
      }
    } else {"""

if target_f16 in text:
    text = text.replace(target_f16, replacement_f16, 1)
    print("Replaced Frame 16")
else:
    print("Frame 16 not found!")

# 7. Update bindSituation signature to accept options?: { enableGraph?: boolean }
target_bind_sig = "export function bindSituation(rawText: string): BoundSituation {"
replacement_bind_sig = """export function bindSituation(
  rawText: string,
  options?: { enableGraph?: boolean }
): BoundSituation {
  if (options?.enableGraph !== undefined) {
    knowledgeGraphService.graphEnabled = options.enableGraph;
  }
  const graphStartTime = performance.now();"""

if target_bind_sig in text:
    text = text.replace(target_bind_sig, replacement_bind_sig, 1)
    print("Replaced bindSituation signature")
else:
    print("bindSituation signature not found!")

with open(resolver_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Successfully updated src/lib/knowledge-resolver.ts")
