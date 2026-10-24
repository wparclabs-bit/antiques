#!/bin/bash
# Runs once, on first start of a fresh data volume, to create the test database
# next to the dev database (see "Testing" in README.md).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE antiques_test;
EOSQL
