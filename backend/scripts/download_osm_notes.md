# OpenStreetMap Pune Pilot Data Provenance & Notes

## Geographic Extent
- **Pilot Area**: Pune Urban Core, Maharashtra, India
- **Bounding Box**: ~18.50°N to 18.60°N latitude, 73.80°E to 73.90°E longitude
- **CRS**: WGS 84 (`EPSG:4326`)
- **Projected CRS for planar analysis**: UTM Zone 43N (`EPSG:32643`)

## Downloaded Layers (`data/raw/osm/`)
1. `buildings.geojson`: Footprints of buildings in pilot area
2. `clinics.geojson`: Clinic amenity locations
3. `drinking_water.geojson`: Drinking water points
4. `gardens.geojson`: Leisure gardens
5. `grass.geojson`: Grass patches
6. `hospitals.geojson`: Hospitals and healthcare facilities
7. `parks.geojson`: Public parks
8. `roads.geojson`: Road network (highways, primary, secondary, residential)
9. `schools.geojson`: Educational institutions
10. `trees.geojson`: Individual mapped trees
11. `water_bodies.geojson`: Lakes, ponds, reservoirs
12. `waterways.geojson`: Rivers, streams, canals (Mula-Mutha rivers)
13. `woodlands.geojson`: Natural wooded areas

## Source & Attribution
- Source: [OpenStreetMap](https://www.openstreetmap.org/) contributors via Overpass Turbo API
- License: [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/)
- Retrieval Time: October 2026

## Usage & Quality Cautions
- As outlined in ClimateAdapt Pune principles:
  - Presence of a feature does not certify condition, capacity, or operational status.
  - Absence of a feature on OSM does not necessarily mean non-existence on the ground (volunteer mapping coverage varies).
  - Treat unverified attributes as missing or unknown, never fabricate defaults.
