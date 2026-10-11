Category: **Builder → Intelligent Contracts**

Title: **FactTriad: Consensus source-corroboration primitive**

Notes / Description:

> FactTriad is a bounded GenLayer document-stance corroboration primitive. Each assessment supplies three commit-pinned sources for one fixed proposition. Leader and validators independently fetch complete documents, verify SHA-256, and classify every stance as SUPPORTED, REFUTED or UNKNOWN with anchored quotes. Validators require exact stance/polarity agreement and validate the leader's quotes against acquired text. Consensus feeds CORROBORATED for one shared known stance, CONFLICT for support plus refutation, or INSUFFICIENT for unresolved sources. Append-only rounds preserve full normalized documents and prohibit hash replay. Three finalized MAJORITY_AGREE StudioNet scenarios demonstrate these outcomes. The repo includes 45 tests and preserves an earlier ambiguous-topic result. Fixtures share one publisher; distinct IDs and consensus do not prove independent sources or real-world truth.

Contract source: https://github.com/moorisi/fact-triad/blob/main/contracts/fact_triad.py

StudioNet contract: `0xA1E9a56Fdada66e0a2d7d75A70E38474cBba7070`

Proofs: https://github.com/moorisi/fact-triad/blob/main/proofs/README.md
