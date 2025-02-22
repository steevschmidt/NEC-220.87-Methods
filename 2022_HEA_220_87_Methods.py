"""
NEC 220.87 Panel Capacity Calculator

This module implements the NEC 220.87 method for calculating electrical panel capacity
based on historical meter data. It provides both calculation functions and a web interface
for easy use.

Original methodology developed in Jupyter notebook:
https://github.com/HomeElectricationAlliance/NEC-220.87-Methods/blob/main/2022_HEA_220_87.ipynb

Key features:
- Processes CSV files containing DateTime and kW columns
- Handles both 15-minute and hourly interval data
- Implements NEC 220.87 safety factors
- Provides visual representation of load patterns
- Calculates remaining panel capacity

For more information on NEC 220.87, see:
https://up.codes/s/determining-existing-loads
"""

import pandas as pd
import numpy as np
import gradio as gr
from io import StringIO
import warnings
from altair.utils.deprecation import AltairDeprecationWarning
import os

# Suppress Altair deprecation warnings
warnings.filterwarnings("ignore", category=AltairDeprecationWarning)

def get_peak_hourly_load(df: pd.DataFrame) -> float:
    """Estimates the peak hourly load in kW from meter values.
    
    Implementation follows the methodology from the original Jupyter notebook:
    https://github.com/HomeElectricationAlliance/NEC-220.87-Methods/blob/main/2022_HEA_220_87.ipynb
    
    Key aspects of the calculation:
    - For 15-minute intervals: multiplies by 4 to get hourly equivalent
    - Applies 1.3x safety factor for single readings per NEC 220.87
    - Automatically detects interval type based on data

    Arguments:
        df:
            Input meter values, supplied as a pandas dataframe with the following columns:
                "DateTime" (the measurement interval's start in format "YYYY-MM-DD HH:MM:00"),
                "kW" (the measured meter value in kilowatts)
            The dataframe may contain a mix of hourly and 15-minute interval values.

    Returns:
        A float value for the estimated peak hourly load in kW
    """
    df.set_index('DateTime', inplace=True, drop=False)
    df_hourly = df.groupby(pd.Grouper(freq='h', level='DateTime')).agg({'kW': ['max', 'nunique'], 'DateTime': 'nunique'})
    df_hourly.columns = df_hourly.columns.map('_'.join)
    df_hourly['period'] = np.where(df_hourly['DateTime_nunique'] == 1, 1, 4)
    df_hourly['kW_max_adj'] = np.where(df_hourly['kW_nunique'] == 1, 
                                      df_hourly['kW_max'] * df_hourly['period'] * 1.3, 
                                      df_hourly['kW_max'] * df_hourly['period'])
    return df_hourly['kW_max_adj'].max()

def get_remaining_panel_capacity(peak_hourly_load_kW: float, panel_size_A: int, panel_voltage_V=240) -> float:
    """Estimates the remaining panel capacity in kW from panel size and peak hourly load.
    
    Implements NEC 220.87 calculation for remaining capacity. The calculation:
    1. Converts panel capacity from Amps to kW
    2. Subtracts 1.25x the peak load per NEC requirements
    
    Arguments:
        peak_hourly_load_kW:
            Estimated peak hourly load in kilowatts, see get_peak_hourly_load
        panel_size_A:
            Current panel size in amperes (amps)
        panel_voltage_V:
            Current panel voltage in volts (default: 240V)
    Returns:
        A float value for the remaining electric panel capacity in kW, according to NEC-220.87
    """
    return panel_size_A * panel_voltage_V / 1000 - 1.25 * peak_hourly_load_kW

def process_inputs(temp_file, panel_size_A, panel_voltage_V):
    """Process input file and parameters to calculate panel capacity and create visualization.
    
    This function:
    1. Reads and validates the input CSV file
    2. Calculates peak load and remaining capacity
    3. Generates visualization data showing load patterns
    4. Provides results in both kW and Amp units
    
    The visualization shows:
    - Peak load line (from NEC 220.87 calculation)
    - Maximum values by hour
    - Mean values by hour
    - Minimum values by hour
    """
    try:
        if temp_file is None:
            raise gr.Error("Please upload a file")
            
        if isinstance(temp_file, str):
            df = pd.read_csv(StringIO(temp_file), parse_dates=["DateTime"])
        else:
            df = pd.read_csv(temp_file.name, parse_dates=["DateTime"])
            
        peak_hourly_load_kW = get_peak_hourly_load(df)
        remaining_panel_capacity_kW = get_remaining_panel_capacity(peak_hourly_load_kW, panel_size_A, panel_voltage_V)
        
        # Calculate Amp values
        peak_power_A = peak_hourly_load_kW * 1000 / panel_voltage_V
        remaining_panel_capacity_A = remaining_panel_capacity_kW * 1000 / panel_voltage_V

        # Create visualization data
        df.set_index('DateTime', inplace=True)
        df['hour'] = df.index.hour
        df_hourly_mean = df.groupby('hour').mean().reset_index(drop=False)
        df_hourly_max = df.groupby('hour').max().reset_index(drop=False)
        df_hourly_min = df.groupby('hour').min().reset_index(drop=False)
        df_hourly_peak = df.groupby('hour').first().reset_index(drop=False)
        df_hourly_peak['kW'] = peak_hourly_load_kW

        df_hourly = pd.concat([
            df_hourly_peak, 
            df_hourly_max, 
            df_hourly_mean,
            df_hourly_min
        ], ignore_index=True)
        
        df_hourly['stat'] = (
            ['peak'] * len(df_hourly_peak) + 
            ['max'] * len(df_hourly_max) + 
            ['mean'] * len(df_hourly_mean) +
            ['min'] * len(df_hourly_min)
        )
        
        df_hourly = df_hourly.melt(id_vars=['hour', 'stat'], var_name='column', value_name='kW_value')
        df_hourly = df_hourly.drop('column', axis=1)

        return (peak_hourly_load_kW, peak_power_A, remaining_panel_capacity_kW, remaining_panel_capacity_A, df_hourly)
    
    except Exception as e:
        raise gr.Error(f"Error processing file: {str(e)}")

def show_file_info(file):
    """Display information about the uploaded file."""
    if file is None:
        return "No file uploaded"
    try:
        return f"File ready for processing: {file.name}"
    except:
        return f"File received but unable to get name: {str(file)}"

def launch_gradio_interface():
    """Launch the Gradio interface for the panel capacity calculator.
    
    Creates a web interface with:
    - File upload for CSV data
    - Input fields for panel specifications
    - Results in both kW and Amp units
    - Visualization of load patterns
    
    The interface runs locally on port 7861 and includes:
    - Clear button to reset all fields
    - Error handling for invalid inputs
    - Interactive plot of load patterns
    """
    
    def reset_values():
        """Reset form to default values"""
        return [None, 150, 240, None, None, None, None, None]
    
    demo = gr.Interface(
        fn=process_inputs,
        inputs=[
            gr.File(label="Upload meter data (CSV format)", file_types=[".csv"]),
            gr.Number(label="Current panel capacity in amps", value=150),
            gr.Number(label="Current panel voltage", value=240),
        ],
        outputs=[
            gr.Number(label="Peak power in kW", precision=2),
            gr.Number(label="Peak power in Amps", precision=1),
            gr.Number(label="Remaining panel capacity in kW", precision=2),
            gr.Number(label="Remaining panel capacity in Amps", precision=1),
            gr.LinePlot(
                label="Hourly loads",
                x="hour",
                y="kW_value",
                color='stat',
                width=400,
                height=200,
                interactive=False
            ),
        ],
        title="Panel Capacity Calculator",
        description="Upload a CSV file with DateTime and kW columns to calculate panel capacity.",
        allow_flagging="never",
        clear_fn=reset_values
    )

    # Check if running in Amplify
    is_amplify = os.getenv('AWS_EXECUTION_ENV') is not None

    if is_amplify:
        # Amplify configuration
        demo.launch(
            server_name="0.0.0.0",
            server_port=8080,
            share=True,
            auth=None,
            ssl_verify=False
        )
    else:
        # Local development configuration
        demo.launch(
            server_name="127.0.0.1",
            server_port=7861
        )

if __name__ == "__main__":
    launch_gradio_interface() 