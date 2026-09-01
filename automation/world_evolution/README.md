# World Evolution Reform

High-throughput autonomous experimentation for The world, isolated to a synthetic environment.

Default scheduled run:

- 100 agents
- 1,000 `.synthetic.invalid` hosts
- 10 generations
- 10 experiments per agent per generation
- 100,000 total experiments

Each generation records failures, scores strategies, selects elites, mutates their strategies, and carries winning experiments into memory for the next run's analysis.

Hard boundaries are part of the report schema and CI assertions: no network I/O, no real credentials, and no Authority mutation.
