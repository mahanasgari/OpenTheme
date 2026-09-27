# `disposed`

**Where it surfaces**: Thrown by every method of a disposed controller.

## What failed

A method was called after `dispose()`.

## Why

A disposed controller holds no listeners and must not publish again.

## How to fix it

Create a new controller with `core.createController(...)`.
