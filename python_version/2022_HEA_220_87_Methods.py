"""
NEC 220.87 Panel Capacity Calculator

This module implements the NEC 220.87 method for calculating electrical panel capacity
based on historical meter data. It provides both calculation functions and a web interface
for easy use.

Original methodology developed in Jupyter notebook:
https://github.com/HomeElectricationAlliance/NEC-220.87-Methods/blob/main/2022_HEA_220_87.ipynb

Key features:
- Processes CSV files containing DateTime and kWh columns
- Handles both 15-minute and hourly interval data
- Implements NEC 220.87 safety factors:
  * 1.25x multiplier for final capacity calculation
  * 1.3x multiplier for single readings
- Provides visual representation of load patterns
- Calculates remaining panel capacity

Interface:
- Input: CSV file with DateTime and kWh columns
- Panel specifications: size (amps) and voltage
- Outputs: peak power and remaining capacity in both kW and Amps
- Interactive visualization of hourly load patterns

Dependencies:
- pandas: Data processing and analysis
- numpy: Numerical computations
- gradio (v3.50.2): Web interface
- altair: Data visualization

For more information on NEC 220.87, see:
https://up.codes/s/determining-existing-loads

Note: This implementation is designed to work with both local development
and AWS Amplify deployment environments.
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

    Args:
        df: Input meter values as pandas DataFrame with columns:
            "DateTime" (measurement interval start, format "YYYY-MM-DD HH:MM:00")
            "kWh" (measured meter value in kilowatt-hours)

    Returns:
        float: Estimated peak hourly load in kW
    """
    df.set_index('DateTime', inplace=True, drop=False)
    df_hourly = df.groupby(pd.Grouper(freq='h', level='DateTime')).agg({'kWh': ['max', 'nunique'], 'DateTime': 'nunique'})
    df_hourly.columns = df_hourly.columns.map('_'.join)
    df_hourly['period'] = np.where(df_hourly['DateTime_nunique'] == 1, 1, 4)
    df_hourly['kWh_max_adj'] = np.where(df_hourly['kWh_nunique'] == 1, 
                                      df_hourly['kWh_max'] * df_hourly['period'] * 1.3, 
                                      df_hourly['kWh_max'] * df_hourly['period'])
    return df_hourly['kWh_max_adj'].max()

def get_remaining_panel_capacity(peak_hourly_load_kW: float, panel_size_A: int, panel_voltage_V=240) -> float:
    """Estimates the remaining panel capacity in kW from panel size and peak hourly load.
    
    Implements NEC 220.87 calculation for remaining capacity. The calculation:
    1. Converts panel capacity from Amps to kW
    2. Subtracts 1.25x the peak load per NEC requirements
    
    Args:
        peak_hourly_load_kW: Estimated peak hourly load in kilowatts
        panel_size_A: Current panel size in amperes (amps)
        panel_voltage_V: Current panel voltage in volts (default: 240V)

    Returns:
        float: Remaining electric panel capacity in kW, according to NEC-220.87
    """
    return panel_size_A * panel_voltage_V / 1000 - 1.25 * peak_hourly_load_kW

def process_inputs(temp_file, panel_size_A, panel_voltage_V):
    """Process input file and parameters to calculate panel capacity and create visualization.
    
    Args:
        temp_file: CSV file upload containing DateTime and kWh columns
        panel_size_A: Panel capacity in amps
        panel_voltage_V: Panel voltage in volts

    Returns:
        tuple: (peak_kW, peak_A, remaining_kW, remaining_A, visualization_data)
        
    Raises:
        gr.Error: If file upload fails or processing encounters an error
    """
    try:
        if temp_file is None:
            raise gr.Error("Please upload a file")
            
        # Handle file input
        if isinstance(temp_file, str):
            df = pd.read_csv(StringIO(temp_file), parse_dates=["DateTime"])
        else:
            # For binary file uploads
            content = temp_file.decode('utf-8')
            df = pd.read_csv(StringIO(content), parse_dates=["DateTime"])
            
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
        df_hourly_peak['kWh'] = peak_hourly_load_kW

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
        
        df_hourly = df_hourly.melt(id_vars=['hour', 'stat'], var_name='column', value_name='kWh_value')
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
    - File upload for meter data
    - Input fields for panel specifications
    - Calculate button to process data
    - Output display of results
    - Interactive visualization
    - Clear button to reset form
    
    Handles both local development and AWS Amplify deployment configurations.
    """
    
    with gr.Blocks(title="Panel Capacity Calculator") as demo:
        gr.Markdown("# Panel Capacity Calculator")
        gr.Markdown("Upload a CSV file with DateTime and kWh columns to calculate panel capacity.")
        
        with gr.Row():
            file_input = gr.File(
                label="Upload meter data (CSV format)", 
                file_types=[".csv"],
                type="binary"
            )
            panel_size = gr.Number(label="Current panel capacity in amps", value=150)
            panel_voltage = gr.Number(label="Current panel voltage", value=240)
        
        # Calculate button moved here, between inputs and outputs
        submit_btn = gr.Button("Calculate")
        
        with gr.Row():
            peak_power_kw = gr.Number(label="Peak power in kW", precision=2)
            peak_power_amps = gr.Number(label="Peak power in Amps", precision=1)
            remaining_capacity_kw = gr.Number(label="Remaining panel capacity in kW", precision=2)
            remaining_capacity_amps = gr.Number(label="Remaining panel capacity in Amps", precision=1)
        
        with gr.Row():
            plot = gr.LinePlot(
                label="Hourly loads",
                x="hour",
                y="kWh_value",
                color='stat',
                width=400,
                height=200,
                interactive=False
            )
        
        # Clear button stays at bottom
        with gr.Row():
            clear_btn = gr.ClearButton([file_input, peak_power_kw, peak_power_amps, 
                                      remaining_capacity_kw, remaining_capacity_amps, plot])
            
            # Reset panel values to defaults when cleared
            clear_btn.click(
                fn=lambda: [150, 240],
                outputs=[panel_size, panel_voltage]
            )
        
        submit_btn.click(
            fn=process_inputs,
            inputs=[file_input, panel_size, panel_voltage],
            outputs=[peak_power_kw, peak_power_amps, 
                    remaining_capacity_kw, remaining_capacity_amps, plot]
        )

    # Check if running in Amplify
    is_amplify = os.getenv('AWS_EXECUTION_ENV') is not None

    if is_amplify:
        # Amplify configuration
        demo.launch(
            server_name="0.0.0.0",
            server_port=80,
            share=False,
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