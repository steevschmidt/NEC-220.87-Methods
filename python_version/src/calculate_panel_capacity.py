#!/usr/bin/env python

"""
Example batch script for running the NEC 220.87 Panel Capacity Calculator.

This tool calculates only the panel capacity from meter data, without adding/removing any appliances or load controls.
It demonstrates the invocation of the calculate_nec_22087_capacity subroutine.

Usage:
    python calculate_panel_capacity.py --panel-size 200 --voltage 240 meter_data1.csv meter_data2.csv ...

See hea_nec/methods.py for more details.
"""

import pandas as pd
import argparse

from hea_nec.methods import calculate_nec_22087_capacity

parser = argparse.ArgumentParser(description="Batch process meter data files for panel capacity.")
parser.add_argument('files', nargs='+', help="Path to one or more CSV meter data files.")
parser.add_argument('--panel-size', type=int, default=150, help="Panel capacity in amps (default: 150)")
parser.add_argument('--voltage', type=int, default=240, help="Panel voltage (default: 240)")
args = parser.parse_args()

print("Running in batch mode...")
for file_path in args.files:
    print(f"\n--- Processing: {file_path} ---")
    df = pd.read_csv(file_path)

    site_spec = {
        'panel_size_A': args.panel_size,
        'panel_voltage_V': args.voltage
    }

    detailed_results, summary_results = calculate_nec_22087_capacity(df, site_spec)

    print("\n  Summary Details:")
    summary_details = detailed_results.get('summary_details', {})
    if summary_details:
        for key, value in summary_details.items():
            if value is not None:
                print(f"    {key.replace('_', ' ').title()}: {value}")
    else:
        print("    No summary details generated.")

    print("\n  Calculation Results:")
    print(f"    Panel: {args.panel_size}A, {args.voltage}V")
    print(f"    Calculated Peak Power: {summary_results.get('peak_hourly_load_kW', 0):.2f} kW ({summary_results.get('peak_power_A', 0):.1f} A)")
    print(f"    Remaining Capacity: {summary_results.get('remaining_panel_capacity_kW', 0):.2f} kW ({summary_results.get('remaining_panel_capacity_A', 0):.1f} A)")
