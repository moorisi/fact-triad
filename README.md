# FactTriad

FactTriad is a source-corroboration primitive. A caller submits exactly three commit-pinned source documents. Leader and validators independently fetch every full document, verify SHA-256, and use separate nondeterministic extraction to produce source-anchored claims. The contract stores `CORROBORATED`, `CONFLICT`, or `INSUFFICIENT` only after exact agreement on each source's normalized claim, polarity, and quote.

This is a new architecture: three-source corroboration with claim-level equivalence. It has no graph proposals, owner control, version transitions, certificates, settlements, interval indexes, invoice allocation, or service-delivery claims.
