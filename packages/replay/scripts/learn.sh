#!/bin/bash
clear && rm -rf midscene_run && packages/cli/bin/midscene test2.yaml && mv midscene_run/log/computer-device-action.log ./test2/test2-replay.txt

