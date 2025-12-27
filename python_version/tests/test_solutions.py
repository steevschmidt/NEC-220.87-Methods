import unittest
import pandas as pd
import numpy as np
from typing import Dict, Any

from hea_nec.methods import calculate_nec_compliance_for_solutions

class TestNEC22087ExampleSolutions(unittest.TestCase):

    def setUp(self):
        # Site Specs: 200A Panel at 240V = 48kW capacity
        self.site_specs = {
            1: {"panel_size_A": 200, "panel_voltage_V": 240},
            2: {"panel_size_A": 100, "panel_voltage_V": 240}  # Smaller panel for failure tests
        }

        # create common column structure for solutions dataframe
        self.cols = [
            "site_id", "equipment_combo_id", "load_control_combo_id",
            "appliance_id", "load_status", "generic_device",
            "specific_device", "load_nameplate_power", "load_count",
            "load_control_type", "load_control_group", "fuel_type"
        ]

    def create_dummy_meter_data(self, peak_kw_value: float) -> pd.DataFrame:
        """
        Creates a dummy 24-hour meter reading DataFrame that results
        in a specific peak hourly load when processed by get_peak_hourly_load.

        Using 1-hour intervals to keep it simple.
        get_peak_hourly_load logic:
        - Groups by hour.
        - If unique readings == 1 (which it is here), it multiplies by 1.3 safety factor (NEC 220.87).
        - To get a clean output of X kW, we need to input X / 1.3
        """
        # Note: get_peak_hourly_load applies a 1.3 multiplier to single readings.
        # To make the math easy for assertions (e.g. we want exactly 10kW peak),
        # we adjust the input kWh.
        adjusted_kwh = peak_kw_value / 1.3

        dates = pd.date_range(start='2023-01-01', periods=24, freq='h')
        df = pd.DataFrame({
            'DateTime': dates,
            'kWh': [adjusted_kwh] * 24
        })
        return df

    def test_scenario_A_appliance_rules(self):
        """
        Adapts Scenario A: Tests basic NEC appliance rules (EV 125%, Dryer 5000W min).
        Existing load: 10kW (Calculated via 220.87 as 10 * 1.25 = 12.5kW)
        """
        # Setup Meter Data: 10kW peak
        # NEC 220.87 existing demand will be 10kW * 1.25 = 12.5 kW
        meter_data = {1: self.create_dummy_meter_data(peak_kw_value=10.0)}

        # Define Loads
        # 1. Electric Dryer: Nameplate 4500. Rule: Max(4500, 5000) -> 5000W
        # 2. EVSE: Nameplate 7200. Rule: 7200 * 1.25 -> 9000W
        # 3. Standard AC: 1500. Rule: 1500W

        data = [
            [1, 101, 1, 'DRYER-B', 'new', 'clothes dryer', 'Electric Dryer', 4500, 1, np.nan, np.nan, 'electric'],
            [1, 101, 1, 'EVSE-A', 'new', 'evse', 'Level 2 EVSE', 7200, 1, np.nan, np.nan, 'electric'],
            [1, 101, 1, 'AC-B', 'new', 'cooling', 'Window AC', 1500, 1, np.nan, np.nan, 'electric']
        ]
        df_sol = pd.DataFrame(data, columns=self.cols)

        # Run Calculation
        result = calculate_nec_compliance_for_solutions(
            df_sol, meter_data, self.site_specs, code_edition="2023"
        )

        # Assertions
        # Existing Demand: 10kW peak * 1.25 = 12.5 kW
        # Added Load: 5000 (Dryer) + 9000 (EV) + 1500 (AC) = 15500 W = 15.5 kW
        # Total Demand: 12.5 + 15.5 = 28.0 kW
        # Total Amps: 28000 / 240 = 116.67 A

        row = result.iloc[0]
        self.assertAlmostEqual(row['historical_peak_kw'], 10.0, places=1)
        self.assertAlmostEqual(row['added_load_kw'], 15.5, places=1)
        self.assertAlmostEqual(row['total_demand_amps'], 116.66, places=1)
        self.assertEqual(row['status'], 'PASS') # 116A < 200A

    def test_scenario_B_circuit_sharing(self):
        """
        Adapts Scenario B: Circuit Sharing.
        Stove (7000W) vs Water Heater (4500W).
        Should pick the larger load (Stove) and zero out the WH.
        """
        meter_data = {1: self.create_dummy_meter_data(peak_kw_value=5.0)}

        data = [
            [1, 101, 1, 'STOVE-B', 'new', 'cooking', 'Induction Stove', 7000, 1, 'circuit_sharing', 'KitchenPower', 'electric'],
            [1, 101, 1, 'WH-B', 'new', 'water_heating', 'HP Water Heater', 4500, 1, 'circuit_sharing', 'KitchenPower', 'electric']
        ]
        df_sol = pd.DataFrame(data, columns=self.cols)

        result = calculate_nec_compliance_for_solutions(
            df_sol, meter_data, self.site_specs, code_edition="2023"
        )

        # Assertions
        # Added Load should be max(7000, 4500) = 7000 W = 7.0 kW
        row = result.iloc[0]
        self.assertAlmostEqual(row['added_load_kw'], 7.0, places=2)

    def test_scenario_C_circuit_pausing(self):
        """
        Adapts Scenario C: Circuit Pausing.
        EVSE (7200W) is paused.
        Load should be 0.
        """
        meter_data = {1: self.create_dummy_meter_data(peak_kw_value=5.0)}

        data = [
             [1, 101, 1, 'EVSE-A', 'new', 'evse', 'Level 2 EVSE', 7200, 1, 'circuit_pausing', 'EVGroup', 'electric']
        ]
        df_sol = pd.DataFrame(data, columns=self.cols)

        result = calculate_nec_compliance_for_solutions(
            df_sol, meter_data, self.site_specs, code_edition="2023"
        )

        row = result.iloc[0]
        self.assertEqual(row['added_load_kw'], 0.0)

    def test_nec_2026_removed_load_credit(self):
        """
        Tests NEC 2026 Draft Logic:
        Formula: (Peak - Removed_Calculated) * 1.25 + New_Calculated
        """
        # Peak: 10 kW
        meter_data = {1: self.create_dummy_meter_data(peak_kw_value=10.0)}

        # Removing a 4000W generic load
        # Adding a 2000W generic load
        data = [
            [1, 101, 1, 'OldHeater', 'removed', 'heating', 'Resistance', 4000, 1, np.nan, np.nan, 'electric'],
            [1, 101, 1, 'NewPump', 'new', 'heating', 'HeatPump', 2000, 1, np.nan, np.nan, 'electric']
        ]
        df_sol = pd.DataFrame(data, columns=self.cols)

        result = calculate_nec_compliance_for_solutions(
            df_sol, meter_data, self.site_specs, code_edition="2026"
        )

        row = result.iloc[0]

        # Logic Check:
        # Removed KW = 4.0
        # Adjusted Peak = 10.0 - 4.0 = 6.0 kW
        # Existing Demand = 6.0 * 1.25 = 7.5 kW
        # New Load = 2.0 kW
        # Total Demand = 7.5 + 2.0 = 9.5 kW

        self.assertAlmostEqual(row['removed_load_credit_kw'], 4.0, places=2)
        self.assertAlmostEqual(row['added_load_kw'], 2.0, places=2)

        expected_amps = (9.5 * 1000) / 240
        self.assertAlmostEqual(row['total_demand_amps'], expected_amps, places=1)

    def test_nec_2023_no_removal_credit(self):
        """
        Verifies that NEC 2023 does NOT credit removed loads against the peak.
        Formula: Peak * 1.25 + New_Calculated
        """
        meter_data = {1: self.create_dummy_meter_data(peak_kw_value=10.0)}

        # Same data as above: Remove 4000, Add 2000
        data = [
            [1, 101, 1, 'OldHeater', 'removed', 'heating', 'Resistance', 4000, 1, np.nan, np.nan, 'electric'],
            [1, 101, 1, 'NewPump', 'new', 'heating', 'HeatPump', 2000, 1, np.nan, np.nan, 'electric']
        ]
        df_sol = pd.DataFrame(data, columns=self.cols)

        result = calculate_nec_compliance_for_solutions(
            df_sol, meter_data, self.site_specs, code_edition="2023"
        )

        row = result.iloc[0]

        # Logic Check 2023:
        # Existing Demand = 10.0 * 1.25 = 12.5 kW (Removal ignored)
        # New Load = 2.0 kW
        # Total = 14.5 kW

        # Verify removed_load_watts is calculated but not applied to total
        self.assertEqual(row['removed_load_credit_kw'], 0.0) # In 2023 mode, function returns 0 for removed

        expected_amps = (14.5 * 1000) / 240
        self.assertAlmostEqual(row['total_demand_amps'], expected_amps, places=1)

    def test_capacity_fail_condition(self):
        """
        Tests that the status is correctly marked as FAIL if demand exceeds panel size.
        """
        # Site 2 is 100A (24kW)
        meter_data = {2: self.create_dummy_meter_data(peak_kw_value=15.0)} # 15kW peak

        # Existing Demand: 15 * 1.25 = 18.75 kW
        # Remaining: 24 - 18.75 = 5.25 kW

        # Try to add a 7kW Stove (exceeds remaining)
        data = [
            [2, 201, 1, 'STOVE', 'new', 'cooking', 'Stove', 7000, 1, np.nan, np.nan, 'electric']
        ]
        df_sol = pd.DataFrame(data, columns=self.cols)

        result = calculate_nec_compliance_for_solutions(
            df_sol, meter_data, self.site_specs, code_edition="2023"
        )

        row = result.iloc[0]

        # total_kw = 18.75 + 7.0 # 25.75 kW
        total_amps = (25.75 * 1000) / 240 # ~107A

        self.assertGreater(total_amps, 100)
        self.assertEqual(row['status'], 'FAIL')

    def test_batch_processing_multiple_solutions(self):
        """
        Tests processing multiple solutions/sites in one dataframe.
        """
        meter_data = {
            1: self.create_dummy_meter_data(10.0),
            2: self.create_dummy_meter_data(10.0)
        }

        # Solution 1: Site 1, Add 1000W
        # Solution 2: Site 2, Add 5000W
        data = [
            [1, 1, 1, 'App1', 'new', 'other', 'dev1', 1000, 1, np.nan, np.nan, 'electric'],
            [2, 1, 1, 'App2', 'new', 'other', 'dev2', 5000, 1, np.nan, np.nan, 'electric']
        ]
        df_sol = pd.DataFrame(data, columns=self.cols)

        result = calculate_nec_compliance_for_solutions(
            df_sol, meter_data, self.site_specs
        )

        self.assertEqual(len(result), 2)
        # Check Site 1 Result
        res1 = result[(result['site_id'] == 1)]
        self.assertAlmostEqual(res1['added_load_kw'].iloc[0], 1.0)

        # Check Site 2 Result
        res2 = result[(result['site_id'] == 2)]
        self.assertAlmostEqual(res2['added_load_kw'].iloc[0], 5.0)

if __name__ == '__main__':
    unittest.main(argv=['first-arg-is-ignored'], exit=False)