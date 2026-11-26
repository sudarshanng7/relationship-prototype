resolver_path = 'src/lib/knowledge-resolver.ts'
with open(resolver_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Ensure resetTelemetry is called at the start of bindSituation
old_bind_start = """export function bindSituation(
  rawText: string,
  options?: { enableGraph?: boolean }
): BoundSituation {
  if (options?.enableGraph !== undefined) {
    knowledgeGraphService.graphEnabled = options.enableGraph;
  }
  const graphStartTime = performance.now();"""

new_bind_start = """export function bindSituation(
  rawText: string,
  options?: { enableGraph?: boolean }
): BoundSituation {
  if (options?.enableGraph !== undefined) {
    knowledgeGraphService.graphEnabled = options.enableGraph;
  }
  knowledgeGraphService.resetTelemetry();
  const graphStartTime = performance.now();"""

if old_bind_start in text:
    text = text.replace(old_bind_start, new_bind_start, 1)
    print("Added resetTelemetry to bindSituation")

# 2. Add graphProvenance to all 8 return statements in bindSituation
returns = [
    # 1. Safety return
    ("""      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 1,
        generalFailureCategory: "none",
        clarificationRequested: false,
        humorConstructionAvailable: false,
      },
    };""",
     """      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 1,
        generalFailureCategory: "none",
        clarificationRequested: false,
        humorConstructionAvailable: false,
      },
      graphProvenance: knowledgeGraphService.getTelemetry(performance.now() - graphStartTime),
    };"""),

    # 2. Proposition return
    ("""      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 4,
        generalFailureCategory: "categorical_proposition",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
    };""",
     """      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 4,
        generalFailureCategory: "categorical_proposition",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
      graphProvenance: knowledgeGraphService.getTelemetry(performance.now() - graphStartTime),
    };"""),

    # 3. Vague phrase return
    ("""      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 4,
        generalFailureCategory: "unclear_relationship",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
    };""",
     """      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 4,
        generalFailureCategory: "unclear_relationship",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
      graphProvenance: knowledgeGraphService.getTelemetry(performance.now() - graphStartTime),
    };"""),

    # 4. Bare noun / partial recognition return
    ("""      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 4,
        generalFailureCategory: "known_entity_unknown_behavior",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
    };""",
     """      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 4,
        generalFailureCategory: "known_entity_unknown_behavior",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
      graphProvenance: knowledgeGraphService.getTelemetry(performance.now() - graphStartTime),
    };"""),

    # 5. Uninterpretable input level 5 return
    ("""      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 5,
        generalFailureCategory: "uninterpretable_input",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
    };""",
     """      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: 5,
        generalFailureCategory: "uninterpretable_input",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
      graphProvenance: knowledgeGraphService.getTelemetry(performance.now() - graphStartTime),
    };"""),

    # 6. Understood but humor pending level 3 return
    ("""        diagnostic: {
          knowledgeVersion: bundle.version || "3.0.0",
          resolutionLevel: 3,
          generalFailureCategory: "unsupported_construction",
          clarificationRequested: false,
          humorConstructionAvailable: false,
        },
      };""",
     """        diagnostic: {
          knowledgeVersion: bundle.version || "3.0.0",
          resolutionLevel: 3,
          generalFailureCategory: "unsupported_construction",
          clarificationRequested: false,
          humorConstructionAvailable: false,
        },
        graphProvenance: knowledgeGraphService.getTelemetry(performance.now() - graphStartTime),
      };"""),

    # 7. Disqualified/underspecified arbitration level 4 return
    ("""      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: arbitration.resolutionLevel,
        generalFailureCategory: allConcepts.length === 0 ? "uninterpretable_input" : "unclear_relationship",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
    };""",
     """      diagnostic: {
        knowledgeVersion: bundle.version || "3.0.0",
        resolutionLevel: arbitration.resolutionLevel,
        generalFailureCategory: allConcepts.length === 0 ? "uninterpretable_input" : "unclear_relationship",
        clarificationRequested: true,
        humorConstructionAvailable: false,
      },
      graphProvenance: knowledgeGraphService.getTelemetry(performance.now() - graphStartTime),
    };"""),

    # 8. Success playful reframe return
    ("""    diagnostic: {
      knowledgeVersion: bundle.version || "3.0.0",
      resolutionLevel,
      generalFailureCategory: allConcepts.length === 0 ? "unknown_entity_known_behavior" : "none",
      clarificationRequested: false,
      humorConstructionAvailable: true,
    },
  };""",
     """    diagnostic: {
      knowledgeVersion: bundle.version || "3.0.0",
      resolutionLevel,
      generalFailureCategory: allConcepts.length === 0 ? "unknown_entity_known_behavior" : "none",
      clarificationRequested: false,
      humorConstructionAvailable: true,
    },
    graphProvenance: knowledgeGraphService.getTelemetry(performance.now() - graphStartTime),
  };""")
]

for i, (orig, repl) in enumerate(returns):
    if orig in text:
        text = text.replace(orig, repl, 1)
        print(f"Replaced return #{i+1}")
    else:
        print(f"Return #{i+1} not found!")

with open(resolver_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Finished adding graphProvenance to bindSituation returns.")
