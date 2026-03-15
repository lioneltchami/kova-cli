# Plan Template: Security Hardening

You are planning SECURITY WORK. Follow this structure:

## Recommended Phases

1. **Audit**: Identify vulnerabilities, review auth flows, check RLS policies
2. **Remediate**: Apply fixes for each finding, update security configurations

## Recommended Agents

- **security-auditor**: Vulnerability assessment, OWASP compliance, threat modeling
- **quality-engineer**: Verify fixes, ensure no regressions

## Planning Guidance

- Check OWASP Top 10 categories relevant to this work
- Verify authentication AND authorization at every endpoint
- Validate all user inputs at system boundaries
- Use parameterized queries (never string interpolation for SQL)
- Review RLS policies for data isolation
- Check for sensitive data exposure (API responses, logs, error messages)
- Consider both authenticated and unauthenticated attack vectors

## Security Task Description:
