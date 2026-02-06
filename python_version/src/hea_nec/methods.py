
"""
NEC 220.87 Panel Capacity Calculator

This module implements the NEC 220.87 method for calculating electrical panel capacity
based on historical meter data (calculate_nec_22087_capacity, get_peak_hourly_load).
Additionally, it supports NEC compliance analysis for adding/removing appliances
and/or load controls (calculate_nec_compliance_for_solutions).

Original methodology developed in Jupyter notebook:
https://github.com/HomeElectricationAlliance/NEC-220.87-Methods/blob/main/2022_HEA_220_87.ipynb

Key features (for panel capacity calculation):
- Processes Panda dataframes containing DateTime and kWh columns
- Handles both 15-minute and hourly interval data
- Implements NEC 220.87 safety factors:
  * 1.25x multiplier for final capacity calculation
  * 1.3x multiplier for single readings
- Provides visual representation of load patterns
- Calculates remaining panel capacity

Interface (for panel capacity calculation):
- Input: CSV file with either DateTime and kWh or interval_start and interval_kWh (UtilityAPI) columns
- Panel specifications: size (amps) and voltage
- Outputs: peak power and remaining capacity in both kW and Amps; hourly load patterns; summary statistics

Key features (for compliance calculation after adding/removing appliances):
- Handles 2023 edition of NEC as well as 2026 draft edition (assuming provided correct appliance-specific Demand Factors)
- Allows batch evaluation for multiple sites, appliance sets and load control combinations ("solutions")

Dependencies:
- pandas: Data processing and analysis
- numpy: Numerical computations

For more information on NEC 220.87, see:
https://up.codes/s/determining-existing-loads.
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple, Any


def _apply_nec_appliance_rules(df: pd.DataFrame, code_edition: str = "2023"):
    """
    Applies NEC specific calculation rules (Dryer floor, EV continuous, Range table)
    to a DataFrame of loads. Modifies 'nec_watts' column in place.

    Note: deprecated in favor of _apply_nec_demand_factors
    """
    # 1. Electric Vehicles: Continuous Load (125% per NEC 625.41 / 210.20(A))
    # Applicable in both 2023 and 2026
    mask_ev = df["type_lower"].str.contains("electric vehicle") | df[
        "type_lower"
    ].str.contains("evse")
    df.loc[mask_ev, "nec_watts"] = df.loc[mask_ev, "nec_watts"] * 1.25

    # 2. Clothes Dryers: Min 5000W rule (NEC 220.54)
    # Applicable in both 2023 and 2026
    mask_dryer = df["type_lower"].str.contains("clothes dryer")
    if "fuel_type" in df.columns:
        mask_gas = df["fuel_type"].str.lower() == "gas"
        mask_dryer = mask_dryer & (~mask_gas)

    if mask_dryer.any():
        for idx in df[mask_dryer].index:
            count = df.loc[idx, "load_count"]
            nameplate = df.loc[idx, "load_nameplate_power"]
            # NEC 220.54 requires 5000W or nameplate, whichever is larger, per dryer.
            # Note: We apply this to the base unit, then multiply by count
            calc_load = max(nameplate, 5000) * count
            df.loc[idx, "nec_watts"] = calc_load

    # 3. Cooking Appliances: Table 220.55
    # ONLY applicable for 2026 (Draft) in the context of 220.87.
    # In 2023 220.87, weuse full nameplate.
    if code_edition == "2026":
        _apply_nec_cooking_aggregation(df)

def _apply_nec_cooking_aggregation(df: pd.DataFrame):
    """
    Applies NEC Table 220.55 aggregation logic (Columns A, B, and C).

    Note: preliminary implementation intended as an example for a possible application
    of the "calculated loads" handling permitted by the NEC 2026 draft. Table 220.55 is
    normally used for capacity planning in new dwellings and not applicable in context
    of 220.87 as per NEC 2023 edition of the code.
    """
    mask_cooking = (
        df["type_lower"].str.contains("cooking")
        | df["type_lower"].str.contains("range")
        | df["type_lower"].str.contains("oven")
        | df["type_lower"].str.contains("cooktop")
    )
    if "fuel_type" in df.columns:
        mask_gas = df["fuel_type"].str.lower() == "gas"
        mask_cooking = mask_cooking & (~mask_gas)

    if not mask_cooking.any():
        return

    unit_ratings = []
    unit_indices = []

    for idx in df[mask_cooking].index:
        count = int(df.loc[idx, "load_count"])
        watts = df.loc[idx, "load_nameplate_power"]

        # NEC 220.55: Only applies to appliances > 1.75 kW
        if watts > 1750:
            unit_ratings.extend([watts] * count)
            unit_indices.extend([idx] * count)
        else:
            # Small appliances use nameplate
            df.loc[idx, "nec_watts"] = watts * count

    if not unit_ratings:
        return

    # Bucket Appliances
    col_a_units = [w for w in unit_ratings if 1750 < w < 3500]
    col_b_units = [w for w in unit_ratings if 3500 <= w <= 8750]
    col_c_units = [w for w in unit_ratings if w > 8750]

    total_nec_watts = 0.0

    # Column A
    count_a = len(col_a_units)
    if count_a > 0:
        if count_a == 1:
            factor = 0.80
        elif count_a == 2:
            factor = 0.75
        elif count_a == 3:
            factor = 0.70
        elif count_a == 4:
            factor = 0.66
        else:
            factor = 0.62
        total_nec_watts += sum(col_a_units) * factor

    # Column B
    count_b = len(col_b_units)
    if count_b > 0:
        if count_b == 1:
            factor = 0.80
        elif count_b == 2:
            factor = 0.65
        elif count_b == 3:
            factor = 0.55
        elif count_b == 4:
            factor = 0.50
        else:
            factor = 0.45
        total_nec_watts += sum(col_b_units) * factor

    # Column C
    count_c = len(col_c_units)
    if count_c > 0:
        if count_c <= 5:
            base_kw = 8 + (3 * (count_c - 1))
        else:
            base_kw = 20 + (3 * (count_c - 5))

        # Note 2: Use 12kW for ranges < 12kW
        floored_ratings_kw = [max(w, 12000) / 1000.0 for w in col_c_units]
        avg_kw = sum(floored_ratings_kw) / count_c

        # Note 1 & 2: Increase 5% for each kW (or major fraction) avg exceeds 12kW
        if avg_kw > 12:
            # 0.5 -> 1.0. Python's round(0.5) is 0.
            excess_kw = int((avg_kw - 12) + 0.5)

            if excess_kw > 0:
                increase_factor = 1 + (0.05 * excess_kw)
                base_kw = base_kw * increase_factor

        total_nec_watts += base_kw * 1000.0

    # Distribute back to rows
    total_raw_watts = sum(unit_ratings)
    if total_raw_watts > 0:
        ratio = total_nec_watts / total_raw_watts
        allocations = {idx: 0.0 for idx in df[mask_cooking].index}

        for i, idx in enumerate(unit_indices):
            raw_w = unit_ratings[i]
            allocations[idx] += raw_w * ratio

        for idx, alloc_watts in allocations.items():
            if df.loc[idx, "load_nameplate_power"] > 1750:
                df.loc[idx, "nec_watts"] = alloc_watts

def _apply_nec_demand_factors(df: pd.DataFrame, demand_factor_column: str):
    """
    Applies NEC specific demand factors to a DataFrame of loads. Modifies 'nec_watts' column in place.
    'demand_factor_nec_22087_2023' or 'demand_factor_nec_12087_2026' column must exist.
    """
    df["nec_watts"] = df["nec_watts"] * df[demand_factor_column]

def _calculate_solution_loads(
    solution_df: pd.DataFrame, code_edition: str = "2023"
) -> pd.Series:
    """
    Calculates added/removed loads by handling interlocks and NEC appliance rules,
    for a single "solution".
    """
    df = solution_df.copy()

    # Ensure generic_device column is lower case for matching
    if "generic_device" not in df.columns:
        df["type_lower"] = ""
    else:
        df["type_lower"] = df["generic_device"].str.lower().fillna("")

    df["load_count"] = df["load_count"].fillna(1)

    # Initialize 'nec_watts' with raw nameplate calculation
    df["nec_watts"] = df["load_nameplate_power"] * df["load_count"]

    # Apply appliance-specific rules first.
    # We calculate the "effective" NEC load for every item before load interlocks.
    if code_edition == "2023":
        demand_factor_column = "demand_factor_nec_22087_2023"
    else:
        demand_factor_column = "demand_factor_nec_12087_2026"

    if demand_factor_column in df.columns:
        _apply_nec_demand_factors(df, demand_factor_column)
    else:
        _apply_nec_appliance_rules(df, code_edition=code_edition)

    # Apply load control (pausing/sharing).
    # Circuit Pausing: force the NEC calculated load to 0.
    if "load_control_type" in df.columns:
        df.loc[df["load_control_type"] == "circuit_pausing", "nec_watts"] = 0

    # Circuit Sharing: compare NEC calculated loads.
    if "load_control_type" in df.columns and "load_control_group" in df.columns:
        sharing_mask = df["load_control_type"] == "circuit_sharing"
        if sharing_mask.any():
            groups = df.loc[sharing_mask, "load_control_group"].dropna().unique()
            for group in groups:
                mask = (df["load_control_type"] == "circuit_sharing") & (
                    df["load_control_group"] == group
                )
                if mask.sum() > 1:
                    # Find the index of the largest NEC Calculated load
                    max_idx = df.loc[mask, "nec_watts"].idxmax()
                    # Set the losers to 0
                    df.loc[mask & (df.index != max_idx), "nec_watts"] = 0

    # Since we already applied the NEC appliance rules, we can simply sum the results now.

    val_added = df.loc[df["load_status"] == "new", "nec_watts"].sum()

    if code_edition == "2026":
        # In 2026, we credit the calculated load of the removed item
        val_removed = df.loc[df["load_status"] == "removed", "nec_watts"].sum()
    else:
        val_removed = 0.0

    return pd.Series({"added_load_watts": val_added, "removed_load_watts": val_removed})

def _calculate_nec_compliance_for_solution(
    load_result,
    site_specs: Dict[Any, Dict[str, float]],
    site_peaks: Dict[Any, float],
    code_edition: str = "2023",
):
    site_id = load_result["site_id"]
    if site_id not in site_peaks:
        return pd.Series({"status": "Error"})

    peak_kw = site_peaks[site_id]
    specs = site_specs[site_id]
    panel_amps = specs["panel_size_A"]
    volts = specs.get("panel_voltage_V", 240)

    added_kw = load_result["added_load_watts"] / 1000.0
    removed_kw = load_result["removed_load_watts"] / 1000.0

    if code_edition == "2026":
        # 2026 Draft Logic: (Peak - Removed_Calculated) * 1.25 + New_Calculated
        adjusted_peak = max(0, peak_kw - removed_kw)
        existing_demand = adjusted_peak * 1.25
    else:
        # 2023 Logic: Peak * 1.25 + New_Calculated
        existing_demand = peak_kw * 1.25

    total_demand_kw = existing_demand + added_kw
    total_amps = (total_demand_kw * 1000) / volts

    return pd.Series(
        {
            "code_edition": code_edition,
            "historical_peak_kw": peak_kw,
            "removed_load_credit_kw": removed_kw,
            "added_load_kw": added_kw,
            "total_demand_amps": total_amps,
            "status": "PASS" if total_amps <= panel_amps else "FAIL",
        }
    )

def _prepare_ua_intervals(ua_intervals_raw: pd.DataFrame) -> pd.DataFrame:
    """
    Handles different input file formats, prepares meter data for processing by get_peak_hourly_load.
    """
    df = ua_intervals_raw.copy()

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

    return (df, file_format)

def get_peak_hourly_load(df: pd.DataFrame, hourly_safety_factor: float = 1.3) -> float:
    """Estimates the peak hourly load in kW from meter values.

    Implementation follows the methodology from the original Jupyter notebook:
    https://github.com/HomeElectricationAlliance/NEC-220.87-Methods/blob/main/2022_HEA_220_87.ipynb

    Key aspects of the calculation:
    - For 15-minute intervals: multiplies by 4 to get hourly equivalent
    - Applies optional safety factor (default: 1.3x) for single readings per NEC 220.87
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
                                      df_hourly['kWh_max'] * df_hourly['period'] * hourly_safety_factor,
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
            "value_kWh": peak_reading_row['kWh'].item(),
        },
        "pattern_analysis": {
            "total_hours_with_single_reading": hours_with_single_reading.item(),
            "total_hours_with_four_unique_readings": hours_with_four_unique_readings.item(),
            "total_hours_with_four_identical_readings": hours_with_four_identical_readings.item(),
        },
    }

def calculate_nec_22087_capacity(
    ua_intervals: pd.DataFrame,
    site_spec: Dict[str, float],
    hourly_safety_factor: float = 1.3) -> Tuple[Dict[str, Any], Dict[str, float]]:
    """Process input DataFrame and parameters to calculate panel capacity and create visualization data.

    Args:
        ua_intervals: Input meter values as pandas DataFrame with columns:
            "DateTime" (measurement interval start, format "YYYY-MM-DD HH:MM:00") or "interval_start" (format "M/DD/YY HH:MM")
            "kWh" (measured meter value in kilowatt-hours) or "interval_kWh"
        site_spec: Dictionary with keys:
            "panel_size_A" (existing panel capacity in A)
            "panel_voltage_V" (optional, default 240V)
        hourly_safety_factor: see get_peak_hourly_load

        Pandas DataFrame with panel specifications. Must contain one row with columns 'panel_size_A' and 'panel_voltage_V'.

    Returns:
        tuple: A tuple of two dicts: (detailed_results, summary_results)
               detailed_results contains {'df_hourly': visualization pd.DataFrame, 'summary_details': additional summary statistics/metadata}
               summary_results contains {'peak_hourly_load_kW', 'peak_power_A',
                                         'remaining_panel_capacity_kW', 'remaining_panel_capacity_A'}

    Raises:
        ValueError: If the DataFrame format is not recognized or the site_table has more than one row.
    """

    panel_size_A = site_spec['panel_size_A']
    panel_voltage_V = site_spec['panel_voltage_V']

    (df, file_format) = _prepare_ua_intervals(ua_intervals)

    # Calculate summary statistics
    summary_details = calculate_summary_details(df, file_format) if not df.empty else {}

    peak_hourly_load_kW = get_peak_hourly_load(df.copy(), hourly_safety_factor=hourly_safety_factor) # Pass a copy to avoid side effects
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

def calculate_nec_compliance_for_solutions(
    solutions_df: pd.DataFrame,
    site_ua_intervals: Dict[Any, pd.DataFrame],
    site_specs: Dict[Any, Dict[str, float]],
    code_edition: str = "2023",
    hourly_safety_factor: float = 1.3
) -> pd.DataFrame:
    """
    1. Calculates the NEC 220.87 compliant observed peak load for each site from the provided site-specific
       electric meter data (site_ua_intervals), using the get_peak_hourly_load method.
    2. For each site, evaluates a set of site-specific "solutions" to determine NEC compliance for each of them.

    A solution describes a set of added/removed appliances along with a particular load control configuration.
    The final compliance is evaluated based on the existing electric panel specification of each site (site_specs),
    with new load calculations performed according to the specified version of NEC (2023 or 2026 draft).

    Args:
        solutions_df: Solutions described as a pandas DataFrame with (at least) the following columns:
            "site_id" (integer id of the site, unique within the DataFrame)
            "equipment_id" (integer id of an appliance (or multiple appliances of the same kind), unique within the site)
            "equipment_combo_id" (integer id of a particular combination of appliances to consider as a "solution",
                unique within the site)
            "load_control_combo_id" (integer id of a particular load control configuration to consider within a "solution",
                unique within the equipment combo)
            "load_control_type" (string, either "circuit_pausing" or "circuit_sharing" or "")
            "load_control_group" (integer, for grouping together multiple appliance under shared load control
                within a load_control_combo_id)
            "load_status" (string, either "new" or "removed" or "existing")
            "generic_device" (string, type of appliance; special treatment for "electric vehicle|evse" or "cooking|oven|range")
            "load_nameplate_power" (integer, wattage of the appliance type identified by equipment_id)
            "load_count" (integer, number of appliances of the same kind)
            "fuel_type" (string, type of fuel for appliance; if no value specified, assumed "electric");
            "demand_factor_nec_22087_2023" (float, optional; if the column exists, the provided specific Demand Factor
                will be used for the appliance in context of NEC 2023 load calculations)
            "demand_factor_nec_12087_2026" (float, optional; if the column exists, the provided specific Demand Factor
                will be used for the appliance in context of NEC 2026 load calculations)

        site_ua_intervals: Input meter values as dictionary mapping each site_id to a pandas DataFrame with columns:
            "DateTime" (measurement interval start, format "YYYY-MM-DD HH:MM:00") or "interval_start" (format "M/DD/YY HH:MM")
            "kWh" (measured meter value in kilowatt-hours) or "interval_kWh"

        site_specs: Dictionary mapping each site_id to its current electric panel specification, with keys:
            "panel_size_A" (existing panel capacity in A)
            "panel_voltage_V" (optional, default 240V)

        code_edition: NEC edition to use in calculatins: "2023" or "2026"
        
        hourly_safety_factor: see get_peak_hourly_load

    Returns:
        a pandas DataFrame containing the evaluation result for each solution with columns:
            "site_id", "equipment_combo_id", "load_control_combo_id": these columns together comprise the solution id
            "added_load_watts": calculated sum of added new loads in W
            "removed_load_watts": calculated sum of removed loads in W
            "code_edition": NEC edition used in calculations
            "historical_peak_kw": observed peak load in kW according to site's meter data
            "total_demand_amps": calculated total demand in A for the solution
            "status": "PASS" if calculated total demand in A for the solution does not exceed site's existing panel capacity,
                "FAIL" otherwise
    """

    if code_edition != "2023" and code_edition != "2026":
        raise ValueError(f"Unsupported NEC edition '{code_edition}'")

    # 1. Calculate measured peak load for each site
    site_peaks = {}
    for site_id, meter_df in site_ua_intervals.items():
        temp_df, _ = _prepare_ua_intervals(meter_df)
        site_peaks[site_id] = get_peak_hourly_load(temp_df, hourly_safety_factor=hourly_safety_factor)

    # 2. Calculate the added/removed loads for each "solution"
    # (defined as a unique combo of site_id, equipment_combo_id and load_control_combo_id)
    group_cols = ["site_id", "equipment_combo_id", "load_control_combo_id"]
    solution_loads = (
        solutions_df.groupby(group_cols)
        .apply(lambda x: _calculate_solution_loads(x, code_edition=code_edition), include_groups=False)
        .reset_index()
    )

    # 3. Check compliance based on measured peak and added loads (and under 2026 rules: also removed loads)
    metrics = solution_loads.apply(
        lambda row: _calculate_nec_compliance_for_solution(
            row,
            site_specs=site_specs,
            site_peaks=site_peaks,
            code_edition=code_edition
        ),
        axis=1
    )
    return pd.concat([solution_loads, metrics], axis=1)
