# `registry-capacity`

**Where it surfaces**: Returned by `registry.admit` and `registry.admitFrom`.

## What failed

The registry already holds `registryCapacity` entries.

## Why

Core never evicts entries silently (FR-C074).

## How to fix it

Remove entries you no longer need with `registry.remove`, or create Core with a larger `registryCapacity`.
