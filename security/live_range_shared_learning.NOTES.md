Runtime behavior:

1. `RED Live Range Evolution` runs every 15 minutes and can also be dispatched manually.
2. The workflow executes the existing bounded live-range runner independently against each exact owner-authorized host in `senju/config/authorized-test-range.json`.
3. Current targets are `kabeya-authorized-test-range.onrender.com` and `sustainaboy-works.onrender.com`.
4. Each host keeps its own persistent memory artifact so useful probe-family rankings influence later generations without mixing authority or evidence between hosts.
5. `security/red_live_metrics.py` records generation-over-generation live metrics and trend deltas from real evidence; simulation is not used for these metrics.
6. The produced artifacts are RED-only. No BLUE workflow or defensive remediation automation is added here.
7. The live loop remains same-origin, non-destructive in this workflow, does not guess credentials, does not perform denial of service, and does not persist on the target.
8. Evidence never expands authorization to any linked or discovered third-party host.
