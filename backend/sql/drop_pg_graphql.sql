-- The app uses the REST API. It does not call /graphql/v1.
-- Dropping pg_graphql hides table names from the GraphQL schema.
-- Meals, orders, profiles, and the other tables stay on the REST API.
-- Row policies stay. The Worker stays on the service role.
-- Run once in the Supabase SQL editor.

DROP EXTENSION IF EXISTS pg_graphql;
