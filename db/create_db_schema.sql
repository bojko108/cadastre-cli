-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table: building (parent table)
CREATE TABLE building (
    oid SERIAL PRIMARY KEY,
    cad_id VARCHAR(50) UNIQUE NOT NULL,
    ekatte INTEGER,
    ekatte_name VARCHAR(100),
    cad_reg_id INTEGER,
    cad_prop_id INTEGER,
    cad_buld_id INTEGER,
    floor_count SMALLINT,
    app_count SMALLINT,
    func_code SMALLINT,
    func_type VARCHAR(100),
    property_address VARCHAR(500),
    old_cad_id VARCHAR(500),
    property_code SMALLINT,
    property_type VARCHAR(100),
    quar_name VARCHAR(100),
    reg_name VARCHAR(100),
    street_name VARCHAR(100),
    street_number VARCHAR(100),
    validate VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    geom GEOMETRY(POLYGON, 7801)
);

CREATE INDEX idx_building_cad_id ON building(cad_id);
CREATE INDEX idx_building_geom ON building USING GIST (geom);
CREATE INDEX idx_building_floor_count ON building(floor_count);
CREATE INDEX idx_building_func_code ON building(func_code);
--CREATE INDEX idx_building_floor_count_func_code ON building(floor_count, func_code);
--CREATE INDEX idx_building_floor_count_geom ON building(floor_count, geom);
--CREATE INDEX idx_building_func_code_geom ON building(func_code, geom);

-- Table: property (parent table)
CREATE TABLE property (
    oid SERIAL PRIMARY KEY,
    cad_id VARCHAR(50) UNIQUE NOT NULL,
    ekatte INTEGER,
    ekatte_name VARCHAR(100),
    cad_reg_id INTEGER,
    cad_prop_id INTEGER,
    property_address VARCHAR(500),
    old_cad_id VARCHAR(500),
    parcel VARCHAR(100),
    place_name VARCHAR(100),
    property_code SMALLINT,
    property_type VARCHAR(100),
    purpose_code SMALLINT,
    purpose_type VARCHAR(100),
    quar_name VARCHAR(100),
    quarter VARCHAR(100),
    reg_name VARCHAR(100),
    street_name VARCHAR(100),
    street_number VARCHAR(100),
    use_code SMALLINT,
    use_type VARCHAR(100),
    validate VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    geom GEOMETRY(POLYGON, 7801)
);

CREATE INDEX idx_property_cad_id ON property(cad_id);
CREATE INDEX idx_property_geom ON property USING GIST (geom);
CREATE INDEX idx_property_purpose_code ON property(purpose_code);
--CREATE INDEX idx_property_purpose_code_geom ON property(purpose_code, geom);

-- Table: unit (parent table)
CREATE TABLE unit (
    oid SERIAL PRIMARY KEY,
    cad_id VARCHAR(50) UNIQUE NOT NULL,
    ekatte INTEGER,
    ekatte_name VARCHAR(100),
    cad_reg_id INTEGER,
    cad_prop_id INTEGER,
    cad_buld_id INTEGER,
    cad_app_id INTEGER,
    app_code SMALLINT,
    app_number VARCHAR(100),
    app_type VARCHAR(100),
    block_number VARCHAR(100),
    entrance VARCHAR(100),
    property_code SMALLINT,
    property_type VARCHAR(100),
    floor_count SMALLINT,
    floor_number VARCHAR(100),
    property_address VARCHAR(500),
    quar_name VARCHAR(100),
    reg_name VARCHAR(100),
    street_name VARCHAR(100),
    street_number VARCHAR(100),
    validate VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    geom GEOMETRY(POLYGON, 7801)
);

CREATE INDEX idx_unit_cad_id ON unit(cad_id);
CREATE INDEX idx_unit_geom ON unit USING GIST (geom);

-- Table: building_ownership (child table)
CREATE TABLE building_ownership (
    oid SERIAL PRIMARY KEY,
    cad_id VARCHAR(50),
    right_type_code SMALLINT,
    right_type VARCHAR(255),
    right_desc VARCHAR(1000),
    owner_id VARCHAR(100),
    owner_code SMALLINT,
    owner_type VARCHAR(100),
    owner_name VARCHAR(255),
    owner_note VARCHAR(500),
    document_code SMALLINT,
    document_type VARCHAR(500),
    document_desc VARCHAR(500),
    document_note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_building_ownership_building 
        FOREIGN KEY (cad_id) REFERENCES building(cad_id) ON DELETE CASCADE
);

CREATE INDEX idx_building_ownership_cad_id ON building_ownership(cad_id);

-- Table: property_ownership (child table)
CREATE TABLE property_ownership (
    oid SERIAL PRIMARY KEY,
    cad_id VARCHAR(50),
    right_type_code SMALLINT,
    right_type VARCHAR(255),
    right_desc VARCHAR(1000),
    owner_id VARCHAR(100),
    owner_code SMALLINT,
    owner_type VARCHAR(100),
    owner_name VARCHAR(255),
    owner_note VARCHAR(500),
    document_code SMALLINT,
    document_type VARCHAR(500),
    document_desc VARCHAR(500),
    document_note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_property_ownership_property 
        FOREIGN KEY (cad_id) REFERENCES property(cad_id) ON DELETE CASCADE
);

CREATE INDEX idx_property_ownership_cad_id ON property_ownership(cad_id);

-- Table: unit_ownership (child table)
CREATE TABLE unit_ownership (
    oid SERIAL PRIMARY KEY,
    cad_id VARCHAR(50),
    right_type_code SMALLINT,
    right_type VARCHAR(255),
    right_desc VARCHAR(1000),
    owner_id VARCHAR(100),
    owner_code SMALLINT,
    owner_type VARCHAR(100),
    owner_name VARCHAR(255),
    owner_note VARCHAR(500),
    document_code SMALLINT,
    document_type VARCHAR(500),
    document_desc VARCHAR(500),
    document_note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_unit_ownership_unit 
        FOREIGN KEY (cad_id) REFERENCES unit(cad_id) ON DELETE CASCADE
);

CREATE INDEX idx_unit_ownership_cad_id ON unit_ownership(cad_id);

-- Table: geo_point
CREATE TABLE geo_point (
    oid SERIAL PRIMARY KEY,
    pnt_number VARCHAR(50),
    pnt_class VARCHAR(10), 
    pnt_desc VARCHAR(255), 
    cs1970_zone SMALLINT,
    cs1970_n DOUBLE PRECISION,
    cs1970_e DOUBLE PRECISION,
    cs1970_h DOUBLE PRECISION,
    wgs84_lat DOUBLE PRECISION,
    wgs84_lon DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    geom GEOMETRY(POINT, 7801)
);

CREATE INDEX idx_geo_point_geom ON geo_point USING GIST (geom);