"""RED Cell: a bounded Senju-only adversarial research engine.

RED Cell has no business logic and no blue-team authority. It grows an
experiment corpus from prior RED/Senju evidence, produces mutations, scores
novelty, and emits the next generation of experiments for existing approved
RED/Senju execution lanes.
"""

from .corpus import RedCorpus, RedSeed
from .mutation import MutationEngine

__all__ = ["RedCorpus", "RedSeed", "MutationEngine"]
