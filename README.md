# FactTriad

FactTriad records how three committed documents address one fixed proposition. Leader and validators independently fetch each full source, verify SHA-256, and classify its stance as `SUPPORTED`, `REFUTED` or `UNKNOWN`. Validators compare every source's exact stance and polarity and check that the leader's quote occurs in the source; their independently chosen quotes may differ.

The result is `CONFLICT` when support and refutation both occur, `INSUFFICIENT` when any UNKNOWN remains without that conflict, and `CORROBORATED` when all three have the same known stance. Three refutations also corroborate a common stance; CORROBORATED alone does not mean the proposition is supported. Read the stored per-source classifications.

StudioNet contract: `0xA1E9a56Fdada66e0a2d7d75A70E38474cBba7070` (chain 61999, gasless simulation network). Its fixed proposition is: **The service requires signed requests and rejects unsigned requests.**

- [Contract source](contracts/fact_triad.py)
- [Live scenarios and preserved configuration failure](proofs/README.md)
- [Consensus and state design](docs/CONSENSUS.md)
- [Ready-to-submit description](docs/submission.md)

## Validate

Use Python 3.13 and Node.js 20 or later:

```sh
python -m pip install -r requirements-dev.txt
python -m pytest tests/direct -q
genvm-lint check contracts/fact_triad.py --json
node scripts/verify-proofs.cjs
```

For the live verifier, install `genlayer` CLI, select `genlayer network set studionet`, and set `GENLAYER_CLI_PATH` to its installed `genlayer/dist/index.js` file. Verification sends read-only RPC/CLI requests. It does not sign transactions. The test suite itself needs no network once dependencies and the pinned direct SDK are cached.

The 89 tests include all 27 aggregation combinations both as pure-function checks and as full contract calls with explicit validator replay. They also cover malformed committed documents, each source's independent validator acquisition, HTTP failures, the 16-round limit, partial replay, and retry after failure. Web/LLM calls are mocked; distributed consensus is demonstrated separately by the published StudioNet receipts.

## Interface and limits

The constructor fixes a repository and proposition. `assess(urls, hashes)` accepts exactly three distinct commitments in that repository's `sources/` directory, using raw GitHub URLs pinned to full 40-character commits. Each JSON object contains exactly `id` and `text`; source identities must differ within a round. `get_rounds()` returns the append-only record, including complete normalized source objects, hashes, URLs, stances and quotes.

At most 16 rounds are stored. Every successful content hash is consumed globally within that instance; a later assessment cannot reuse it. Documents are limited to 12,000 bytes and 5,000 text characters. Invalid documents, HTTP/hash failures, malformed output or consensus rejection prevent appending the round. A new deployment is required to change the proposition.

Source IDs are supplied by document publishers and do not prove independent authorship. The fixtures are synthetic, controlled by one repository, and include duplicated supporting prose. CORROBORATED means consensus agreement on those texts' stances, not independent corroboration of real-world truth. Repository authenticity, document completeness, precise topic configuration and model interpretation remain trust assumptions.
