#!/bin/bash

cd external/uhd

git reset --hard
patch -p1 < ../../patches/uhd/omit-boost-unit-test-framework.patch
patch -p1 < ../../patches/uhd/retain-static-initializers.patch
patch -p1 < ../../patches/uhd/drop-wordexp-dependency.patch
patch -p1 < ../../patches/uhd/omit-persistent-args.patch
patch -p1 < ../../patches/uhd/build-utils-as-libraries.patch

mkdir -p host/build
cd host/build
cmrc_include_dir="$(pwd)/_cmrc/include"
exports = "-s EXPORTED_FUNCTIONS=[\"_uhd_usrp_make\",\"_uhd_rx_metadata_make\",\"_uhd_rx_streamer_make\",\"_uhd_usrp_set_rx_rate\",\"_uhd_usrp_get_rx_rate\",\"_do_b200_make\"]";
emcmake cmake -DCMAKE_CXX_FLAGS="${1} -pthread ${exports} -O3 --ignore-dynamic-linking -I${cmrc_include_dir}" \
              -DCMAKE_C_FLAGS="-pthread ${exports} -O3 --ignore-dynamic-linking" \
              -DCMAKE_FIND_LIBRARY_SUFFIXES=.a \
              -DLIBUSB_INCLUDE_DIRS=/usr/include/libusb-1.0 \
              -DLIBUSB_LIBRARIES=../../../build/ \
              -DPYTHON_EXECUTABLE=$(which python3) \
              -DBoost_NO_SYSTEM_PATHS=ON \
              -DBoost_INCLUDE_DIR=/home/marc/git/webusb-libusb-shim/external/boost \
              -DBoost_LIBRARY_DIR=/home/marc/git/webusb-libusb-shim/external/boost/stage/lib \
              -DBoost_USE_STATIC_LIBS=OFF \
              -DBoost_USE_STATIC_RUNTIME=OFF \
              -DBoost_USE_MULTITHREADED=ON \
              -DENABLE_C_API=OFF \
              -DENABLE_DOXYGEN=OFF \
              -DENABLE_DOXYGEN_DOT=OFF \
              -DENABLE_DOXYGEN_FULL=OFF \
              -DENABLE_DOXYGEN_SHORTNAMES=OFF \
              -DENABLE_E300=OFF \
              -DENABLE_E320=OFF \
              -DENABLE_EXAMPLES=OFF \
              -DENABLE_LIBUHD=ON \
              -DENABLE_MANUAL=OFF \
              -DENABLE_MAN_PAGES=OFF \
              -DENABLE_MAN_PAGE_COMPRESSION=OFF \
              -DENABLE_MPMD=OFF \
              -DENABLE_N300=OFF \
              -DENABLE_N320=OFF \
              -DENABLE_OCTOCLOCK=OFF \
              -DENABLE_QEMU_UNITTESTS=OFF \
              -DENABLE_STATIC_LIBS=OFF \
              -DENABLE_TESTS=OFF \
              -DENABLE_USRP2=OFF \
              -DENABLE_UTILS=ON \
              -DENABLE_X300=OFF \
              -DENABLE_USRP1=OFF \
              -DENABLE_B100=OFF \
              ../

make -j7
