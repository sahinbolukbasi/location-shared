-- Create backstage database if it doesn't exist
SELECT 'CREATE DATABASE backstage'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'backstage')\gexec
