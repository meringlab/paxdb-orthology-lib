#!/bin/bash
# A simple script to copy dataset ids from the previous version.
# Requires that all filenames match
#
V4=../v4.0/final

for d in `ls *txt`
do
    i=$(head -1 $V4/$d | cut -d ' ' -f 2)
    echo sed -i "1s/.*/#id: $i/" "$d"
done
