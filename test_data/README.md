# Test Data Files for NEC 220.87 Calculator

This directory contains test files for validating the NEC 220.87 panel capacity calculator.

## Test Files

### Standard Format Files

### test1_orig.csv
* Original sample data from the Jupyter notebook
* Simple 15-minute interval data
* Contains duplicate entries
* Tests basic data cleaning and validation

### test2_hourly_1mo.csv
* Real-world home electricity usage data
* Hourly intervals over ~1 month
* Contains trailing empty rows
* Tests handling of hourly data patterns

### test3_fake15_1mo.csv
* "Fake" 15-minute interval data (identical readings within each hour)
* 1 month of data
* Tests handling of repeated values within hourly periods
* Tests application of appropriate multipliers

### test4_15min_1mo.csv
* Real 15-minute interval data
* 1 month of data
* Tests handling of true 15-minute data
* Tests proper aggregation of 15-minute readings

### test5_15min_1yr.csv
* Real 15-minute interval data
* 1 year of data
* Tests handling of larger datasets
* Tests performance with long time series

### test6_15mPV_1m.csv
* 15-minute interval data with solar PV generation
* 1 month of data
* Tests handling of variable load patterns, including negative values
* Tests performance with renewable energy sources

### sample_15min.csv
* 15-minute interval data
* Clean, consistent intervals
* Tests basic 15-minute interval aggregation

### sample_hourly.csv
* Hourly interval data
* Clean, consistent intervals
* Tests basic hourly data handling

### sample_mixed.csv
* Mix of 15-minute and hourly intervals
* Tests handling of mixed interval data
* Tests interval detection and aggregation

### sample_invalid.csv
* Contains invalid data entries
* Tests error handling
* Should raise appropriate error messages
* Tests input data validation

### PG&E Format Files

### pge_15min_1mo.csv
* PG&E format with 15-minute interval data
* Contains one or more hours where 15 minute intervals are identical (identified as "fake" 15 minute data)
* 1 month of data
* Contains Start Time, End Time, Usage, Cost, and Notes columns
* Tests parsing of PG&E format with 15-minute intervals
* Tests handling of additional columns

### pge_hourly_1mo.csv
* PG&E format with hourly interval data
* 1 month of data
* Contains Start Time, End Time, Usage, Cost, and Notes columns
* Tests parsing of PG&E format with hourly intervals
* Tests proper application of hourly multipliers with PG&E format

## Expected Results by Calculation Method

The table below shows the expected Peak Power results (in kW) for each test file using different calculation methods:

| Test File | HEA-jupyter | HEA-python | HEA-JS | NEC | LBNL |
|-----------|-------------|------------|--------|-----|------|
| sample_15min | 5.00 | 5.00 | 5.00 | 5.00 | 5.00 |
| sample_hourly | 4.09 | 4.09 | 4.09 | 3.15 | 6.61 |
| sample_invalid | [fail] | Error | Error | Error | Error |
| sample_mixed | 4.09 | 4.09 | 4.09 | 3.40 | 6.61 |
| test1_orig | 4.21 | 4.21 | 4.20 | 4.21 | 6.72 |
| test2_hourly_1mo | 6.20 | 6.20 | 6.20 | 4.77 | 8.87 |
| test3_fake15_1mo | 10.71 | 10.71 | 10.71 | 8.24 | 13.44 |
| test4_15min_1mo | 9.46 | 9.46 | 9.46 | 9.46 | 9.46 |
| test5_15min_1yr | 27.85 | 27.85 | 27.85 | 27.85 | 27.85 |
| test6_15mPV_1m | 7.95 | 7.95 | 7.95 | 7.95 | 7.95 |
| pge_test1.csv | na | na | 12.36 | 12.36 | 12.36 |
| pge_test2.csv | na | na | 8.40 | 6.46 | 11.24 |

Other validation tests:
 1. Total Panel Capacity in kWh (not currently displayed) should equal the input Panel Capacity in Amps times the input Panel Voltage divided by 1000.
 2. The Peak Power in amps should equal the Peak Power in kW divided by the Panel Voltage and multiplied by 1000.
 3. The Remaining Capacity should equal the total panel capacity minus the Peak Power multiplied by the NEC Safety Factor (1.25).

## Calculation Methods

### HEA (Home Energy Analytics)
* Applies a 1.3x multiplier to hourly readings
* Applies both 4x and 1.3x multipliers to fake 15-minute data
* Applies only 4x multiplier to real 15-minute data
* Moderately conservative approach

### NEC (National Electrical Code)
* No adjustment to hourly readings
* Applies only 4x multiplier to fake 15-minute data
* Applies only 4x multiplier to real 15-minute data
* Least conservative approach

### LBNL (Lawrence Berkeley National Laboratory)
* For hourly values < 7.5 kW: 2.2 + 1.4 * hourlyValue
* For hourly values ≥ 7.5 kW: 5.2 + hourlyValue
* For fake 15-minute data, applies formula after 4x multiplier
* Most conservative approach, providing higher safety margins

## Data Format

### Standard Format
* CSV format
* Two columns: DateTime,kWh
* DateTime format varies by file
* kWh values as decimal numbers

### PG&E Format
* CSV format with header rows
* Multiple columns including: Start Time, End Time, Usage, Cost, Notes
* "Start Time" column used for DateTime
* "Usage" column used for kWh values
* May contain additional metadata in header rows

### UtilityAPI Format
* CSV format with header row
* Multiple columns including: interval_start, interval_end, interval_kWh, and utility-specific metadata
* "interval_start" column used for DateTime
* "interval_kWh" column used for kWh values
* Supports data from various utilities through UtilityAPI's standardized format
* Date/time format: M/D/YY HH:MM

## Usage

These files can be used to:
1. Test the basic functionality of the calculator
2. Verify handling of different interval types
3. Validate error handling
4. Test visualization features
5. Verify data cleaning procedures
6. Test handling of real-world data anomalies
7. Compare results across different calculation methods
8. Validate format detection and parsing for different utility data formats
9. Test compatibility with PG&E energy usage exports 
