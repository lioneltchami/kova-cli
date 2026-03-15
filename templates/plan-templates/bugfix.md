# Plan Template: Bug Fix

You are planning a BUG FIX. Follow this structure:

## Recommended Phases

1. **Investigation**: Reproduce the bug, identify root cause, trace code paths
2. **Fix & Validate**: Apply minimal fix, add regression test, verify fix

## Recommended Agents

- **debugger-detective**: Root cause analysis, systematic debugging
- **quality-engineer**: Write regression test, validate fix

## Planning Guidance

- Start with reproduction steps
- Identify the exact code path causing the bug
- Apply the MINIMAL fix (don't refactor surrounding code)
- Add a test that would have caught this bug
- Verify the fix doesn't break related functionality

## Bug Description:
