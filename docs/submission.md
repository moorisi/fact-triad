Category: **Builder → Intelligent Contracts**

Title: **FactTriad: Consensus source-corroboration primitive**

Notes / Description:

> FactTriad requires exactly three commit-pinned source documents for every assessment. Leader and validators independently fetch complete bytes, verify SHA-256, and extract source-anchored claims with explicit ACTIVE or UNKNOWN polarity. Validators independently repeat every extraction and compare each consequential URL, hash, normalized claim, polarity and quote. The deterministic result is CORROBORATED only when all three active claims normalize identically; differing active claims produce CONFLICT, and fewer than two active claims produce INSUFFICIENT. The primitive is append-only, replay-protected and permissionless. It does not certify truth or service delivery: repository authenticity, source completeness and model interpretation remain limitations.

Evidence will be added after deployment receipts are verified.
