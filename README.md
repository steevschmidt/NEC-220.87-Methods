# NEC-220.87-Methods

Tools and algorithms for measuring a home's peak power, useful for building electrification.

## Overview

This repository provides implementations of the NEC 220.87 method for calculating electrical panel capacity based on historical meter data. It helps homeowners, contractors, utilities, and other stakeholders determine whether existing electrical panels can support increased loads from home electrification projects without requiring costly upgrades.

## Repository Contents

- **Web Application**: A user-friendly HTML/CSS/JavaScript implementation
  - Simple file upload interface
  - Sample data for testing
  - Multiple calculation methods
  - Interactive visualization
  - Mobile-responsive design
  - Printable detailed reports
  - Visual indicators for capacity issues

- **Python Implementation**: 
  - Jupyter notebook with detailed methodology
  - Standalone Python application with Gradio interface
  - Comprehensive data processing and visualization

- **Test Data**: 
  - Various sample files for testing different scenarios
  - Expected results for validation
  - Documentation of data formats and use cases

## The Challenge of Home Electrification

Most Americans use fossil fuels in their homes and while driving. To help with the climate crisis, Americans need to migrate off fossil fuels. Electricity in most US states continues to get cleaner, so replacing fossil-fueled devices with electric equivalents reduces carbon emissions.

Examples of home electrification include:
1. Replacing a natural gas furnace with a modern electric heat pump
2. Replacing a gasoline car with an electric vehicle
3. Replacing a natural gas water heater with a heat pump water heater
4. Replacing a natural gas clothes dryer with an electric dryer
5. Replacing a natural gas cooktop with an induction cooktop

These changes will increase a home's electric load, making it necessary to determine whether the existing electric service can support this increased load. For homes with smart meters, the easiest method is defined in [NEC 220.87](https://up.codes/s/determining-existing-loads), which requires analysis of the home's electric interval data.

## Calculation Methods

The repository implements three different calculation methods:

1. **HEA (Home Energy Analytics)**: 
   - Applies a 1.3x multiplier to hourly readings
   - Moderately conservative approach

2. **NEC (National Electrical Code)**:
   - No adjustment to hourly readings
   - Least conservative approach

3. **LBNL (Lawrence Berkeley National Laboratory)**:
   - Variable adjustment based on load magnitude
   - Most conservative approach, providing higher safety margins

## How to Use

### Web Application
1. Open `index.html` in a web browser
2. Upload a CSV file with DateTime and kWh columns, or use the sample data
3. Enter your panel specifications (size and voltage)
4. Select a calculation method
5. View the results and visualization
6. Print a detailed report for your records

### Python Application
1. Navigate to the `python_version` directory
2. Install dependencies: `pip install -r requirements.txt`
3. Run the application: `python 2022_HEA_220_87_Methods.py`
4. Open the provided URL in your web browser

## Input Requirements

- CSV file with DateTime and kWh columns
- For 15-minute data: at least 30 days of readings
- For hourly data: at least 1 year of readings
- Panel size in amps (common sizes: 100A, 125A, 150A, 200A)
- Panel voltage (options: 240V, 208V, or 120V)

## Output Information

- Peak power in kW and Amps
- Remaining panel capacity (highlighted in red if negative)
- Data analysis summary and detailed statistics
- Interactive visualization of hourly load patterns
- Calculation method used
- Printable report with all analysis details

## Key Features

- **NEC Safety Factor**: Automatically applies the required 1.25x safety factor to peak loads when calculating remaining capacity
- **Standardized Voltage Options**: Provides the three standard US residential and commercial voltage options (240V, 208V, 120V)
- **Visual Warnings**: Highlights negative remaining capacity in red to clearly indicate when a panel upgrade may be needed
- **Comprehensive Reports**: Generates printable reports with all analysis details for documentation purposes
- **Data Validation**: Checks data quality and provides warnings about insufficient data periods

## Research and Results

HEA has applied NEC 220.87 to a wide variety of homes in California and has provided results [here](https://1drv.ms/f/s!Ag7eOV5ifY5Ch2FNngIFZEzuLLFm?e=igYtZF). This analysis shows that most homes will not need a service upgrade. However, it is critical that this code be applied consistently and correctly to make this determination in a safe and reliable manner.

## Contributing

Contributions to improve the implementations or add new features are welcome. Please ensure that any changes maintain compatibility with the existing test data and expected results.

## License

[TBD: Add license information here]
