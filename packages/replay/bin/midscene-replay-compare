#!/bin/bash
convert '(' $1 -flatten -grayscale Rec709Luminance ')' \
        '(' $2 -flatten -grayscale Rec709Luminance ')' \
        '(' -clone 0-1 -compose darken -composite ')' \
        -channel RGB -combine $3
