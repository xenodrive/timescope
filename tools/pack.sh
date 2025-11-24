#!/bin/sh
ROOT=$(realpath $(dirname "$0")/..)
mkdir -p "${ROOT}/dist"
cd "${ROOT}/dist"

for d in */; do
	(cd $d && npm pack --pack-destination "${ROOT}/dist")
done
