# Services Directory

This directory contains standalone utility services, long-running helper microservices, or specific platform adapters.

## Key Design Principles
- Every service is completely self-contained.
- No direct imports between services.
- Inter-process communication is handled via the state database (SQLite) or formal HTTP/REST interfaces.
