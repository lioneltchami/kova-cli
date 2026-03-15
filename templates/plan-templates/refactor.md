# Plan Template: Refactor

You are planning a CODE REFACTOR. Follow this structure:

## Recommended Phases

1. **Analysis**: Identify all usages, establish test baseline, map dependencies
2. **Refactor**: Apply changes incrementally, run tests after each step
3. **Validate**: Run full test suite, verify no regressions, update documentation

## Recommended Agents

- **code-simplifier**: Code simplification, DRY improvements, clarity
- **quality-engineer**: Validate no regressions, verify test coverage

## Planning Guidance

- Run tests BEFORE refactoring to establish baseline
- Identify ALL consumers of code being refactored
- Make changes incrementally (one file at a time when possible)
- Run tests after EACH incremental change
- For breaking interface changes: add new interface alongside old, migrate consumers, then remove old

## Refactor Description:
