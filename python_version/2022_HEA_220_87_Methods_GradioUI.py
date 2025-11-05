"""
Simple Gradio UI for the NEC 220.87 Panel Capacity Calculator.
See hea_nec/methods.py for more details.
"""

import pandas as pd
import gradio as gr
from io import StringIO
import warnings
from altair.utils.deprecation import AltairDeprecationWarning
import os
from typing import Union

from hea_nec.methods import calculate_nec_22087_capacity

# Suppress Altair deprecation warnings
warnings.filterwarnings("ignore", category=AltairDeprecationWarning)

def calculate_nec_22087_capacity_for_gradio(temp_file: Union[str, bytes], panel_size_A: int, panel_voltage_V: int):
    """A wrapper for Gradio to catch exceptions and convert them to gr.Error."""
    try:
        if temp_file is None:
            raise ValueError("Please upload a file")
            
        # Handle flexible file input: either a file path (str) or binary content (bytes)
        if isinstance(temp_file, str):
            with open(temp_file, 'r', encoding='utf-8') as f:
                content = f.read()
        elif isinstance(temp_file, bytes):
            content = temp_file.decode('utf-8')
        else:
            raise TypeError(f"Unsupported input type: {type(temp_file)}")

        df = pd.read_csv(StringIO(content))
        
        site_table = pd.DataFrame({
            'panel_size_A': [panel_size_A],
            'panel_voltage_V': [panel_voltage_V]
        })

        detailed_results, summary_results = calculate_nec_22087_capacity(df, site_table)
        
        # Unpack results for Gradio output
        return (
            summary_results['peak_hourly_load_kW'], 
            summary_results['peak_power_A'], 
            summary_results['remaining_panel_capacity_kW'], 
            summary_results['remaining_panel_capacity_A'], 
            detailed_results['df_hourly']
        )
    except Exception as e:
        raise gr.Error(f"Error processing file: {str(e)}")

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
        
        with gr.Row():
            clear_btn = gr.ClearButton([file_input, peak_power_kw, peak_power_amps, 
                                      remaining_capacity_kw, remaining_capacity_amps, plot])
            
            # Reset panel values to defaults when cleared
            clear_btn.click(
                fn=lambda: [150, 240],
                outputs=[panel_size, panel_voltage]
            )
        
        submit_btn.click(
            fn=calculate_nec_22087_capacity_for_gradio,
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