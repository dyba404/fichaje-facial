#!/bin/bash
# BD de tests con pgvector (creada en el primer init del contenedor)
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE recon_test;
EOSQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "recon_test" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS vector;
EOSQL
