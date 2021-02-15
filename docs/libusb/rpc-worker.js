importScripts("common.js");


/*

USB RPC handlers

*/
var rpc = {

  call: async function(func, name, retry) {

    // call the RPC function
    try { 
      return await func(); 
    }

    // handle device disconnect / access denied DOM errors
    catch(e) {
      if(e instanceof DOMException) {
        if(e.message == "The device was disconnected." || e.message == "Access denied.") {
          console.warn("detected device disconnect, waiting for reconnect...");

          // reconnect "loop"
          await new Promise((resolve) => {
            var start = performance.now();
            var reauth_request_sent = false;
            var interval = setInterval(async () => {
              try {

                // check to see if the device has reconnected
                let device_count = await rpc.get_usb_device_count();
                if(device_count > 0) {
                  clearInterval(interval);
                  resolve();
                }

                // trigger the reauth UI-prompt if the device hasn't reconnected after 2000ms, 
                if((performance.now() - start) > 2000.0 && reauth_request_sent === false) {
                  console.warn("worker.js sending 'get-device' request");
                  reauth_request_sent = true;
                  postMessage({
                    cmd: "get-device",
                  });
                }
              }
              catch(error) {
                /* NOP */
                console.error(error);
              }
            }, 500);
          });
        }
      }

      // after reconnecting, retry the RPC call
      if(retry !== true) {
        try {
          return await rpc.call(func, name, true);
        }
        catch(error) {
          console.error(`error after reconnect retry, aborting`);
          console.error(error);
          throw "error after reconnect retry, aborting";
        }
      }

      // second failure, error out
      else {
        console.error(`rpc.call(${name}) retry failed, returning LIBUSB_ERROR_NO_DEVICE`);
        return LIBUSB_ERROR_NO_DEVICE;
      }
    }
  },



  claim_interface: async function(interface_number) {
    return await rpc.call(async() => {

      // select the first configuration if there isn't an active configuration
      // - this is needed for Chrome on MacOS
      if (rpc.device.configuration === null) await rpc.device.selectConfiguration(1);

      // claim the interface
      await rpc.device.claimInterface(interface_number);

      // start an input transfer loop on each endpoint
      let interface = rpc.device.configuration.interfaces.filter(i => i.interfaceNumber == interface_number)[0];
      for(let ep of interface.alternate.endpoints) {
        if(ep.direction == "in") {
          navigator.async_input_transfers[ep.endpointNumber] = [];
          const length = 16384;
          start_input_loop(rpc.device, ep.endpointNumber, length);
        }
        else navigator.output_transfers[ep.endpointNumber] = [];
      }
    }, arguments.callee.name);
  },



  bulk_transfer_in: async function(endpoint, timeout) {
    return await rpc.call(async() => {

      let promise = new Promise((resolve, reject) => {

        let t = {
          timeout: timeout,
          start: performance.now(),
          endpoint: endpoint,
          resolve: resolve,
          reject: reject,
        };

        if(navigator.sync_input_transfers[endpoint] === undefined) {
          navigator.sync_input_transfers[endpoint] = [];
        }

        navigator.sync_input_transfers[endpoint].push(t);
      });

      try {
        return await promise;
      }

      catch(error) {
        if(error === undefined /* parameterless reject() */) {
          console.error("bulk in timeout");
          return LIBUSB_ERROR_TIMEOUT;
        }
        else {
          throw error;
        }
      }

    }, arguments.callee.name);
  },



  bulk_transfer_out_async: function(port, endpoint, data) {
    (async(port, endpoint, data) => { 
      let result = await rpc.device.transferOut(endpoint, data);
      rpc.handle_bulk_out_completed(endpoint, result.bytesWritten, port);
    })(port, endpoint, data);
  },



  submit_bulk_out_transfer: async function(endpoint, data, timeout, transfer_handle) {
    return await rpc.call(async() => {

      if(navigator.output_transfers[endpoint] === undefined) {
        navigator.output_transfers[endpoint] = [];
      }

      navigator.output_transfers[endpoint].push({
        transfer_handle: transfer_handle,
        start: performance.now(),
        timeout: timeout,
      });

      (async() => {
        let result = await rpc.device.transferOut(endpoint, data);
        navigator.transfer_callback_port.postMessage({
          cmd: "completed-out-transfer",
          length: result.bytesWritten,
          transfer_handle: transfer_handle,
        });
      })();
      
      return LIBUSB_SUCCESS;
    }, arguments.callee.name);
  },



  submit_bulk_in_transfer: async function(endpoint, data, timeout, transfer_handle) {
    return await rpc.call(async() => {

      navigator.async_input_transfers[endpoint].push({
        transfer_handle: transfer_handle,
        start: performance.now(),
        timeout: timeout
      });
      
      return LIBUSB_SUCCESS;
    }, arguments.callee.name);
  },  



  release_interface: async function(interface_number) {
    return await rpc.call(async() => {
      return await rpc.device.releaseInterface(interface_number);
    }, arguments.callee.name);
  },
  


  open_device: async function() {
    return await rpc.call(async() => {
      await rpc.device.open();
      navigator.output_transfers = {};
      navigator.async_input_transfers = {};
      navigator.sync_input_transfers = {};
    }, arguments.callee.name);
  },
  


  close_device: async function() {
    return await rpc.call(async() => {
      await rpc.device.close();    
    }, arguments.callee.name);
  },



  get_usb_device_count: async function() {
    return await rpc.call(async() => {
      navigator.usb_devices = await navigator.usb.getDevices();
      return navigator.usb_devices.length;
    }, arguments.callee.name);
  },
  


  control_transfer_out: async function(setup, data) {
    return await rpc.call(async() => {
      let result = await rpc.device.controlTransferOut(setup, data);
      return result.bytesWritten;
    }, arguments.callee.name);
  },
  


  control_transfer_in: async function(setup, length) {
    return await rpc.call(async() => {
      let result = await rpc.device.controlTransferIn(setup, length);
      let buffer = new Uint8Array(result.data.buffer);
      return buffer;
    }, arguments.callee.name);
  },



  init_session: async function(handles) {
    return await rpc.call(async() => {

      // initialize an empty state
      navigator.usb_device_map = {};
      navigator.output_transfers = {};
      navigator.async_input_transfers = {};
      navigator.sync_input_transfers = {};

      // enumerate devices and allocate/assign handles
      navigator.usb_devices = await navigator.usb.getDevices();
      for(let i = 0; i < navigator.usb_devices.length; i++) {
        navigator.usb_devices[i]._handle = handles[i];
        navigator.usb_device_map[handles[i]] = navigator.usb_devices[i];
      }

    }, arguments.callee.name);
  },



  get_device_descriptor: function() {
    let d = rpc.device;
    let data = new Uint8Array([
      LIBUSB_DEVICE_DESCRIPTOR_LENGTH,
      LIBUSB_DT_DEVICE,
      d.usbVersionMajor,
      d.usbVersionMinor,
      d.deviceClass,
      d.deviceSubClass,
      d.deviceProtocol,
      64,
      d.vendorId & 0xff,
      d.vendorId >> 8,
      d.productId & 0xff,
      d.productId >> 8,
      d.deviceVersionMajor,
      d.deviceVersionMinor,
      LIBUSB_DESCRIPTOR_INDEX_MANUFACTURER,
      LIBUSB_DESCRIPTOR_INDEX_PRODUCT,
      LIBUSB_DESCRIPTOR_INDEX_SERIAL_NUMBER,
      d.configurations.length,
    ]);
    return data;
  }, 



  get_string_descriptor: function(desc_index) {
    switch(desc_index) {
      case LIBUSB_DESCRIPTOR_INDEX_SERIAL_NUMBER:
        return rpc.device.serialNumber;
      case LIBUSB_DESCRIPTOR_INDEX_PRODUCT:
        return rpc.device.productName;
      case LIBUSB_DESCRIPTOR_INDEX_MANUFACTURER:
        return rpc.device.manufacturerName;
      default:
        return "";
    }
  },



  cancel_input_transfer: function(endpoint, transfer_handle) {
    let xfer = navigator.async_input_transfers[endpoint].filter(t => t.transfer_handle == transfer_handle)[0];
    navigator.async_input_transfers[endpoint].splice(navigator.async_input_transfers[endpoint].indexOf(xfer), 1);
  },



  cancel_output_transfer: function(endpoint, transfer_handle) {
    let xfer = navigator.output_transfers[endpoint].filter(t => t.transfer_handle == transfer_handle)[0];
    navigator.output_transfers[endpoint].splice(navigator.output_transfers[endpoint].indexOf(xfer), 1);
  },



  timeout_transfers: function() {
    const now = performance.now();

    // timeout asynchronous output transfers
    for(let endpoint of Object.keys(navigator.output_transfers)) {
      let xfers = navigator.output_transfers[endpoint];
      for(let xfer of xfers.filter(t => t.timeout > 0 && (now - t.start) > t.timeout)) {
        navigator.transfer_callback_port.postMessage({
          cmd: "timed-out-transfer",
          transfer_handle: xfer.transfer_handle,
        });
        navigator.output_transfers[endpoint].splice(navigator.output_transfers[endpoint].indexOf(xfer), 1);
      }
    }

    // timeout asynchronous input transfers
    for(let endpoint of Object.keys(navigator.async_input_transfers)) {
      let xfers = navigator.async_input_transfers[endpoint];
      for(let xfer of xfers.filter(t => t.timeout > 0 && (now - t.start) > t.timeout)) {
        navigator.transfer_callback_port.postMessage({
          cmd: "timed-out-transfer",
          transfer_handle: xfer.transfer_handle,
        });
        navigator.async_input_transfers[endpoint].splice(navigator.async_input_transfers[endpoint].indexOf(xfer), 1);
      }
    }

    // timeout synchronous input transfers
    for(let endpoint of Object.keys(navigator.sync_input_transfers)) {
      let xfers = navigator.sync_input_transfers[endpoint];
      for(let xfer of xfers.filter(t => t.timeout > 0 && (now - t.start) > t.timeout)) {
        xfer.resolve(LIBUSB_ERROR_TIMEOUT);
        navigator.sync_input_transfers[endpoint].splice(navigator.sync_input_transfers[endpoint].indexOf(xfer), 1);
      }
    }
    
    setTimeout(() => {
      rpc.timeout_transfers();
    }, 5);
  },
}



/*

per-endpoint input-request loop

- maintains an input transfer on each endpoint on a claimed interface

- WebUSB transfers can't be cancelled or timed out, so this makes it possible
  to support the timeout and cancellation primitives needed by libusb

*/
async function start_input_loop(device, endpoint, length) {

  let result;  

  try {
    result = await device.transferIn(endpoint, length);
  }

  catch(error) {
    console.error(`error in start_input_loop (endpoint=${endpoint}, length=${length})`);
    console.error(error);
    throw error;
  }

  if(navigator.sync_input_transfers[endpoint].length > 0) {
    let t = navigator.sync_input_transfers[endpoint].shift();
    t.resolve(new Uint8Array(result.data.buffer));
  }

  else if(navigator.async_input_transfers[endpoint].length > 0) {
    let t = navigator.async_input_transfers[endpoint].shift();
    navigator.transfer_callback_port.postMessage({
      cmd: "completed-in-transfer",
      transfer_handle: t.transfer_handle,
      data: new Uint8Array(result.data.buffer),
    });
  }
  
  setTimeout(() => { start_input_loop(device, endpoint, length); }, 0);
}



/*

process an incoming message from an RPC client

*/
async function process_message(e, port) {

  let a = {};
  let id = e.data.id;

  // lookup the device if a handle was provided in the request
  if(e.data.args !== undefined) {
    a = e.data.args;
    if(a.dev !== undefined) rpc.device = navigator.usb_device_map[a.dev];
    else if(a.dev_handle !== undefined) rpc.device = navigator.usb_device_map[a.dev_handle];
  }

  // return helper
  const R = (resp) => port.postMessage({
    id: id,
    response: resp
  });

  switch(e.data.rpc) {

    case RPC_REGISTER_TRANSFER_CALLBACK:
      navigator.transfer_callback_port = port;
      break;

    case RPC_WAIT_FOR_RECONNECT:
      R(await rpc.wait_for_reconnect());
      break;
      
    case RPC_INIT_SESSION:
      R(await rpc.init_session(a.handles));
      break;

    case RPC_CONTROL_TRANSFER_IN:
      R(await rpc.control_transfer_in(a.setup, a.length));
      break;

    case RPC_CONTROL_TRANSFER_OUT:
      R(await rpc.control_transfer_out(a.setup, a.data));
      break;

    case RPC_BULK_TRANSFER_IN:
      R(await rpc.bulk_transfer_in(a.endpoint, a.timeout));
      break;

    case RPC_BULK_TRANSFER_OUT_ASYNC:
      R(rpc.bulk_transfer_out_async(port, a.endpoint, a.data));
      break;

    case RPC_SUBMIT_BULK_IN_TRANSFER:
      R(await rpc.submit_bulk_in_transfer(a.endpoint, a.length, a.timeout, a.transfer_handle));
      break;

    case RPC_SUBMIT_BULK_OUT_TRANSFER:
      R(await rpc.submit_bulk_out_transfer(a.endpoint, a.data, a.timeout, a.transfer_handle));
      break;      

    case RPC_GET_STRING_DESCRIPTOR:
      R(rpc.get_string_descriptor(a.desc_index));
      break;

    case RPC_OPEN_DEVICE:
      R(await rpc.open_device());
      break;

    case RPC_CLOSE_DEVICE:
      R(await rpc.close_device());
      break;

    case RPC_CANCEL_TRANSFER:
      let ep = endpoint & 0x7f;
      if(a.endpoint & 0x80 == 0x80) R(rpc.cancel_input_transfer(ep, a.transfer_handle));
      else R(rpc.cancel_output_transfer(ep, a.transfer_handle));
      break;

    case RPC_CLAIM_INTERFACE:
      R(await rpc.claim_interface(a.interface_number));
      break;

    case RPC_RELEASE_INTERFACE:
      R(await rpc.release_interface(a.interface_number));
      break;

    case RPC_GET_USB_DEVICE_COUNT:
      R(await rpc.get_usb_device_count());
      break;

    case RPC_SET_USB_DEVICE_HANDLE:
      navigator.usb_devices[a.index]._handle = a.handle;
      navigator.usb_device_map[a.handle] = navigator.usb_devices[a.index];
      R();
      break;

    case RPC_GET_USB_DEVICE_DESCRIPTOR:
      R(rpc.get_device_descriptor());
      break;

    default:
      console.error(e);
      throw "unhandled rpc";
  }
};



/*

initialize the RPC server

*/
(function initialize() {

  navigator.usb_ports = [];
  navigator.output_transfers = {};
  navigator.async_input_transfers = {};
  navigator.sync_input_transfers = {};
  navigator.disconnect_counter = 0;

  navigator.usb.onconnect = (e) => {
    navigator.disconnect_counter--;
    console.warn("navigator.usb.onconnect");
  };

  navigator.usb.ondisconnect = (e) => {
    navigator.disconnect_counter++;
    console.warn("navigator.usb.ondisconnect");
  };  

  // kick off the transfer-timeout loop
  rpc.timeout_transfers();
})();



/*

handle messages from the main thread

*/
onmessage = (e) => {
  switch(e.data.cmd) {

    // register a new USB RPC message port
    case "set-usb-rpc-port":
      var port = e.ports[0];
      port.onmessage = (e) => {
        process_message(e, port);
      };
      navigator.usb_ports.push(port);
      break;

    // unhandled message
    default:
      console.error("USB worker received expected message on primary port: " + e);
      break;
  }
};
