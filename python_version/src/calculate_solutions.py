#!/usr/bin/env python

"""
Example batch script for running the NEC 220.87 Panel Capacity Calculator.

This script evaluates NEC compliance for multiple sites and multiple load solutions.
It demonstrates the invocation of the calculate_nec_compliance_for_solutions subroutine.

It requires two input CSV files:
1. A 'Sites' CSV defining the site ID, panel specs, and path to the meter data file.
2. A 'Solutions' CSV defining the appliances and load controls to add/remove.

Usage:
    python calculate_solutions.py --sites sites_config.csv --solutions solutions.csv --edition 2023

See hea_nec/methods.py for more details.
"""

import argparse
import os
import sys

from hea_nec.methods import calculate_nec_compliance_for_solutions
import pandas as pd


def load_sites_config(config_path):
    """
    Reads the sites CSV and prepares the data structures required by the API.

    Expected CSV columns:
      - site_id (str/int)
      - panel_size_A (int)
      - panel_voltage_V (int) [Optional, default 240]
      - meter_csv_path (str) - Path to the meter data CSV for this site

    Returns:
      tuple: (site_ua_intervals, site_specs)
    """
    if not os.path.exists(config_path):
        print(f"Error: Sites configuration file not found: {config_path}")
        sys.exit(1)

    try:
        df_sites = pd.read_csv(config_path)
        # Ensure site_id is string to prevent type mismatches between files
        df_sites["site_id"] = df_sites["site_id"].astype(str)
    except Exception as e:
        print(f"Error reading sites CSV: {e}")
        sys.exit(1)

    site_ua_intervals = {}
    site_specs = {}

    print(f"Loading meter data for {len(df_sites)} sites...")

    for _, row in df_sites.iterrows():
        site_id = row["site_id"]
        meter_path = row["meter_csv_path"]

        # 1. Load Panel Specs
        site_specs[site_id] = {
            "panel_size_A": float(row["panel_size_A"]),
            "panel_voltage_V": float(row.get("panel_voltage_V", 240)),
        }

        # 2. Load Meter Data
        if not os.path.exists(meter_path):
            print(
                f"  [WARNING] Meter file not found for Site {site_id}: {meter_path}. Skipping."
            )
            continue

        try:
            # We just read the CSV here; _prepare_ua_intervals will handle parsing
            meter_df = pd.read_csv(meter_path)
            site_ua_intervals[site_id] = meter_df
        except Exception as e:
            print(f"  [ERROR] Failed to read meter CSV for Site {site_id}: {e}")

    return site_ua_intervals, site_specs


def main():
    parser = argparse.ArgumentParser(
        description="Batch process NEC 220.87 Compliance Solutions."
    )

    parser.add_argument(
        "--sites",
        required=True,
        help="Path to CSV file defining sites. Must contain: site_id, panel_size_A, meter_csv_path",
    )

    parser.add_argument(
        "--solutions",
        required=True,
        help="Path to CSV file defining solutions/appliances.",
    )

    parser.add_argument(
        "--edition",
        choices=["2023", "2026"],
        default="2023",
        help="NEC Code Edition to use (default: 2023).",
    )

    parser.add_argument(
        "--hourly-safety-factor",
        required=False,
        type=float,
        default=1.3,
        help="Optional safety factor to apply for single-hour meter values in peak load calculation (default: 1.3).",
    )

    parser.add_argument(
        "--output", help="Optional path to save results as CSV (e.g., results.csv)."
    )

    args = parser.parse_args()

    # 1. Load Site Configuration and Meter Data
    site_ua_intervals, site_specs = load_sites_config(args.sites)

    if not site_ua_intervals:
        print("No valid site data loaded. Exiting.")
        sys.exit(1)

    # 2. Load Solutions Data
    if not os.path.exists(args.solutions):
        print(f"Error: Solutions file not found: {args.solutions}")
        sys.exit(1)

    try:
        solutions_df = pd.read_csv(args.solutions, dtype={"fuel_type": str})
        # Ensure site_id is string to match the sites config
        solutions_df["site_id"] = solutions_df["site_id"].astype(str)
    except Exception as e:
        print(f"Error reading solutions CSV: {e}")
        sys.exit(1)

    print(
        f"Processing compliance using NEC {args.edition}..."
    )

    # 3. Run Calculation
    try:
        results_df = calculate_nec_compliance_for_solutions(
            solutions_df=solutions_df,
            site_ua_intervals=site_ua_intervals,
            site_specs=site_specs,
            code_edition=args.edition,
            hourly_safety_factor=args.hourly_safety_factor,
        )
    except Exception as e:
        print(f"Critical error during calculation: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)

    # 4. Display/Save Results
    print("\n--- RESULTS ---")

    # Select a subset of columns for cleaner terminal output
    display_cols = [
        "site_id",
        "equipment_combo_id",
        "load_control_combo_id",
        "status",
        "historical_peak_kw",
        "added_load_kw",
        "total_demand_amps",
    ]
    # Add removed_load_credit_kw only if relevant (2026 or non-zero exists)
    if "removed_load_credit_kw" in results_df.columns and (
        results_df["removed_load_credit_kw"].sum() > 0 or args.edition == "2026"
    ):
        display_cols.insert(4, "removed_load_credit_kw")

    # Filter for columns that actually exist in the result
    final_cols = [c for c in display_cols if c in results_df.columns]

    print(results_df[final_cols].to_string(index=False))

    if args.output:
        results_df.to_csv(args.output, index=False)
        print(f"\nFull results saved to: {args.output}")


if __name__ == "__main__":
    main()
