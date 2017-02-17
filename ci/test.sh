#!/bin/sh

set -e # fail fast
set -x # print commands

npm install
npm test

# npm run integration-test # !requires java