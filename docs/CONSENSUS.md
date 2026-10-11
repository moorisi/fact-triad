# Consensus and state

The constructor fixes a source repository and a proposition. Anyone can assess exactly three committed documents. There is no owner proposal workflow, mutable graph, certificate, payout, threshold tolerance or one-time certificate consumption.

1. Deterministic input checks enforce three distinct URLs/hashes, a fixed raw GitHub namespace, full commit identifiers, hash format, storage bounds and replay protection.
2. The leader fetches every document inside `run_nondet_unsafe`, verifies HTTP status and exact byte hashes, and parses bounded JSON with duplicate-key rejection. Each source contains an identity and the complete prose statement.
3. A separate AI inference per source classifies the entire fixed proposition as SUPPORTED, REFUTED or UNKNOWN and supplies a verbatim 20–300 character source quote. Missing qualifiers, proposals and contradictions within one source require UNKNOWN. Polarity must be ACTIVE for known stances and UNKNOWN otherwise.
4. Each validator repeats full acquisition and classification for all three sources. It compares URLs, hashes, complete normalized source objects, exact stance codes and exact polarity. It also independently checks every candidate quote against the acquired text. Different valid quote choices are allowed; different consequential classifications are rejected. Both negative and uncertain decisions are checked.
5. Consensus output feeds a deterministic aggregate: support plus refutation takes precedence and produces CONFLICT; otherwise any UNKNOWN produces INSUFFICIENT; otherwise all three share one known stance and produce CORROBORATED. Only then does the contract append the complete round and consume its hashes.

The AI affects every stored stance and therefore the aggregate. Aggregation alone is deterministic; it cannot produce a successful round without acquiring and evaluating the external documents under validator scrutiny.

## Topic configuration failure

The earlier instance used the vague topic `documented safety property`. Its mixed supporting/refuting fixtures finalized successfully but yielded INSUFFICIENT instead of the anticipated CONFLICT. That receipt and state remain public. The current instance uses an exact proposition and the same contract source; changing a name would not fix this configuration defect.

## Limits of the result

Source identities only prevent duplicate IDs within one batch. They do not authenticate a publisher, prevent later reuse of an identity with changed content, or establish independent sources. Commit/hash checks establish byte commitments, not source truth. Three refutations are a corroborated negative stance, so consumers must inspect classifications as well as status. Shared model errors and prompt injection remain possible despite explicit untrusted-data instructions.
