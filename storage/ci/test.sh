#!/bin/sh

set -e # fail fast
set -x # print commands

pwd
cat /etc/hosts

npm install
npm test
