import unittest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pytz import timezone
from unittest.mock import patch

from hea_nec.methods import detect_data_gaps

# Assuming your function is in a module called 'gap_detector'
# from gap_detector import detect_data_gaps

class TestDetectDataGaps(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        # Create a simple test dataframe with no gaps
        self.df_no_gaps = pd.DataFrame({
            'DateTime': [
                '2023-01-01 00:00:00',
                '2023-01-01 01:00:00',
                '2023-01-01 02:00:00',
                '2023-01-01 03:00:00'
            ],
            'value': [1, 2, 3, 4]
        })
        
        # Create a test dataframe with a 2-hour gap
        self.df_with_gap = pd.DataFrame({
            'DateTime': [
                '2023-01-01 00:00:00',
                '2023-01-01 01:00:00',
                '2023-01-01 04:00:00',  # Missing 2 hours (02:00 - 03:00)
                '2023-01-01 05:00:00'
            ],
            'value': [1, 2, 5, 6]
        })
        
        # Create a test dataframe with multiple gaps
        self.df_multiple_gaps = pd.DataFrame({
            'DateTime': [
                '2023-01-01 00:00:00',
                '2023-01-01 01:00:00',
                '2023-01-01 05:00:00',  # Missing 4 hours
                '2023-01-01 08:00:00',  # Missing 3 hours
                '2023-01-01 09:00:00'
            ],
            'value': [1, 2, 5, 8, 9]
        })
    
    def test_no_gaps_returns_empty_dataframe(self):
        """Test that no gaps returns empty DataFrame."""
        result = detect_data_gaps(self.df_no_gaps)
        self.assertTrue(result.empty)
        self.assertEqual(len(result), 0)
    
    def test_single_gap_detected(self):
        """Test detection of a single gap."""
        result = detect_data_gaps(self.df_with_gap)
        self.assertFalse(result.empty)
        self.assertEqual(len(result), 1)
        
        gap = result.iloc[0]
        self.assertEqual(gap['gap_start'], pd.Timestamp('2023-01-01 02:00:00', tz='America/Los_Angeles'))
        self.assertEqual(gap['gap_end'], pd.Timestamp('2023-01-01 04:00:00', tz='America/Los_Angeles'))
        self.assertEqual(gap['duration'], pd.Timedelta(hours=2))
        self.assertEqual(gap['missing_intervals'], 2)
    
    def test_multiple_gaps_detected(self):
        """Test detection of multiple gaps."""
        result = detect_data_gaps(self.df_multiple_gaps)
        self.assertFalse(result.empty)
        self.assertEqual(len(result), 2)
        
        # First gap: 4 hours (02:00 - 05:00)
        gap1 = result.iloc[0]
        self.assertEqual(gap1['gap_start'], pd.Timestamp('2023-01-01 02:00:00', tz='America/Los_Angeles'))
        self.assertEqual(gap1['gap_end'], pd.Timestamp('2023-01-01 05:00:00', tz='America/Los_Angeles'))
        self.assertEqual(gap1['duration'], pd.Timedelta(hours=3))
        self.assertEqual(gap1['missing_intervals'], 3)
        
        # Second gap: 3 hours (06:00 - 08:00)
        gap2 = result.iloc[1]
        self.assertEqual(gap2['gap_start'], pd.Timestamp('2023-01-01 06:00:00', tz='America/Los_Angeles'))
        self.assertEqual(gap2['gap_end'], pd.Timestamp('2023-01-01 08:00:00', tz='America/Los_Angeles'))
        self.assertEqual(gap2['duration'], pd.Timedelta(hours=2))
        self.assertEqual(gap2['missing_intervals'], 2)
    
    def test_single_row_returns_empty(self):
        """Test that single row returns empty DataFrame."""
        df_single = pd.DataFrame({
            'DateTime': ['2023-01-01 00:00:00'],
            'value': [1]
        })
        result = detect_data_gaps(df_single)
        self.assertTrue(result.empty)
    
    def test_empty_dataframe_returns_empty(self):
        """Test that empty DataFrame returns empty result."""
        df_empty = pd.DataFrame({'DateTime': [], 'value': []})
        result = detect_data_gaps(df_empty)
        self.assertTrue(result.empty)
    
    def test_gap_with_different_timezone(self):
        """Test gap detection with different timezone."""
        # Create dataframe with timezone-naive timestamps
        df_tz_naive = pd.DataFrame({
            'DateTime': [
                '2023-01-01 00:00:00',
                '2023-01-01 01:00:00',
                '2023-01-01 04:00:00'  # 2-hour gap
            ],
            'value': [1, 2, 5]
        })
        
        result = detect_data_gaps(df_tz_naive, tz='America/New_York')
        self.assertFalse(result.empty)
        self.assertEqual(len(result), 1)
    
    def test_gap_with_15min_intervals(self):
        """Test gap detection with 15-minute intervals."""
        df_15min = pd.DataFrame({
            'DateTime': [
                '2023-01-01 00:00:00',
                '2023-01-01 00:15:00',
                '2023-01-01 00:30:00',
                '2023-01-01 01:00:00'  # 15 min gap (missing 00:45)
            ],
            'value': [1, 2, 3, 4]
        })
        
        result = detect_data_gaps(df_15min)
        self.assertFalse(result.empty)
        self.assertEqual(len(result), 1)
        self.assertEqual(result.iloc[0]['missing_intervals'], 1)
    
    @patch('pytz.timezone')
    def test_dst_transition_handling(self, mock_timezone):
        """Test DST transition handling."""
        # Mock timezone to simulate DST transition
        mock_tz = timezone('America/Los_Angeles')
        mock_timezone.return_value = mock_tz
        
        # Create data with DST transition
        df_dst = pd.DataFrame({
            'DateTime': [
                '2023-11-05 00:00:00',
                '2023-11-05 01:00:00',
                '2023-11-05 01:30:00',  # Ambiguous time due to DST
                '2023-11-05 02:00:00'
            ],
            'value': [1, 2, 3, 4]
        })
        
        # Should not raise error and should handle DST properly
        result = detect_data_gaps(df_dst)
        # The exact behavior depends on your DST handling logic
    
    def test_gap_start_end_correctness(self):
        """Test that gap_start and gap_end are calculated correctly."""
        df = pd.DataFrame({
            'DateTime': [
                '2023-01-01 00:00:00',
                '2023-01-01 01:00:00',
                '2023-01-01 03:00:00'  # 2-hour gap
            ],
            'value': [1, 2, 3]
        })
        
        result = detect_data_gaps(df)
        self.assertFalse(result.empty)
        
        # Check that gap_start is calculated correctly
        # If last point was 01:00 and expected interval is 1 hour,
        # gap_start should be 02:00
        gap_start_expected = pd.Timestamp('2023-01-01 02:00:00', tz='America/Los_Angeles')
        self.assertEqual(result.iloc[0]['gap_start'], gap_start_expected)
    
    def test_gap_with_timezone_aware_input(self):
        """Test with timezone-aware input."""
        # Create timezone-aware timestamps
        tz = 'America/Los_Angeles'
        df_tz_aware = pd.DataFrame({
            'DateTime': [
                '2023-01-01 00:00:00',
                '2023-01-01 01:00:00',
                '2023-01-01 04:00:00'  # 2-hour gap
            ]
        })
        
        # Localize to timezone
        df_tz_aware['DateTime'] = pd.to_datetime(df_tz_aware['DateTime'])
        df_tz_aware['DateTime'] = df_tz_aware['DateTime'].dt.tz_localize(tz, ambiguous=False, nonexistent='shift_forward')
        
        result = detect_data_gaps(df_tz_aware, tz=tz)
        self.assertFalse(result.empty)
        self.assertEqual(len(result), 1)

if __name__ == '__main__':
    unittest.main()