# Check and estimate

## Quick starts

- "Is `wiki.jsonld` valid against the ontology profile?"
- "Why does this OWL ontology file fail validation?"
- "How much would a proposal cost under a two-dollar cap?"

## Use this path

Use this path to validate an OWL ontology file (JSON-LD or imported formats), or hand off a pricing request without writing state.

## Check a file

`ontology-consume check <file>` validates an OWL ontology serialized as JSON-LD (`.jsonld`, or an input `.owl`/`.rdf`/`.xml` file) against the ontology profile (OWL in JSON-LD) and prints its SHA-256. It reports every violation in document order by rule code:

- `not_well_formed`, `char_limit`, `depth_limit`, `context`, `graph_object_limit`, `triple_limit`: valid JSON-LD within size/depth/declaration/triple limits and local `@context` prefixes.
- `ontology_count`, `class_required`, `property_required`, `imports`: at most one `owl:Ontology` header, at least one class and one property, and no `owl:imports`.
- `unsupported_type`, `unsupported_predicate`, `subclass_unsupported`: only `owl:Ontology`, `owl:Class`, `owl:ObjectProperty`, and `owl:DatatypeProperty`, with only label, domain, range, and comment predicates.
- `invalid_name`, `duplicate_name`: names match `^[A-Za-z_][A-Za-z0-9_]*$`, avoid reserved words, and are unique case-insensitively.
- `domain_count`, `range_count`, `dangling_domain`, `dangling_range`, `datatype_range`: one domain and one range per property, all pointing at declared classes; datatype ranges use supported `xsd:` types.
- `not_canonical`: bytes equal the canonical JSON-LD serialization.

Fixing a file is out of scope here. Offer to import it into `ontology-build` as a new version.

## Estimate

There is no read-only estimate verb. Pricing is `ontology-build plan --model-max-spend-usd <cap>` with the same `--state-dir`; it **persists** a priced plan, calls no model, and is an estimate, not Azure billing. Hand it to `ontology-build`; do not execute its plan under this read-only skill.

## Return

Report pass or the first violations with their rule codes, the SHA-256, and one safe next action.
