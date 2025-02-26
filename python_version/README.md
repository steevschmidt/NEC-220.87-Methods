# Python Implementation of NEC 220.87 Panel Capacity Calculator

This folder contains the Python implementation of the NEC 220.87 Panel Capacity Calculator (using HEA's method), including both a Jupyter notebook for step-by-step exploration and a standalone Python application.

## Contents

- `2022_HEA_220_87.ipynb`: Jupyter notebook with detailed methodology
- `2022_HEA_220_87_Methods.py`: Standalone Python application
- `requirements.txt`: Python dependencies

## Jupyter Notebook

The Jupyter notebook (`2022_HEA_220_87.ipynb`) provides a step-by-step overview and demonstration of the HEA 220.87 method. It's intended for:

- **Educational purposes**: Understanding the methodology behind the calculations
- **Exploration**: Experimenting with different data and parameters
- **Visualization**: Seeing detailed charts and graphs of the analysis process
- **Development**: Serving as a reference for implementing the method in other languages

The notebook includes:
- Detailed explanations of the NEC 220.87 methodology
- Code for data import and cleaning
- Visualizations of load patterns
- Step-by-step calculation of peak loads
- Examples with different types of interval data

### Running the Notebook

1. Install Jupyter: `pip install jupyter`
2. Install dependencies: `pip install -r requirements.txt`
3. Launch Jupyter: `jupyter notebook`
4. Open `2022_HEA_220_87.ipynb`

## Standalone Python Application

The standalone Python application (`2022_HEA_220_87_Methods.py`) implements the NEC 220.87 method in a web-based interface using Gradio. It's designed for:

- **Production use**: Processing real meter data files
- **User-friendly interface**: Easy to use without programming knowledge
- **Deployment**: Can be deployed locally or on a server
- **Integration**: Can be integrated with other systems

Key features:
- CSV file upload and processing
- Automatic detection of data interval types (15-minute, hourly)
- Application of appropriate multipliers based on data type
- Calculation of peak load and remaining panel capacity
- Interactive visualization of hourly load patterns

### Running the Application

1. Install dependencies: `pip install -r requirements.txt`
2. Run the application: `python 2022_HEA_220_87_Methods.py`
3. Open the provided URL in your web browser (typically http://127.0.0.1:7861)

## Implementation Details

The Python implementation follows the NEC 220.87 methodology with the following key aspects:

1. **Data Processing**:
   - Handles both 15-minute and hourly interval data
   - Automatically detects data types
   - Cleans and validates input data

2. **Peak Load Calculation**:
   - For 15-minute data: Multiplies by 4 to get hourly equivalent
   - For hourly data: Applies 1.3x multiplier per HEA method
   - For "fake" 15-minute data (identical readings): Applies both 4x and 1.3x multipliers

3. **Remaining Capacity Calculation**:
   - Applies 1.25x multiplier to peak load per NEC requirements
   - Calculates remaining capacity based on panel specifications

4. **Visualization**:
   - Shows hourly load patterns
   - Displays peak, max, mean, and min values
   - Provides interactive charts

## Dependencies

- pandas: Data processing and analysis
- numpy: Numerical computations
- gradio (v3.50.2): Web interface
- altair: Data visualization

Install all dependencies with: `pip install -r requirements.txt`

## Related Resources

- [Original GitHub Repository](https://github.com/HomeElectricationAlliance/NEC-220.87-Methods)
- [NEC 220.87 Documentation](https://up.codes/s/determining-existing-loads)
- [Web Version](../index.html): JavaScript implementation with the same functionality 