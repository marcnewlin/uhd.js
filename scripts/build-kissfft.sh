#!/bin/bash

cd external/kissfft
rm -rf build
mkdir -p build
cd build

emcmake cmake -DKISSFFT_TOOLS=OFF -DKISSFFT_TEST=OFF -DKISSFFT_INSTALL=OFF ../

make