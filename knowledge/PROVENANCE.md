# Third-Party Knowledge Provenance & Licensing Notices

This document details the external knowledge resources, corpora, ontologies, and lexicons incorporated into or referenced by the **Purple Garden Relational Knowledge Base (PG-RKB)** and **Purple Garden Humour Knowledge Base (PG-HKB)**.

---

## 1. Open English WordNet (OEWN) & Princeton WordNet (PWN)

- **Source Name**: Open English WordNet (OEWN) 2025 Edition
- **Project URL**: https://en-word.net / https://github.com/globalwordnet/english-wordnet
- **Underlying Resource**: Princeton WordNet (PWN) 3.1 (Princeton University)
- **Applicable Licences**:
  - Open English WordNet: **Creative Commons Attribution 4.0 International (CC BY 4.0)**
  - Princeton WordNet: **WordNet 3.0 License (BSD-style permissive license)**
- **Commercial Usage**: **Permitted**. Both CC BY 4.0 and the WordNet license permit commercial use, adaptation, and integration into proprietary software.
- **Redistribution & Derivative Work Requirements**:
  - Requires clear attribution to both Princeton WordNet and the Open English WordNet team.
  - Requires retaining copyright notices and license references.
  - Changes or adaptations must be indicated if modified.
- **Incorporated Data**:
  - Filtered synset taxonomy, lexical senses, definitions, and hypernym/hyponym hierarchies for domestic everyday actions, objects, ingredients, and states (`knowledge/compiled/runtime_knowledge_bundle.json`, `knowledge/sources/oewn/`).
- **Attribution Notice**:
  > This work incorporates lexical data from Open English WordNet (Copyright © 2019–present, The Open English WordNet Team), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
  > It is additionally based on Princeton University WordNet (WordNet Release 3.1, Copyright © 2011 by Princeton University Board of Trustees).

---

## 2. VerbNet

- **Source Name**: VerbNet (University of Colorado Boulder / University of New Mexico)
- **Version**: VerbNet 3.4
- **Project URL**: https://verbs.colorado.edu/verb-index/ / https://github.com/verbs-colorado/verbnet
- **Applicable Licence**: **Creative Commons Attribution-NonCommercial-ShareAlike (CC BY-NC-SA 3.0/4.0)** / Academic Research License.
- **Commercial Usage & Derivative Strategy**:
  - *Data Isolation*: VerbNet class XML structures (`complain-37.8`, `neglect-75.1`, `wipe_manner-10.4.1`, etc.) located in `knowledge/sources/verbnet/` were utilized strictly as **offline linguistic reference models** to structure custom PG-RKB semantic frames.
  - *No Direct Binary Redistribution*: The production runtime mobile bundle (`src/lib/compiled-knowledge-data.ts`) contains exclusively proprietary, independently authored PG-RKB frame representations and thematic role structures inspired by frame semantics, with zero verbatim reproduction of non-commercial VerbNet corpora.
- **Attribution Notice**:
  > Frame semantic structures in Purple Garden reference taxonomic classes developed by VerbNet (Kipper et al., University of Colorado Boulder).

---

## 3. Wikidata

- **Source Name**: Wikidata (Wikimedia Foundation)
- **Project URL**: https://www.wikidata.org
- **Applicable Licence**: **Creative Commons CC0 1.0 Universal Public Domain Dedication (CC0 1.0)**
- **Commercial Usage**: **Permitted**. CC0 dedicates data to the worldwide public domain, allowing commercial use, modification, and distribution without copyright restrictions.
- **Incorporated Data**:
  - Entity identifiers, aliases, and property relations for domestic objects (e.g. appliances, cookware, furniture, beverages) in `knowledge/sources/wikidata/`.
- **Attribution Notice**:
  > Structured entity definitions and physical taxonomy data reference information from Wikidata, made available under the Creative Commons CC0 1.0 Universal Public Domain Dedication.

---

## 4. Tatoeba

- **Source Name**: Tatoeba Project
- **Project URL**: https://tatoeba.org
- **Applicable Licence**: **Creative Commons Attribution 2.0 France (CC BY 2.0 FR)**
- **Commercial Usage**: **Permitted** with attribution.
- **Incorporated Data**:
  - Sample reference sentences for testing domestic language patterns in `knowledge/sources/tatoeba/sentences_sampled.json`.
- **Attribution Notice**:
  > Sentence structure references include example phrases from Tatoeba (https://tatoeba.org), licensed under CC BY 2.0 FR.

---

## 5. Proprietary Purple Garden Knowledge Assets (PG-RKB & PG-HKB)

- **Owner**: Purple Garden Project
- **Licence**: Proprietary / Application Internal
- **Assets**:
  - 40 Semantic Frames (`knowledge/semantic-frames/frames.json`)
  - 221 Humour Constructions (`knowledge/humor/constructions/constructions.json`)
  - 36 Humour Mechanisms & 34 Metaphor Families
  - 11,284 Concepts & 4,768 Semantic Relations (`knowledge/compiled/runtime_knowledge_bundle.json`)
