# Test Data Files for NEC 220.87 Calculator

This directory contains test files for validating the NEC 220.87 panel capacity calculator.

## Test Files

### Elec_Interval_Test_CSV1.csv
- Original sample data from the Jupyter notebook
- Simple 15-minute interval data
- Contains duplicate entries (e.g., 11/25/23 16:00)
- Tests basic data cleaning and validation
- Tests handling of duplicate timestamps

### Elec_Interval_Test_CSV2.csv
- Real-world home electricity usage data
- Hourly intervals over ~1.5 months (June-July 2010)
- Contains trailing empty rows
- Peak load around 4.33 kW
- Tests handling of:
  - Real-world data patterns
  - Empty rows
  - Longer time series
  - Daily/weekly usage patterns

### sample_15min.csv
- 15-minute interval data
- Clean, consistent intervals
- Expected peak hourly load: ~1.25 kW
- Tests basic 15-minute interval aggregation

### sample_hourly.csv
- Hourly interval data
- Clean, consistent intervals
- Expected peak hourly load: ~3.15 kW
- Tests basic hourly data handling

### sample_mixed.csv
- Mix of 15-minute and hourly intervals
- Tests handling of mixed interval data
- Expected peak hourly load: ~3.15 kW
- Tests interval detection and aggregation

### sample_invalid.csv
- Contains invalid data entries
- Tests error handling
- Should raise appropriate error messages
- Tests input data validation

## Data Format
All files should follow this format:
- CSV format
- Two columns: DateTime,kW
- DateTime format varies by file:
  - MM/DD/YY HH:MM (Elec_Interval_Test_CSV1.csv)
  - M/D/YY HH:MM (Elec_Interval_Test_CSV2.csv)
  - YYYY-MM-DD HH:MM:SS (sample files)
- kW values as decimal numbers

## Usage
These files can be used to:
1. Test the basic functionality of the calculator
2. Verify handling of different interval types
3. Validate error handling
4. Test visualization features
5. Verify data cleaning procedures
6. Test handling of real-world data anomalies 