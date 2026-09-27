# `source-unknown`

**Where it surfaces**: Returned by `registry.admit` and `registry.admitFrom`.

## What failed

The `source` is not one of the four categories.

## Why

The category list is closed so settings stay meaningful (FR-C024).

## How to fix it

Use `user-created`, `imported`, `shared`, or `ai-generated`.
