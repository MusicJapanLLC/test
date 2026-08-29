# Senju GitHub-native improvement plan

- engine: `local-evaluator`
- safe: `True`
- confidence: `0.90`
- evidence present: `True`
- optional provider unavailable: `GitHub Models HTTP 410: {"error":{"code":"github_models_retirement_brownout","message":"GitHub Models is temporarily unavailable as part of a scheduled retirement brownout."}}
`
- fallback: `local-evaluator`

## Accepted bounded changes
- No parameter change; retain current strategy.

## Reason
Local evaluator selected the best already-measured safe candidate with score=192.570, rating_gain=160.2, balance=0.965, learning_signal=1.0.

## Next-run hypothesis
Carry forward the strongest safe measured strategy and verify it again in the bounded smoke tournament.
