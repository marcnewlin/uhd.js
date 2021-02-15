# uhd.js

WebAssembly and WebUSB build of UHD 4.0, with a multithreading-friendly shim of the libusb async C-API in Javascript, in order to compile UHD and Boost to WebAssembly with mostly unmodified.

The demo initialzes an Ettus USRP B200/205/210 and streams IQ data to a waterfall plot, all within a Chrome browser-tab.

Live Demo: 

https://marcnewlin.github.io/uhd.js/

![Screenshot](/screenshot.png?raw=true)

# Build

## Prerequisites

- [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) installed and on your $PATH
- Google Chrome-based Web Browser (Chrome/Edge/Opera)
- If on Windows, follow [these instructions](https://docs.microsoft.com/en-us/windows-hardware/drivers/usbcon/winusb-installation#installing-winusb-by-specifying-the-system-provided-device-class) to assign the `WinUSB.sys` driver to the USRP
- Ettus USRP B200/205/210

## Clone

```
git clone https://github.com/marcnewlin/uhd.js.git

cd uhd.js

git submodule update --init --recursive
```

## Build

The build scripts have been tested on Ubuntu 20.04, and may not work in other environments.

Boost 1.74.0

```
./scripts/build-boost.sh
```

UHD 4.0

```
./scripts/build-uhd.sh
```

KissFFT

```
./scripts/build-kissfft.sh
```

UHD FPGA/FW Images

```
./scripts/download-uhd-images.sh
```

libusb shim and demo application

```
make
```



## Run the B2xx Waterfall Demo

Start a web server as shown below below, and browse to [http://127.0.0.1:8000](http://127.0.0.1:8000).

```
cd build

python3 -m http.server
```

