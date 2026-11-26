#!/bin/bash
# Phase 4C.1 — Run all 12 development probe cases through the diagnostic harness
set -e
HARNESS="scripts/semantic-diagnostic-harness.mjs"
echo "=== Phase 4C.1 Development Probe Cases ==="
echo ""

probes=(
  "She eats too slow"
  "He takes ages to finish his coffee"
  "She brushes her teeth way too hard"
  "He puts a mountain of cheese on everything"
  "She talks so fast that I can barely follow"
  "He spends forever choosing what to wear"
  "She keeps opening the fridge without taking anything"
  "He sings very loudly while cooking"
  "She keeps watching episodes until 2 in the morning"
  "He forgets what we planned for the weekend"
  "The kettle"
  "He drives dangerously fast even when I ask him to slow down"
)

for probe in "${probes[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "INPUT: $probe"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  node "$HARNESS" "$probe" 2>&1 | grep -E "(frame|action|target|modifier|humorOpportunity|outcome|construction|realized|RESULT|ERROR|clarification|normalized|bound|arbitration)" | head -60
  echo ""
done
