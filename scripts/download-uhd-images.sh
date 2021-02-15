#!/bin/bash

# download the images
mkdir -p uhd-images
python3 external/uhd/host/build/utils/uhd_images_downloader.py -i uhd-images/

# select the b2xx fpga and firmware images
mkdir -p uhd-images/dist/
cp uhd-images/usrp_b2*_fpga.bin uhd-images/dist/
cp uhd-images/usrp_b2*_fw.hex uhd-images/dist/
