#!/bin/bash

PYTHONPATH=src pytest -v -s tests/test_cooking.py
PYTHONPATH=src pytest -v -s tests/test_solutions.py
PYTHONPATH=src pytest -v -s tests/test_gaps.py
