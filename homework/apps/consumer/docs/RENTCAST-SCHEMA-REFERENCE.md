# Rentcast Property Data Schema Reference

Complete field reference from [Rentcast API Property Data Schema](https://developers.rentcast.io/reference/property-data-schema)

---

## Core Property Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | String | Unique RentCast property identifier | "5500-Grand-Lake-Dr,-San-Antonio,-TX-78244" |
| `formattedAddress` | String | Full property address (Street, Unit, City, State Zip) | "5500 Grand Lake Dr, San Antonio, TX 78244" |
| `addressLine1` | String | First line of street address | "5500 Grand Lake Dr" |
| `addressLine2` | String | Second line (unit/apartment) | "Apt 12" |
| `city` | String | City name | "San Antonio" |
| `state` | String | State (2-char abbreviation) | "TX" |
| `stateFips` | String | 2-digit state FIPS code | "48" |
| `zipCode` | String | 5-digit zip code | "78244" |
| `county` | String | County name | "Bexar" |
| `countyFips` | String | 3-digit county FIPS code | "029" |
| `latitude` | Number | Geographic latitude | 29.475962 |
| `longitude` | Number | Geographic longitude | -98.351442 |

## Building Details

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `propertyType` | String (Enum) | Property type (see [Property Types](https://developers.rentcast.io/reference/property-types)) | "Single Family" |
| `bedrooms` | Number | Number of bedrooms (0 = studio) | 3 |
| `bathrooms` | Number | Number of bathrooms | 2 |
| `squareFootage` | Number | Total indoor living area (sq ft) | 1878 |
| `lotSize` | Number | Total lot size (sq ft) | 8850 |
| `yearBuilt` | Number | Construction year | 1973 |

## Tax & Legal

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `assessorID` | String | County assessor ID or APN | "05076-103-0500" |
| `legalDescription` | String | Legal description from county records | "CB 5076A BLK 3 LOT 50" |
| `subdivision` | String | Subdivision identifier | "WOODLAKE" |
| `zoning` | String | Zoning code | "RH" |

## Sale History

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `lastSaleDate` | Date | Date property was last sold (ISO 8601) | "2024-11-18T00:00:00.000Z" |
| `lastSalePrice` | Number | Last known sale price | 270000 |

## HOA

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `hoa` | Object | HOA information | `{ ... }` |
| `hoa.fee` | Number | Monthly HOA fee/assessment | 175 |

## Features Object

All features are nested under the `features` object:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `features.architectureType` | String | Architecture type (see [enum values](#architecture-types)) | "Contemporary" |
| `features.cooling` | Boolean | Has cooling system | true |
| `features.coolingType` | String | Cooling system type (see [enum values](#cooling-types)) | "Central" |
| `features.exteriorType` | String | Exterior type (see [enum values](#exterior-types)) | "Wood" |
| `features.fireplace` | Boolean | Has fireplace | true |
| `features.fireplaceType` | String | Fireplace type (see [enum values](#fireplace-types)) | "Masonry" |
| `features.floorCount` | Number | Number of floors/stories | 2 |
| `features.foundationType` | String | Foundation type (see [enum values](#foundation-types)) | "Slab" |
| `features.garage` | Boolean | Has garage | true |
| `features.garageSpaces` | Number | Number of garage spaces | 2 |
| `features.garageType` | String | Garage type (see [enum values](#garage-types)) | "Attached" |
| `features.heating` | Boolean | Has heating system | true |
| `features.heatingType` | String | Heating system type (see [enum values](#heating-types)) | "Forced Air" |
| `features.pool` | Boolean | Has pool | true |
| `features.poolType` | String | Pool type (see [enum values](#pool-types)) | "In-Ground Pool" |
| `features.roofType` | String | Roof type (see [enum values](#roof-types)) | "Asphalt Shingle" |
| `features.viewType` | String | View type (see [enum values](#view-types)) | "Mountain" |

## Owner Information

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `owner` | Object | Owner information | `{ ... }` |
| `owner.name` | String | Property owner name(s) | "John Smith" |
| `owner.names` | Array | Multiple owner names | ["John Smith", "Jane Smith"] |
| `owner.type` | String | Owner type | "Individual" |
| `owner.mailingAddress` | Object | Owner mailing address | `{ ... }` |
| `owner.mailingAddress.addressLine1` | String | Mailing address line 1 | "5500 Grand Lake Dr" |
| `owner.mailingAddress.addressLine2` | String | Mailing address line 2 | "Apt 12" |
| `owner.mailingAddress.city` | String | Mailing address city | "San Antonio" |
| `owner.mailingAddress.state` | String | Mailing address state | "TX" |
| `owner.mailingAddress.stateFips` | String | Mailing address state FIPS | "48" |
| `owner.mailingAddress.zipCode` | String | Mailing address zip | "78244" |
| `ownerOccupied` | Boolean | Property is owner-occupied | true |

---

## Feature Enum Values

### Architecture Types

`1.5 Story`, `2+ Story`, `A-Frame`, `Apartment`, `Bi-Level`, `Bungalow`, `Cabin`, `Cape Cod`, `Chalet`, `Colonial`, `Colonial Revival`, `Condo`, `Condominium`, `Contemporary`, `Conventional`, `Cottage`, `Custom`, `Dome`, `Duplex`, `English`, `European`, `Farm House`, `French Provincial`, `Gambrel`, `Georgian`, `High Rise`, `Historical`, `Log Cabin`, `Low Rise`, `Mansion`, `Manufactured`, `Mediterranean`, `Mid Rise`, `Mobile Home`, `Modern`, `Modular`, `Multi-family`, `Multi-Unit Building`, `Other`, `Old Style`, `Prefab`, `Quadruplex`, `Raised Ranch`, `Rambler`, `Ranch`, `Ranch House`, `Row End or Row Middle`, `Rustic`, `Single Story`, `Southwestern`, `Spanish`, `Split Entry`, `Split Foyer`, `Split Level`, `Townhouse`, `Traditional`, `Triplex`, `Tudor`, `Two Family`, `Under Construction`, `Victorian`

### Cooling Types

`Central`, `Chilled Water`, `Commercial`, `Evaporative`, `Fan Cooling`, `Geo-Thermal`, `Other`, `Package`, `Partial`, `Refrigeration`, `Solar`, `Split System`, `Ventilation`, `Wall`, `Window`

### Exterior Types

`Adobe`, `Aluminum`, `Aluminum Lap`, `Aluminum Siding`, `Asbestos Shingle`, `Asphalt Shingle`, `Baked Enamel`, `Block`, `Board & Batten`, `Brick`, `Brick Veneer`, `Cinder Block`, `Combination`, `Composition`, `Concrete`, `Concrete Block`, `Frame`, `Frame Brick`, `Frame Siding`, `Glass`, `Log`, `Marble`, `Marblecrete`, `Masonite`, `Masonry`, `Metal`, `Metal Siding`, `Other`, `Plywood`, `Precast Concrete Panel`, `Protective`, `Ribbed`, `Ribbed Aluminum`, `Rock`, `Shake`, `Shingle`, `Shingle Siding`, `Siding`, `Single Wall`, `Steel Panel`, `Stone`, `Stone Veneer`, `Stucco`, `Tile`, `Veneer`, `Vinyl`, `Vinyl Siding`, `Wood`, `Wood Frame`, `Wood Shingle`, `Wood Siding`

### Fireplace Types

`1 Story`, `1 Story Brick Chimney`, `2 Story`, `2 Story Brick Chimney`, `Backed`, `Flue Only`, `Gas Log`, `Masonry`, `Metal`, `Other`, `Prefab`, `Single`, `Stacked`, `Stacked Stone`, `Steel`

### Foundation Types

`Block`, `Block with Runner`, `Brick`, `Concrete`, `Concrete Block`, `Crawl`, `Crossed Walls`, `Footing`, `Girder`, `Masonry`, `Mat`, `Mud Sill`, `Other`, `Pier`, `Pile`, `Post & Beam`, `Raft`, `Raised`, `Retaining Wall`, `Slab`, `Stone`, `Wood`

### Garage Types

`Attached`, `Basement`, `Built-in`, `Carport`, `Covered`, `Detached`, `Garage`, `Mixed`, `Other`, `Offsite`, `Open`, `Parking Lot`, `Parking Structure`, `Paved`, `Surfaced`, `Underground`

### Heating Types

`Baseboard`, `Central`, `Coal`, `Convection`, `Electric`, `Floor`, `Floor Furnace`, `Forced Air`, `Forced Air Gas`, `Furnace`, `Gas`, `Gravity`, `Heat Pump`, `Hot Air`, `Hot Water`, `Oil`, `Other`, `Package`, `Partial`, `Propane`, `Radiant`, `Solar`, `Space`, `Steam`, `Stove`, `Vent`, `Wall`, `Warm Air`, `Zone`

### Pool Types

`Above-Ground Pool`, `Community Pool`, `Commercial Pool`, `Concrete`, `Enclosed Pool`, `Fiberglass`, `Gunite`, `Heated Pool`, `Hot Tub`, `In-Ground Pool`, `In-Ground Vinyl Pool`, `Indoor Pool`, `Municipal`, `Other`, `Plastic`, `Plastic Lined`, `Plastic w/ Vinyl Lining`, `Pool and Hot Tub`, `Public`, `Reinforced Concrete`, `Spa`, `Vinyl`

### Roof Types

`Aluminum`, `Asbestos`, `Asphalt`, `Asphalt Shingle`, `Built-up`, `Cedar Shake`, `Clay Tile`, `Composition Shingle`, `Concrete`, `Concrete Tile`, `Fiberglass`, `Galvanized`, `Gambrel`, `Gravel`, `Metal`, `Other`, `Rock`, `Roll Composition`, `Roll Paper`, `Roll Tar & Gravel`, `Shake`, `Shingle`, `Slate`, `Slate Tile`, `Steel`, `Tar & Gravel`, `Tile`, `Wood`, `Wood Shake`, `Wood Shingle`

### View Types

`Airport`, `Average`, `Beach`, `Canal`, `City`, `Corner`, `Creek`, `Cul-de-sac`, `Excellent`, `Fair`, `Fairway`, `Flood Plain`, `Flood Zone`, `Freeway`, `Golf Course`, `Good`, `High Traffic Area`, `Lake`, `Major Street`, `Mountain`, `Ocean`, `Other`, `Park`, `Pond`, `River`, `School`, `Thoroughfare`, `Water`, `Waterfront`

---

## Important Notes

1. **Data Availability**: Specific fields may vary by county and state. The API returns all available fields for each property.

2. **Multiple Values**: Feature fields with String data type may contain multiple values separated by forward slash (`/`).

3. **FIPS Codes**: State and county FIPS codes are standardized government codes for geographic areas.

4. **Dates**: All date fields use ISO 8601 format.

5. **Boolean Fields**: Feature fields like `cooling`, `heating`, `garage`, `pool`, `fireplace` indicate presence/absence.

---

## Our Database Mapping

The `homes` table in our database maps these Rentcast fields as follows:

| Rentcast Field | Database Column | Notes |
|----------------|-----------------|-------|
| `id` | `rentcast_id` | Unique identifier |
| `formattedAddress` | `formatted_address` | Full address string |
| `addressLine1` | `street_address` | Primary address |
| `city` | `city` | City name |
| `state` | `state` | 2-char state code |
| `zipCode` | `zip_code` | Zip code |
| `county` | `county` | County name |
| `latitude` | `lat` | Latitude |
| `longitude` | `lng` | Longitude |
| `propertyType` | `property_type` | Property type |
| `bedrooms` | `beds` | Bedrooms |
| `bathrooms` | `baths` | Bathrooms |
| `squareFootage` | `sqft` | Square footage |
| `lotSize` | `lot_size_sqft` | Lot size |
| `yearBuilt` | `year_built` | Year built |
| `features.floorCount` | `stories` | Number of stories |
| `assessorID` | `assessor_id` | Assessor ID |
| `lastSaleDate` | `last_sale_date` | Last sale date |
| `lastSalePrice` | `last_sale_price` | Last sale price |
| `taxAssessedValue` | `tax_assessed_value` | Tax value |
| `taxAssessedYear` | `tax_assessed_year` | Tax year |
| `taxAnnualAmount` | `tax_annual_amount` | Annual taxes |
| `features.garageSpaces` | `garage_spaces` | Garage spaces |
| `features.garageType` | `garage_type` | Garage type |
| `features.pool` | `pool` | Has pool (boolean) |
| `features.fireplace` | `fireplace` | Has fireplace (boolean) |
| `features.heatingType` | `heating_type` | Heating type |
| `features.coolingType` | `cooling_type` | Cooling type |
| `features.roofType` | `roof_type` | Roof type |
| `features.foundationType` | `foundation_type` | Foundation type |
| `features.architectureType` | `building_style` | Architecture style |
| `owner.name` | `owner_name` | Owner name |
| `owner.type` | `owner_type` | Owner type |
| `ownerOccupied` | `owner_occupied` | Owner occupied |
| `legalDescription` | `legal_description` | Legal description |
| `parcelNumber` | `parcel_number` | Parcel number |
| `subdivision` | `subdivision` | Subdivision |
| `zoning` | `zoning` | Zoning code |
| `features` (entire object) | `features` (JSONB) | All additional features |

---

## Reference Links

- [Rentcast API Documentation](https://developers.rentcast.io/)
- [Property Data Schema](https://developers.rentcast.io/reference/property-data-schema)
- [Property Types Reference](https://developers.rentcast.io/reference/property-types)
- [Property Records Endpoint](https://developers.rentcast.io/reference/property-records)

---

**Last Updated**: December 2025  
**Source**: [Rentcast Property Data Schema](https://developers.rentcast.io/reference/property-data-schema)

