#!/bin/sh
cd "`dirname $0`"/..
DISTDIR=../../dist/@timescope--svelte/
svelte-package -o "${DISTDIR}"
node ./scripts/build.ts
