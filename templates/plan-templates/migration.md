# Plan Template: Database Migration

You are planning a DATABASE MIGRATION. Follow this structure:

## Recommended Phases

1. **Schema Design**: Design new schema, write migration SQL, plan data transformation
2. **Data Migration**: Transform and migrate existing data, handle edge cases
3. **Cleanup & Validate**: Remove old columns/tables, update application code, verify data integrity

## Recommended Agents

- **supabase-specialist**: Migration SQL, schema design, RLS policies
- **backend-engineer**: Update application code, data access layer
- **quality-engineer**: Verify data integrity, test migration rollback

## Planning Guidance

- NEVER modify existing migration files
- Create new migration file with `supabase migration new <name>`
- Consider rollback strategy (how to undo this migration)
- Test with production-like data volume
- Update TypeScript types to match new schema
- Update all service layer queries that reference changed tables

## Migration Description:
