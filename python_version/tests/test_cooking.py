import unittest

import pandas as pd

from hea_nec.methods import _apply_nec_cooking_aggregation

class TestNECCookingLogic(unittest.TestCase):
    """
    Unit test for the _apply_nec_cooking_aggregation logic
    """

    def setUp(self):
        self.base_df = pd.DataFrame(
            columns=[
                "generic_device",
                "type_lower",
                "load_count",
                "load_nameplate_power",
                "nec_watts",
                "fuel_type",
            ]
        )

    def run_calc(self, df):
        df["type_lower"] = df["generic_device"].str.lower()
        if "fuel_type" not in df.columns:
            df["fuel_type"] = "electric"
        _apply_nec_cooking_aggregation(df)
        return df["nec_watts"].sum()

    def test_col_c_note2_unequal_ratings(self):
        """Test Note 2: Unequal ratings (10kW treated as 12kW)."""
        df = pd.DataFrame(
            [
                {
                    "generic_device": "range",
                    "load_count": 1,
                    "load_nameplate_power": 10000,
                },
                {
                    "generic_device": "range",
                    "load_count": 1,
                    "load_nameplate_power": 16000,
                },
            ]
        )
        result = self.run_calc(df)
        # Avg (12+16)/2 = 14. Excess 2. Base 11. 11 * 1.10 = 12.1 kW
        # FIX 3: Use assertAlmostEqual for float precision
        self.assertAlmostEqual(result, 12100, places=1)

    def test_major_fraction_rounding(self):
        """Test 'Major Fraction' rounding (0.5 rounds UP)."""
        df = pd.DataFrame(
            [
                {
                    "generic_device": "range",
                    "load_count": 1,
                    "load_nameplate_power": 12000,
                },
                {
                    "generic_device": "range",
                    "load_count": 1,
                    "load_nameplate_power": 13000,
                },
            ]
        )
        result = self.run_calc(df)
        # Avg 12.5. Excess 0.5 -> Rounds to 1. Base 11. 11 * 1.05 = 11.55 kW
        self.assertAlmostEqual(result, 11550, places=1)

    def test_mixed_columns_sum(self):
        """Test Note 3 with 'cooktop' keyword."""
        df = pd.DataFrame(
            [
                {
                    "generic_device": "cooktop",
                    "load_count": 1,
                    "load_nameplate_power": 3000,
                },
                {
                    "generic_device": "oven",
                    "load_count": 1,
                    "load_nameplate_power": 6000,
                },
            ]
        )
        result = self.run_calc(df)
        # Col A (3000*0.8=2400) + Col B (6000*0.8=4800) = 7200
        self.assertAlmostEqual(result, 7200, places=1)

    # ... (Include other passing tests from previous step here) ...
    def test_small_appliance_exclusion(self):
        df = pd.DataFrame(
            [
                {
                    "generic_device": "cooking",
                    "load_count": 1,
                    "load_nameplate_power": 1000,
                }
            ]
        )
        self.assertEqual(self.run_calc(df), 1000)

    def test_col_c_single_range_standard(self):
        df = pd.DataFrame(
            [
                {
                    "generic_device": "range",
                    "load_count": 1,
                    "load_nameplate_power": 10000,
                }
            ]
        )
        self.assertEqual(self.run_calc(df), 8000)
