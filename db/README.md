# Database Setup & Configuration

## Overview

This directory contains PostgreSQL database setup scripts and field mapping configuration for the cadastral data insertion process.

## Files

- **`create_db_schema.sql`** - Database schema with 6 tables (PostGIS enabled)
- **`mapping.json`** - Field mapping configuration between source data and database tables

## Database Schema

The schema consists of two types of tables:

### Parent Tables (from GeoJSON files)
- **`building`** - Building records with geometry
- **`property`** - Property records with geometry
- **`unit`** - Unit/apartment records with geometry

### Child Tables (from CSV files)
- **`building_ownership`** - Building ownership records (FK to building)
- **`property_ownership`** - Property ownership records (FK to property)
- **`unit_ownership`** - Unit ownership records (FK to unit)

All tables include:
- PostGIS geometry support ([SRID 7801 - BGS2005/CCS2005](https://epsg.io/7801))
- Indexed fields for fast queries
- Referential integrity with cascading deletes

## Setup Instructions

### Prerequisites
- PostgreSQL 12+
- PostGIS extension enabled
- A database created and ready for schema initialization

### Installation

1. **Create a new database:**
   ```bash
   createdb cadastre
   ```

2. **Connect and run the setup script:**
   ```bash
   psql -d cadastre -f create_db_schema.sql
   ```

3. **Verify tables were created:**
   ```bash
   psql -d cadastre -c "\dt"
   ```

## Field Mapping Configuration

The `mapping.json` file defines how source data fields map to database columns.

### Structure

```json
{
  "entities": {
    "entityName": {
      "type": "geojson|csv",
      "table": "table_name",
      "description": "...",
      "fields": [
        {
          "dbField": "column_name",
          "sourceField": "source_field_name",
          "dataType": "PostgreSQL_type",
          "required": true|false,
          "description": "..."
        }
      ]
    }
  }
}
```

### Example Usage in Node.js

```javascript
import mapping from './mapping.json' assert { type: 'json' };

// Get all fields for building entity
const buildingFields = mapping.entities.building.fields;

// Get mapping for a specific field
const cadIdMapping = buildingFields.find(f => f.dbField === 'cad_id');
console.log(cadIdMapping.sourceField); // Output: 'cadnum'

// Get only required fields
const requiredFields = buildingFields.filter(f => f.required);

// Build dynamic INSERT query
const dbColumns = buildingFields.map(f => f.dbField).join(', ');
const placeholders = buildingFields.map((_, i) => `$${i + 1}`).join(', ');
```

## Data Flow

```
Download
    ↓
Unzip → ZIP files
    ↓
Convert → GeoJSON + CSV files
    ↓
Parse & Validate → Using mapping.json
    ↓
Insert → PostgreSQL database
```

## Important Notes

### Field Validation
- Required fields (marked as `required: true`) must be present in source data
- CSV encoding: UTF-8 with Cyrillic characters
- GeoJSON coordinate system: [SRID 7801 - BGS2005/CCS2005](https://epsg.io/7801)

### Geometry Handling
- All geometry fields must be valid GeoJSON `Polygon` objects
- Use PostGIS functions: `ST_GeomFromGeoJSON()`

### Ownership Records
- Link to parent tables via `cad_id` (foreign key)
- `cad_id` is `NOT NULL` for ownership records
- Multiple ownership records can reference the same `cad_id`

## Entity Relationships

```
building (1) ──→ (N) building_ownership
   ↑                       
   └─ via cad_id

property (1) ──→ (N) property_ownership
   ↑                       
   └─ via cad_id

unit (1) ──→ (N) unit_ownership
   ↑                       
   └─ via cad_id
```

## Indexes

Pre-created indexes for optimal query performance:
- **`cad_id`** - Unique index on primary identifier (all tables)
- **`geom`** - GIST spatial index for geometry queries
- **`floor_count`** - For building floor analysis
- **`func_code`** - For building function queries
- **`purpose_code`** - For property purpose queries

## Migration & Updates

For schema modifications:
1. Create a new migration script: `migrate_YYYYMMDD.sql`
2. Document changes in this README
3. Keep old versions for reference

## References

- [Bulgarian Cadastral Agency](https://www.cadastre.bg/)
- [PostGIS Documentation](https://postgis.net/docs/)
- [SRID 7801 - Bulgarian Projection](https://epsg.io/7801)