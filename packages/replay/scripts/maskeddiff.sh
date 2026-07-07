#!/bin/bash
compare -metric AE -fuzz 5%  0013_smoothMoveMouse_actual_masked.png 0013_smoothMoveMouse_expected_masked.png diff.png

