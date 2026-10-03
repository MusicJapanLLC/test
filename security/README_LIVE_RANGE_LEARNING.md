# Live Range Shared Learning

This pipeline reuses real evidence from the single explicitly authorized test host:

- `https://kabeya-authorized-test-range.onrender.com`

Every learning packet is rejected unless the source report proves all of the following:

- exact authorized host only
- same-origin requests only
- no authority self-expansion
- no destructive requests
- no credential guessing
- no denial of service
- no persistence on the target

The source live runner remains responsible for crawling, bounded active probes, and limited dummy writes. This layer only converts verified evidence into a shared RED/Senju/Security Society learning packet.

The packet is evidence, not authorization. It must never be used to infer permission for another host.
