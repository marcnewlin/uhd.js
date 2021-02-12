/*

libusb C-API via Javascript and WebUSB

*/
mergeInto(LibraryManager.library, {

  /*
	int libusb_cancel_transfer(struct libusb_transfer *transfer);
  */
  libusb_cancel_transfer: function(transfer) {   
    
    // fail if the transfer was already cancelled
    let xfer = new libusb_transfer(transfer);
    if(xfer.status == LIBUSB_TRANSFER_CANCELLED || xfer.status == LIBUSB_TRANSFER_COMPLETED) {
      return LIBUSB_ERROR_NOT_FOUND;
    }

    // kick off the cancel request, ignoring the response
    call_rpc(RPC_CANCEL_TRANSFER, { ptr: transfer, ep: xfer.endpoint });

    // cancel the transfer struct and invoke the callback
    xfer.status = LIBUSB_TRANSFER_CANCELLED;
    xfer.save;
    
    // queue up the transfer callback
    Module._handle_completed_transfer(xfer);
    return LIBUSB_SUCCESS;
  },

  /*
	int libusb_clear_halt(libusb_device_handle *dev_handle, unsigned char endpoint);
  */
  libusb_clear_halt: function(dev_handle, endpoint) {
    console.error("libusb_clear_halt");
    throw "not implemented: libusb_clear_halt";
  },
 
  /*
  void libusb_free_transfer(struct libusb_transfer *transfer);
  */
  libusb_free_transfer: function(transfer) {
    Module._free(transfer);
  }, 
  
  /*
  int libusb_reset_device(libusb_device_handle *dev_handle);
  */
  libusb_reset_device: function(dev_handle) {
    throw "not implemented: libusb_reset_device";
  },

  /* 
    
  int libusb_handle_events_timeout(libusb_context *ctx, struct timeval *tv); 
  
  */
  libusb_handle_events_timeout: function(ctx, tv) { 

    let ms = (getValue(tv, "i32") * 1000) + (getValue(tv+4, "i32") / 1000);
    let end = performance.now() + ms;

    while(performance.now() < end) {
      try {
        Module._process_completed_transfer();
      }
      catch {
        break;
      }
    }

    return LIBUSB_SUCCESS;
  },



  /* 
  
  void libusb_unref_device(libusb_device *dev); 
  
  */
  libusb_unref_device: function(dev) { 
    console.warn("libusb_unref_device");

    /* NOP */ 
    return; 
  },



  /* 
  
  void libusb_exit(libusb_context *ctx); 
  
  */
  libusb_exit: function(ctx) { 
    console.warn("libusb_exit");

    /* NOP */ 
    return; 
  },



  /* 
  
  int libusb_init(libusb_context **ctx);
  
  */  
  libusb_init: function(ctx) {
    
    mark_start(arguments.callee.name);

    let ret = Asyncify.handleAsync(async() => {

      // check for WebUSB support
      if(navigator.usb === undefined) {
        return LIBUSB_ERROR_NOT_SUPPORTED;
      }

      // spin up the RPC worker thread
      if(navigator.usb_worker === undefined) {
        console.error("navigator.usb_worker not found in libusb_init @ " + Module._pthread_self());
        throw "navigator.usb_worker not found in libusb_init";
      }
      
      // assign the default context
      setValue(ctx, LIBUSB_DEFAULT_CONTEXT, "i32");

      return LIBUSB_SUCCESS;
    });

    mark_end(arguments.callee.name);
    return ret;
  },



  /*

  int libusb_set_option(libusb_context *ctx, 
                        enum libusb_option option, 
                        ...);

  */
  libusb_set_option: function(ctx, option) {
    mark_start(arguments.callee.name);
    let ret = Asyncify.handleAsync(async() => {

      if(ctx !== LIBUSB_DEFAULT_CONTEXT) { return LIBUSB_ERROR_INVALID_PARAM; }

      switch(option) {
        case LIBUSB_OPTION_LOG_LEVEL:
          console.warn("libusb_set_option: unhandled option LIBUSB_OPTION_LOG_LEVEL");
          return LIBUSB_SUCCESS;
        default:
          console.error("libusb_set_option: unhandled option - %d", option);
          return LIBUSB_ERROR_NOT_SUPPORTED;        
      }
    });

    mark_end(arguments.callee.name);
    return ret;
  },



  /*

  ssize_t libusb_get_device_list(libusb_context *ctx,
                                 libusb_device ***list);
  
  */
  libusb_get_device_list: function(ctx, list) {
    mark_start(arguments.callee.name);
    let ret = Asyncify.handleAsync(async() => {

      if(ctx != LIBUSB_DEFAULT_CONTEXT) return LIBUSB_ERROR_INVALID_PARAM;
      
      // get the device count and allocate handles
      let devices = await navigator.usb.getDevices();
      navigator.usb_device_count = devices.length;
      navigator.usb_device_handles = [];
      for(let i = 0; i < navigator.usb_device_count; i++) {
        navigator.usb_device_handles.push(Module._calloc(PTR_SIZE, 1));
        setValue(navigator.usb_device_handles[i], i, "i32");
      }
    
      // assign the device handles
      await call_rpc(RPC_INIT_SESSION, { handles: navigator.usb_device_handles });

      // allocate and assign the top-level array (with a terminating null entry)
      let l = Module._calloc(PTR_SIZE, (navigator.usb_device_count+1));
      setValue(list, l, "i32");

      // assign the device handles
      for(let i = 0; i < navigator.usb_device_count; i++) {
        setValue(l+(PTR_SIZE*i), navigator.usb_device_handles[i], "i32");
      }

      return navigator.usb_device_count;
    });

    mark_end(arguments.callee.name);
    return ret;    
  },



  /*

  int libusb_get_device_descriptor(libusb_device *dev,
                                   struct libusb_device_descriptor *desc);
  
  */
  libusb_get_device_descriptor: function(dev, desc) {
    mark_start(arguments.callee.name);
    let ret = Asyncify.handleAsync(async() => {

      let data = await call_rpc(RPC_GET_USB_DEVICE_DESCRIPTOR, { dev: dev });
      writeArrayToMemory(data, desc);
      return LIBUSB_SUCCESS;
    });

    mark_end(arguments.callee.name);
    return ret;  
  },



  /*

  void libusb_free_device_list(libusb_device **list,
                               int unref_devices);
  
  */
  libusb_free_device_list: function(list, unref_devices) {
    mark_start(arguments.callee.name);
    let ret = Asyncify.handleAsync(async() => {

      trace_enter("libusb_free_device_list " + list);
      Module._free(list);
    });

    mark_end(arguments.callee.name);
    return ret;
  },



  /*

  int libusb_open(libusb_device *dev, 
                  libusb_device_handle **dev_handle);

  */
  libusb_open: function(dev, dev_handle) {
    mark_start(arguments.callee.name);
    let ret = Asyncify.handleAsync(async() => {

      setValue(dev_handle, dev, "i32");
      return await call_rpc(RPC_OPEN_DEVICE, { dev: dev });
    });

    mark_end(arguments.callee.name);
    return ret;
  },



  /*

  void libusb_close(libusb_device_handle *dev_handle);

  */
  libusb_close: function(dev) {
    mark_start(arguments.callee.name);
    let ret = Asyncify.handleAsync(async() => {

      await call_rpc(RPC_CLOSE_DEVICE, { dev: dev });
    });

    mark_end(arguments.callee.name);
    return ret;
  },



  /*

  int libusb_claim_interface(libusb_device_handle *dev_handle,
                             int interface_number);
  */
  libusb_claim_interface: function(dev_handle, interface_number) {
    mark_start(arguments.callee.name);
    let ret = Asyncify.handleAsync(async() => {
      return await call_rpc(RPC_CLAIM_INTERFACE, { dev_handle: dev_handle, interface_number: interface_number });
    });

    mark_end(arguments.callee.name);
    return ret;
  },



  /*

  int libusb_release_interface(libusb_device_handle *dev_handle,
                               int interface_number);

  */
  libusb_release_interface: function(dev_handle, interface_number) {
    mark_start(arguments.callee.name);
    let ret = Asyncify.handleAsync(async() => {
      return await call_rpc(RPC_RELEASE_INTERFACE, { dev_handle: dev_handle, interface_number: interface_number });
    });
    mark_end(arguments.callee.name);
    return ret;
  },



  /*

  int libusb_get_string_descriptor_ascii(libusb_device_handle *dev_handle,
                                         uint8_t desc_index, 
                                         unsigned char *data, 
                                         int length);
  
  */
  libusb_get_string_descriptor_ascii: function(dev_handle, desc_index, data, length) {
    mark_start(arguments.callee.name);
    let ret = Asyncify.handleAsync(async() => {

      let descriptor = await call_rpc(RPC_GET_STRING_DESCRIPTOR, { 
        dev_handle: dev_handle, 
        desc_index: desc_index 
      });
      
      let len = Math.min(length, descriptor.length+4+1);
      stringToUTF8(descriptor, data, len);

      return len; 
    });

    mark_end(arguments.callee.name);
    return ret;
  },



  /*

  int libusb_control_transfer(libusb_device_handle *dev_handle,
                              uint8_t request_type, 
                              uint8_t bRequest, 
                              uint16_t wValue, 
                              uint16_t wIndex,
                              unsigned char *data, 
                              uint16_t wLength, 
                              unsigned int timeout)

  */
  libusb_control_transfer: function(dev_handle, request_type, bRequest, wValue, wIndex, data, wLength, timeout) {
    
    mark_start(arguments.callee.name);
    let ret = Asyncify.handleAsync(async() => {

      const libusb_request_type = ["standard", "class", "vendor"];
      const libusb_request_recipient = ["device", "interface", "endpoint", "other"];
      
      const setup = {
        requestType: libusb_request_type[((request_type & 0x60) >> 5)],
        recipient: libusb_request_recipient[(request_type & 0x1f)],
        request: bRequest,
        value: wValue,
        index: wIndex,
      };

      // output transfer
      let dir_bit = (request_type & 0x80)>>>0;
      if(dir_bit === 0) {

        // read the payload from the heap
        let output_data = new Uint8Array(HEAP8.subarray(data, data+wLength));
        
        // run the output control transfer
        let bytes_written = await call_rpc_timeout(RPC_CONTROL_TRANSFER_OUT, {
          dev_handle: dev_handle,
          setup: setup,
          data: output_data,
        }, timeout);

        return bytes_written;
      }

      // input transfer
      else {

        // run the input control transfer
        let buff = await call_rpc_timeout(RPC_CONTROL_TRANSFER_IN, {
          dev_handle: dev_handle,
          setup: setup,
          length: wLength,
        }, timeout);

        // return error code on timeout
        if(typeof buff === "number") {
          return buff;
        } 

        // write data to heap on success
        writeArrayToMemory(buff, data);

        return buff.length;
      }
    });

    mark_end(arguments.callee.name);
    return ret;
  },



  /*

  int libusb_bulk_transfer(libusb_device_handle *dev_handle,
                           unsigned char endpoint, 
                           unsigned char *data, 
                           int length,
                           int *actual_length, 
                           unsigned int timeout);

  */
  libusb_bulk_transfer: function(dev_handle, endpoint, data, length, actual_length, timeout) {

    mark_start(arguments.callee.name);
    let ret = Asyncify.handleAsync(async() => {
      
      // output transfer
      let dir_bit = (endpoint & 0x80)>>>0;
      if(dir_bit === 0) {

        // read the payload from the heap
        let output_data = new Uint8Array(HEAP8.subarray(data, data+length));
        
        // setup the response handler
        let response_promise = new Promise((resolve) => {
          navigator.rpc_resolvers[RPC_EVENT_BULK_OUT] = resolve;
        });

        // kick off the output transfer
        await call_rpc(RPC_BULK_TRANSFER_OUT_ASYNC, {
          dev_handle: dev_handle,
          endpoint: endpoint & 0x7f,
          data: output_data,
        });

        // wait for the transfer to finish or timeout
        let result = await Promise.race([
          response_promise,
          new Promise((resolve) => setTimeout(() => {
            resolve(LIBUSB_ERROR_TIMEOUT);
          }, timeout)),
        ])

        // update the actual length
        setValue(actual_length, result.bytesWritten, "i32");

        return LIBUSB_SUCCESS;
      }

      // input transfer
      else {

        // kick off the input transfer
        let result = await call_rpc(RPC_BULK_TRANSFER_IN, {
          dev_handle: dev_handle,
          endpoint: endpoint & 0x7f,
          length: length,
          timeout: timeout,
        });

        // return error code on timeout
        if(result === LIBUSB_ERROR_TIMEOUT) {
          return LIBUSB_ERROR_TIMEOUT;
        } 

        // write data to heap and update actual length
        writeArrayToMemory(result, data);
        setValue(actual_length, result.length, "i32");
        return LIBUSB_SUCCESS;
      }
    });

    mark_end(arguments.callee.name);
    return ret;    
  },



  /*

  struct libusb_transfer * libusb_alloc_transfer(int iso_packets);
  
  */
  libusb_alloc_transfer: function(iso_packets) {
    mark_start(arguments.callee.name);
    
    let size = SIZEOF_LIBUSB_TRANSFER + 
               SIZEOF_LIBUSB_ISO_PACKET_DESCRIPTOR * iso_packets;

    let xfer = Module._calloc(size, 1);

    mark_end(arguments.callee.name);

    return xfer;
  },



  /*

  int libusb_submit_transfer(struct libusb_transfer *transfer);

  */
  libusb_submit_transfer: function(transfer) {

    mark_start(arguments.callee.name);

    let xfer = new libusb_transfer(transfer);
    xfer.status = -1;
    xfer.save();
    let dev_handle = xfer.dev_handle;
    let endpoint = xfer.endpoint;
    let data = xfer.buffer;
    let length = xfer.length;
    let timeout = xfer.timeout;

    // output transfer
    let dir_bit = (endpoint & 0x80)>>>0;
    if(dir_bit === 0) {

      // read the payload from the heap
      let output_data = new Uint8Array(HEAP8.subarray(data, data+length));

      // kick off the output transfer
      call_rpc(RPC_SUBMIT_BULK_OUT_TRANSFER, {
        dev_handle: dev_handle,
        data: output_data,
        xfer: xfer,
        ptr: xfer.ptr,
      });
      mark_end(arguments.callee.name);
      return LIBUSB_SUCCESS;
    }

    // input transfer
    else {

      // kick off the input transfer
      call_rpc(RPC_SUBMIT_BULK_IN_TRANSFER, {
        dev_handle: dev_handle,
        endpoint: xfer.endpoint & 0x7f,
        length: xfer.length,
        timeout: xfer.timeout,
        transfer: transfer,
        ptr: transfer,
        xfer: xfer,
      });
      mark_end(arguments.callee.name);
      return LIBUSB_SUCCESS;
    }
  },
});
