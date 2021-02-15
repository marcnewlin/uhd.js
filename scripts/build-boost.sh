#!/bin/bash

cd external/boost

git reset --recurse-submodules --hard

patch -p1 ./tools/build/src/tools/emscripten.jam < ../../patches/boost/emscripten.jam.patch
sed -i "s/^generators.register/#generators.register/g" ./tools/build/src/tools/generators/searched-lib-generator.jam

libs=( chrono
       date_time
       filesystem
       program_options
       regex
       system
       serialization
       thread ) 
libs=$(echo ${libs[@]} | sed "s/ /,/g")

./bootstrap.sh --with-libraries=$libs --without-icu

./b2 toolset=emscripten \
     threading=multi \
     link=static \
     runtime-link=shared \
     cflags="-pthread -O3 --ignore-dynamic-linking" \
     cxxflags="-pthread -O3 --ignore-dynamic-linking" \
     define=BOOST_BIND_GLOBAL_PLACEHOLDERS \
     stage

cd stage/lib
for f in *.a; do cp $f $(echo $f | sed "s/\.a/.bc/"); done