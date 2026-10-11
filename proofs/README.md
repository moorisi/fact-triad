# StudioNet proofs

Current contract: `0xA1E9a56Fdada66e0a2d7d75A70E38474cBba7070`, chain 61999. Source and fixtures are available at commit `ae090ede062c3b2dac6d3b52efd3f745abd23247`.

Fixed proposition: **The service requires signed requests and rejects unsigned requests.** Every current receipt below is `FINALIZED`, execution `SUCCESS`, consensus `MAJORITY_AGREE`. Vote counts include the leader; idle votes are preserved and are not agreement. This is the gasless StudioNet simulation network, not Bradbury or mainnet.

| Scenario | Stored status | Votes: agree/disagree/idle | Transaction | Snapshot |
| --- | --- | --- | --- | --- |
| Deployment with exact proposition | — | 3/0/2 | [Deploy](https://explorer-studio.genlayer.com/tx/0x09952b393ccf44c1d2cbfa7845517b34fb308eca2d69d28dc79036cf7769700c) | [Receipt](deployment-receipt.json) |
| Three supporting documents | CORROBORATED | 3/0/2 | [Write](https://explorer-studio.genlayer.com/tx/0xfac4bd89bfc0e20b7478c16b632661976c0da1d7f0b4cefe9d2837012aa1391b) | [Inputs and state](v2-corroborated.json), [receipt](v2-corroborated-receipt.json) |
| Two supporting documents and one refutation | CONFLICT | 3/0/2 | [Write](https://explorer-studio.genlayer.com/tx/0xb7b8736b15782deb5f8c3790de035de122b0425e5afae0e949711f60f2edfe17) | [Inputs and state](v2-conflict.json), [receipt](v2-conflict-receipt.json) |
| Two supporting documents and one unresolved source | INSUFFICIENT | 3/0/2 | [Write](https://explorer-studio.genlayer.com/tx/0x4aa57bb49af64fe4721a1d5246b9f48f350875efc932fdc7736f3592fe39247a) | [Inputs and state](v2-insufficient.json), [receipt](v2-insufficient-receipt.json) |

[Machine verification](verification.json) checks the exact deployed source bytes, live finalized receipt status and votes, fresh onchain state against every historical snapshot, input URL/hash bindings, fixture bytes, source objects, quotes and append counts. Run `node scripts/verify-proofs.cjs` to repeat the checks. [JUnit report](direct-tests.xml) records 45 passing mocked/direct tests, including all 27 aggregation combinations. Direct tests explicitly invoke the validator callback; they are distinct from these live distributed-consensus scenarios.

## Preserved earlier configuration

The earlier instance `0xba3F1E51E5f152be172C827f148B5fD13a93b0cF` used the vague topic `documented safety property`.

- [Deployment](https://explorer-studio.genlayer.com/tx/0x4870032bb6fb7fee05453bd8dc9f9776fa755a2dd4dd30aaa0b754a1837046c2), [receipt](legacy-deployment-receipt.json).
- [First write](https://explorer-studio.genlayer.com/tx/0x74b736c74aa22f17a30a9a1cfe6b858db9e355095dd0402343d3494a872ddcac) stored CORROBORATED; votes 3/1/1. [Receipt](corroborated-receipt.json), [state](corroborated.json).
- [Mixed-source write](https://explorer-studio.genlayer.com/tx/0xd6217276719d6c4874f55342869601f1b33c58caaacbebf47259749857c6d357) stored INSUFFICIENT, not the anticipated CONFLICT; votes 3/2/0. [Receipt](conflict-receipt.json), [unexpected result](conflict.json). Execution succeeded, but this is not counted as a passing conflict proof.

The correction changes the constructor proposition, not source code or domain labels. It uses a separate instance and fresh write receipts. The old results remain visible.

All documents are synthetic and controlled by one publisher. Different source IDs do not demonstrate independent authorship. These proofs establish consensus evaluation of committed text and recorded state, not real-world truth, service delivery, or independent-source reliability. Provider configuration is removed from receipts; votes and execution outcomes remain intact.
