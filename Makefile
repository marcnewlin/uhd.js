FLAGS=-pthread \
			-s EXTRA_EXPORTED_RUNTIME_METHODS=["writeArrayToMemory","stringToUTF8","UTF8ToString","getValue","FS"] \
			-s EXPORTED_FUNCTIONS=["_start_b2xx_receiver","_row_offset","_rgba_buffer","_main","_print_exception","_calloc","_free","_handle_completed_transfer","_process_completed_transfer"] \
			-s ASYNCIFY_IMPORTS=["libusb_init","libusb_set_option","libusb_get_device_list","libusb_free_device_list","libusb_get_device_descriptor","libusb_open","libusb_close","libusb_claim_interface","libusb_release_interface","libusb_get_string_descriptor_ascii","libusb_control_transfer","libusb_alloc_transfer","libusb_submit_transfer","libusb_bulk_transfer"] \
			-s USE_PTHREADS=1 \
			-s FORCE_FILESYSTEM=1 \
			-s ASYNCIFY=1 \
			-s INITIAL_MEMORY=128MB \
			-I/usr/include/libusb-1.0 \
			-Wno-return-type \
			--pre-js=src/libusb/common.js \
			--post-js=src/libusb/usb-rpc-hook.js \
			--js-library=src/libusb/api.js \
			-s ERROR_ON_UNDEFINED_SYMBOLS=1 \
			-s PROXY_TO_PTHREAD=1 \
			-s PTHREAD_POOL_SIZE=10

PROJECT_ROOT=$(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))

LIBS=$(PROJECT_ROOT)/external/uhd/host/build/lib/libuhd.a \
		 $(PROJECT_ROOT)/external/uhd/host/build/lib/rc/libuhd-resources.a \
		 $(PROJECT_ROOT)/external/boost/stage/lib/libboost_filesystem.bc \
		 $(PROJECT_ROOT)/external/boost/stage/lib/libboost_chrono.bc \
		 $(PROJECT_ROOT)/external/boost/stage/lib/libboost_thread.bc \
		 $(PROJECT_ROOT)/external/kissfft/build/libkissfft-float.a

INCLUDE=-I$(PROJECT_ROOT)/external/uhd/host/include \
				-I$(PROJECT_ROOT)/external/uhd/host/build/include \
				-I$(PROJECT_ROOT)/external/boost \
				-I$(PROJECT_ROOT)/external/kissfft

SRC=src/main.cpp \
		src/b2xx-receiver.cpp \
		src/libusb/helpers.cpp

.PHONY: client

default: release

clean:
	rm -rf build

client:
	mkdir -p build
	mkdir -p build/images
	mkdir -p build/libusb
	cp src/client/* build/
	cp src/libusb/rpc-worker.js build/libusb/
	cp src/libusb/common.js build/libusb/
	cp $(PROJECT_ROOT)/uhd-images/dist/* build/images/

release: client
	em++ $(FLAGS) -O3 -o build/main.js $(SRC) $(LIBS) $(INCLUDE)

debug: client
	em++ $(FLAGS) -O3 -g -s ASSERTIONS=1 -s DISABLE_EXCEPTION_CATCHING=0 -o build/main.js $(SRC) $(LIBS) $(INCLUDE)
