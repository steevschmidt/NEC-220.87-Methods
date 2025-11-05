
"""
NEC 220.87 Panel Capacity Calculator

This module implements the NEC 220.87 method for calculating electrical panel capacity
based on historical meter data. It provides both calculation functions and a web interface
for easy use.

Original methodology developed in Jupyter notebook:
https://github.com/HomeElectricationAlliance/NEC-220.87-Methods/blob/main/2022_HEA_220_87.ipynb

Key features:
- Processes Panda dataframes containing DateTime and kWh columns
- Handles both 15-minute and hourly interval data
- Implements NEC 220.87 safety factors:
  * 1.25x multiplier for final capacity calculation
  * 1.3x multiplier for single readings
- Provides visual representation of load patterns
- Calculates remaining panel capacity

Interface:
- Input: CSV file with either DateTime and kWh or interval_start and interval_kWh (UtilityAPI) columns
- Panel specifications: size (amps) and voltage
- Outputs: peak power and remaining capacity in both kW and Amps; hourly load patterns; summary statistics

Dependencies:
- pandas: Data processing and analysis
- numpy: Numerical computations

For more information on NEC 220.87, see:
https://up.codes/s/determining-existing-loads.
"""

import pandas as pd
import numpy as np
import warnings
from altair.utils.deprecation import AltairDeprecationWarning
from typing import Dict, Tuple, Any

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

def calculate_summary_details(df : pd.DataFrame, file_format : str) -> Dict[str, Any]:
    """Helper function to output some additional statistics of the provided meter data.
    
    Args:
        df: meter data with columns DateTime and kWh
        file_format: "UtilityAPI" or "Simple CSV"
        
    Returns:
        a dict with additional statistics
    """
    first_reading = df['DateTime'].iloc[0]
    last_reading = df['DateTime'].iloc[-1]
    days_covered = round((last_reading - first_reading).total_seconds() / (1000 * 60 * 60 * 24 / 1000))

    # Group by hour for pattern analysis
    hourly_groups = df.groupby(pd.Grouper(key='DateTime', freq='h')).agg(
        readings_count=('kWh', 'count'),
        unique_readings=('kWh', 'nunique')
    ).dropna()
    
    total_hours_with_data = len(hourly_groups)
    hours_with_single_reading = (hourly_groups['readings_count'] == 1).sum()
    hours_with_four_unique_readings = ((hourly_groups['readings_count'] == 4) & (hourly_groups['unique_readings'] > 1)).sum()
    hours_with_four_identical_readings = ((hourly_groups['readings_count'] == 4) & (hourly_groups['unique_readings'] == 1)).sum()

    data_types = []
    if hours_with_single_reading > 0:
        data_types.append("Hourly")
    if hours_with_four_unique_readings > 0:
        data_types.append("15-minute")
    
    percentage_identical = (hours_with_four_identical_readings / total_hours_with_data * 100) if total_hours_with_data > 0 else 0
    if percentage_identical > 50:
        data_types.append("Fake 15-minute")

    peak_reading_row = df.loc[df['kWh'].idxmax()]
    peak_interval_readings = hourly_groups.loc[peak_reading_row['DateTime'].floor('h')]['readings_count']
    interval_length = 60 if peak_interval_readings == 1 else 15

    return {
        "data_span": {
            "days_covered": days_covered,
            "first_reading": first_reading.strftime('%Y-%m-%d %H:%M:%S'),
            "last_reading": last_reading.strftime('%Y-%m-%d %H:%M:%S'),
            "total_readings": len(df),
            "total_hours_with_data": total_hours_with_data,
        },
        "file_format": file_format,
        "data_types_detected": data_types or [ "Unknown" ],
        "avg_readings_per_hour": len(df) / total_hours_with_data if total_hours_with_data > 0 else "0.0",
        "avg_readings_per_day": len(df) / days_covered if days_covered > 0 else "0.0",
        "peak_reading": {
            "date_time": peak_reading_row['DateTime'].strftime('%Y-%m-%d %H:%M:%S'),
            "interval_length": interval_length,
            "value_kWh": peak_reading_row['kWh'],
        },
        "pattern_analysis": {
            "total_hours_with_single_reading": hours_with_single_reading,
            "total_hours_with_four_unique_readings": hours_with_four_unique_readings,
            "total_hours_with_four_identical_readings": hours_with_four_identical_readings,
        },
    }

def calculate_nec_22087_capacity(ua_intervals: pd.DataFrame, site_table: pd.DataFrame) -> Tuple[Dict[str, Any], Dict[str, float]]:
    """Process input DataFrame and parameters to calculate panel capacity and create visualization data.
    
    Args:
        ua_intervals: Input meter values as pandas DataFrame with columns:
            "DateTime" (measurement interval start, format "YYYY-MM-DD HH:MM:00") or "interval_start" (format "M/DD/YY HH:MM")
            "kWh" (measured meter value in kilowatt-hours) or "interval_kWh"
        site_table: Pandas DataFrame with panel specifications. Must contain one row with columns 'panel_size_A' and 'panel_voltage_V'.

    Returns:
        tuple: A tuple of two dicts: (detailed_results, summary_results)
               detailed_results contains {'df_hourly': visualization pd.DataFrame, 'summary_details': additional summary statistics/metadata}
               summary_results contains {'peak_hourly_load_kW', 'peak_power_A', 
                                         'remaining_panel_capacity_kW', 'remaining_panel_capacity_A'}
        
    Raises:
        ValueError: If the DataFrame format is not recognized or the site_table has more than one row.
    """
    if len(site_table) > 1:
        raise ValueError("The site table must contain exactly one row for this calculation.")

    panel_size_A = site_table['panel_size_A'].iloc[0]
    panel_voltage_V = site_table['panel_voltage_V'].iloc[0]
    
    df = ua_intervals.copy()

    # Detect CSV format and rename columns to the expected standard ('DateTime', 'kWh')
    if 'interval_start' in df.columns and 'interval_kWh' in df.columns:
        file_format = 'UtilityAPI'
        df.rename(columns={'interval_start': 'DateTime', 'interval_kWh': 'kWh'}, inplace=True)
    elif 'DateTime' in df.columns and 'kWh' in df.columns:
        file_format = 'Simple CSV'
    else:
        raise ValueError("CSV format not recognized. Required columns are either ('DateTime', 'kWh') or ('interval_start', 'interval_kWh').")
    
    # Keep only the essential columns to prevent errors in aggregation functions
    df = df[['DateTime', 'kWh']]
    
    # Ensure correct data types, using format='mixed' to handle multiple date formats efficiently
    df['DateTime'] = pd.to_datetime(df['DateTime'], format='mixed')
    df['kWh'] = pd.to_numeric(df['kWh'])
    df.dropna(inplace=True)
    df.sort_values('DateTime', inplace=True)
    
    # Calculate summary statistics
    summary_details = calculate_summary_details(df, file_format) if not df.empty else {}
    
    peak_hourly_load_kW = get_peak_hourly_load(df.copy()) # Pass a copy to avoid side effects
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

    summary_results = {
        'peak_hourly_load_kW': peak_hourly_load_kW,
        'peak_power_A': peak_power_A,
        'remaining_panel_capacity_kW': remaining_panel_capacity_kW,
        'remaining_panel_capacity_A': remaining_panel_capacity_A,
    }

    detailed_results = {
        'df_hourly': df_hourly,
        'summary_details': summary_details,
    }

    return (detailed_results, summary_results)