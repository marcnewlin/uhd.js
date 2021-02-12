importScripts("constants.js");
importScripts("libusb_transfer.js");


const rpc = {

  // _call: async function(promise) {
  //   try {

  //     if(navigator.disconnect_counter > 0) {
  //       // console.error("waiting for dis")
  //       return LIBUSB_ERROR_NO_DEVICE;
  //     }

  //     await promise;
  //     return LIBUSB_SUCCESS;
  //   }
  //   catch(error) {

  //     if(error instanceof DOMException) {

  //       switch(error.message) {

  //         case "The device was disconnected.":
  //           console.warn("rpc._call returning LIBUSB_ERROR_NO_DEVICE");
  //           return LIBUSB_ERROR_NO_DEVICE;

  //         default:
  //           console.error("unhandled DOMException in rpc._call in worker.js:");
  //           console.error(error.name, error.message);
  //           throw "";
  //       }

  //       console.warn("DOMException");
  //       console.warn("  .message = " + error.message);
  //       console.warn("  .name    = " + error.name);
  //       console.warn("  .code    = " + error.code);
  //       // console.warn(error);
  //     }

  //     console.error(`error in rpc._call(...) in worker.js, returning ${error_code}:`);
  //     console.error(error);
  //     // console.error(typeof error);
  //     return error_code;
  //   }
  // },

  wrap: async function(func, name, retry) {

    try {
      return await func();
    }
    catch(e) {

      // handle device disconnect
      if(e instanceof DOMException) {

        if(e.message == "The device was disconnected." || e.message == "Access denied.") {

          console.warn("rpc.wrap(...) - detected device disconnect, waiting for reconnect");

          let start = performance.now();
          let get_device_request_time = 0;

          await new Promise((resolve) => {
            var interval = setInterval(async () => {

              let elapsed = performance.now() - start;

              try {
                let device_count = await rpc.get_usb_device_count();
                elapsed = performance.now() - start;
                console.warn(`device_count: ${device_count}`);

                if(device_count > 0) {
                  clearInterval(interval);
                  resolve();
                }

                else {

                  if(get_device_request_time === 0 && elapsed > 2000.0) {
                    get_device_request_time = performance.now();
                    console.warn("worker.js sending 'get-device' request");
                    postMessage({
                      cmd: "get-device",
                    });
                  }
                }
              }
              catch(e2) {
                console.warn(`error checking device count during reconnect:`);
                console.warn(e2);
              }
              
            }, 500);
          });
        }
      }

      if(retry !== true) {
        console.warn(e);
        return await rpc.wrap(func, name, true);
      }

      else {
        console.warn(e);
        return LIBUSB_ERROR_NO_DEVICE;
      }


    }
  },


  claim_interface: async function(dev_handle, interface_number) {
    return await rpc.wrap(async() => {
      let d = navigator.usb_device_map[dev_handle];

      // select the first configuration if there isn't an active configuration
      if (d.configuration === null) await d.selectConfiguration(1);

      return await d.claimInterface(interface_number);
    }, arguments.callee.name);
  },


  release_interface: async function(dev_handle, interface_number) {
    return await rpc.wrap(async() => {
      let d = navigator.usb_device_map[dev_handle];
      return await d.releaseInterface(interface_number);
    }, arguments.callee.name);
  },
  

  open_device: async function(dev) {
    return await rpc.wrap(async() => {
      let d = navigator.usb_device_map[dev];
      await d.open();
      navigator.output_transfers = {};
      navigator.input_transfers = {};
    }, arguments.callee.name);
  },
  

  close_device: async function(dev) {
    return await rpc.wrap(async() => {
      let d = navigator.usb_device_map[dev];
      await d.close();    
    }, arguments.callee.name);
  },


  get_usb_device_count: async function() {
    return await rpc.wrap(async() => {
      navigator.usb_devices = await navigator.usb.getDevices();
      return navigator.usb_devices.length;
    }, arguments.callee.name);
  },
  

  control_transfer_out: async function(dev_handle, setup, data) {
    return await rpc.wrap(async() => {
      let d = navigator.usb_device_map[dev_handle];
      let result = await d.controlTransferOut(setup, data);
      return result.bytesWritten;
    }, arguments.callee.name);
  },
  

  control_transfer_in: async function(dev_handle, setup, length) {
    return await rpc.wrap(async() => {
      let d = navigator.usb_device_map[dev_handle];
      let result = await d.controlTransferIn(setup, length);
      let buffer = new Uint8Array(result.data.buffer);
      return buffer;
    }, arguments.callee.name);
  },


  init_session: async function(handles) {
    return await rpc.wrap(async() => {

      // initialize an empty state
      navigator.usb_device_map = {};
      navigator.output_transfers = [];
      navigator.input_transfers = [];

      // enumerate devices and allocate/assign handles
      navigator.usb_devices = await navigator.usb.getDevices();
      for(let i = 0; i < navigator.usb_devices.length; i++) {
        navigator.usb_devices[i]._handle = handles[i];
        navigator.usb_device_map[handles[i]] = navigator.usb_devices[i];
      }

    }, arguments.callee.name);
  },


  get_device_descriptor: function(dev) {
    let d = navigator.usb_device_map[dev];
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


  get_string_descriptor: function(dev_handle, desc_index) {
    let d = navigator.usb_device_map[dev_handle];
    switch(desc_index) {
      case LIBUSB_DESCRIPTOR_INDEX_SERIAL_NUMBER:
        return d.serialNumber;
      case LIBUSB_DESCRIPTOR_INDEX_PRODUCT:
        return d.productName;
      case LIBUSB_DESCRIPTOR_INDEX_MANUFACTURER:
        return d.manufacturerName;
      default:
        return "";
    }
  },


  handle_bulk_in_failed: function (endpoint, data, port) {

    mark_start(arguments.callee.name);
  
    for(let i = 0; i < navigator.input_transfers[endpoint].length; i++) {

      navigator.transfer_callback_port.postMessage({
        cmd: "failed-transfer",
        input: true,
        data: data,
        xfer: navigator.input_transfers[endpoint][i].ptr,
      });

      navigator.input_transfers.splice(i, 1);

      mark_end(arguments.callee.name);
      return;
    }

    port.postMessage({
      id: RPC_EVENT_BULK_IN,
      response: { endpoint: endpoint, data: data }
    });

    mark_end(arguments.callee.name);
  },


  timeout_transfers: function() {

    const now = performance.now();

    for(let endpoint of Object.keys(navigator.output_transfers)) {
      let xfers = navigator.output_transfers[endpoint];
      let timeout_list = [];

      for(let xfer of xfers) {
        let elapsed = now - xfer.start;
        if(xfer.timeout > 0 && elapsed > xfer.timeout) {
          console.error(`output transfer timed out - timeout ${xfer.timeout}, elapsed ${elapsed}`);
          console.error(xfer);
          timeout_list.push(xfer);
        }
      }
    
      for(let xfer of timeout_list) {

        if(xfer.sync !== true) {
          let msg = {
            cmd: "timed-out-transfer",
            xfer: xfer.xfer,
            ptr: xfer.xfer.ptr,
            input: false,
          };
          console.log(msg);
          navigator.transfer_callback_port.postMessage(msg);
        }

        navigator.output_transfers[endpoint].splice(navigator.output_transfers[endpoint].indexOf(xfer), 1);
      }
    }


    for(let endpoint of Object.keys(navigator.input_transfers)) {
      let xfers = navigator.input_transfers[endpoint];
      let timeout_list = [];

      for(let xfer of xfers) {
        let elapsed = now - xfer.start;
        if(xfer.timeout > 0 && elapsed > xfer.timeout) {
          console.error(`input transfer timed out - timeout ${xfer.timeout}, elapsed ${elapsed}`);
          console.error(xfer);
          timeout_list.push(xfer);
        }
      }
    
      for(let xfer of timeout_list) {

        if(xfer.sync !== true) {
          let msg = {
            cmd: "timed-out-transfer",
            xfer: xfer.xfer,
            ptr: xfer.xfer.ptr,
            input: true,
          };
          console.log(msg);
          navigator.transfer_callback_port.postMessage(msg);
        }

        navigator.input_transfers[endpoint].splice(navigator.input_transfers[endpoint].indexOf(xfer), 1);
      }
    }

    setTimeout(() => {
      rpc.timeout_transfers();
    }, 5);
  },
}



function mark_end(name) {
  performance.mark(`${name}-1`);
  performance.measure(`${name}`, `${name}-0`, `${name}-1`);
}


function mark_start(name) {
  performance.mark(`${name}-0`);
}


this.performance_interval = setInterval(() => {
  let entries = performance.getEntriesByType("measure");

  const fnames = [...new Set(entries.map(e => e.name))];
  let fcalls = {};
  for(let f of fnames) {
    fcalls[f] = entries.filter(e => e.name == f).map(e => ({ startTime: e.startTime, duration: e.duration }));
  }

  if(fnames.length > 0) {
    console.log(fcalls);
  }
  
  performance.clearMarks();
  performance.clearMeasures();
}, 100);



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

  while(navigator.input_transfers[endpoint].length > 0) {
    let t = navigator.input_transfers[endpoint].shift();
    t.resolve(new Uint8Array(result.data.buffer));
    break;
  }
  
  setTimeout(() => { start_input_loop(device, endpoint, length); }, 0);
}


async function process_message(e, port) {

  let a = e.data.args;
  let id = e.data.id;
  let now = performance.now();

  let device = undefined;
  if(a.dev !== undefined) device = navigator.usb_device_map[a.dev];
  else if(a.dev_handle !== undefined) device = navigator.usb_device_map[a.dev_handle];

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
      R(await rpc.control_transfer_in(a.dev_handle, a.setup, a.length));
      break;

    case RPC_CONTROL_TRANSFER_OUT:
      R(await rpc.control_transfer_out(a.dev_handle, a.setup, a.data));
      break;

    case RPC_BULK_TRANSFER_IN:

      let promise = new Promise((resolve, reject) => {
        navigator.input_transfers[a.endpoint].push({
          sync: true,
          resolve: resolve,
          reject: reject,
          timeout: a.timeout,
          start: now,
          endpoint: a.endpoint,
        });
        if(a.timeout > 0) {
          setTimeout(reject, a.timeout);
        }
      });

      try {
        let result = await promise;
        R(result);
        console.warn("RPC BULK TRANSFER IN - GOT RESULT");
        console.warn(result);
      }
      catch(error) {
        if(error === undefined) {
          R(LIBUSB_ERROR_TIMEOUT);
        }
        else {
          throw error;
        }
      }
      break;

    case RPC_BULK_TRANSFER_OUT_ASYNC:
      (async(_port, _endpoint, _data) => {
        try {
          let result = await device.transferOut(_endpoint, _data);
          rpc.handle_bulk_out_completed(_endpoint, result.bytesWritten, _port);
        }
        catch(error) {
          console.error("handling error in RPC_BULK_TRANSFER_OUT_ASYNC");
          console.error(error);
        }

      })(port, _endpoint, _data);
      R();
      break;

    case RPC_SUBMIT_BULK_IN_TRANSFER:

      let in_xfer = new libusb_transfer(undefined, a.xfer.u8);
      in_xfer.ptr = a.ptr;

      let input_transfer = {
        xfer: in_xfer,
        start: now,
        timeout: in_xfer.timeout,
        endpoint: in_xfer.endpoint & 0x7f,
        ep: in_xfer.endpoint & 0x7f,
        resolve: (data)=>{
        
          navigator.transfer_callback_port.postMessage({
            cmd: "completed-transfer",
            input: true,
            data: data,
            xfer: in_xfer,
            ptr: in_xfer.ptr,
          });
        },
        reject: ()=>{rpc.handle_bulk_in_failed(ep, null, port)},
      };

      navigator.input_transfers[input_transfer.ep].push(input_transfer);

      R();
      break;

    case RPC_SUBMIT_BULK_OUT_TRANSFER:

      let out_xfer = new libusb_transfer(undefined, a.xfer.u8);
      out_xfer.ptr = a.ptr;

      let ep = out_xfer.endpoint & 0x7f;
      let data = a.data;

      let output_transfer = {
        xfer: out_xfer,
        start: now,
        timeout: out_xfer.timeout,
        endpoint: out_xfer.endpoint & 0x7f,        
        ep: out_xfer.endpoint & 0x7f,
        resolve: (length)=>{
        
          navigator.transfer_callback_port.postMessage({
            cmd: "completed-transfer",
            input: false,
            length: length,
            xfer: out_xfer,
            ptr: out_xfer.ptr,
          });
        },
        reject: ()=>{rpc.handle_bulk_out_failed(ep, 0, port)},
      };

      navigator.output_transfers[output_transfer.ep].push(output_transfer);

      (async() => {
        let result = await device.transferOut(ep, data);
        output_transfer.resolve(result.bytesWritten);
      })();      

      R();
      break;      

    case RPC_GET_STRING_DESCRIPTOR:
      R(rpc.get_string_descriptor(a.dev_handle, a.desc_index));
      break;

    case RPC_OPEN_DEVICE:
      R(await rpc.open_device(a.dev));
      break;

    case RPC_CLOSE_DEVICE:
      R(await rpc.close_device(a.dev));
      break;

    case RPC_CANCEL_TRANSFER:
      if((a.ep & 0x80) == 0x80) {
        let _ep = a.ep & 0x7f;
        let xfer = navigator.input_transfers[_ep].filter(t => t.xfer.ptr == a.ptr)[0];
        navigator.input_transfers[_ep].splice(navigator.input_transfers[_ep].indexOf(xfer), 1);
      }
      else {
        let _ep = a.ep & 0x7f;
        let xfer = navigator.output_transfers[_ep].filter(t => t.xfer.ptr == a.ptr)[0];
        navigator.output_transfers[_ep].splice(navigator.output_transfers[_ep].indexOf(xfer), 1);
      }
      break;

    case RPC_CLAIM_INTERFACE:
      
      // claim the interface
      let ret = await rpc.claim_interface(a.dev_handle, a.interface_number);

      // // lookup the device
      // if(a.dev !== undefined) device = navigator.usb_device_map[a.dev];
      // else if(a.dev_handle !== undefined) device = navigator.usb_device_map[a.dev_handle];

      // start an input transfer loop on each endpoint
      let interface = device.configuration.interfaces.filter(i => i.interfaceNumber == a.interface_number)[0];
      for(let ep of interface.alternate.endpoints) {
        if(ep.direction == "in") {
          navigator.input_transfers[ep.endpointNumber] = [];
          start_input_loop(device, ep.endpointNumber, 8192);
        }
        else navigator.output_transfers[ep.endpointNumber] = [];
      }

      R(ret);
      break;

    case RPC_RELEASE_INTERFACE:
      R(await rpc.release_interface(a.dev_handle, a.interface_number));
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
      R(rpc.get_device_descriptor(a.dev));
      break;

    default:
      console.error(e);
      throw "unhandled rpc";
  }
};



function initialize() {

  navigator.usb_ports = [];
  navigator.output_transfers = {};
  navigator.input_transfers = {};
  navigator.disconnect_counter = 0;

  navigator.usb.onconnect = (e) => {
    navigator.disconnect_counter--;
    console.warn("navigator.usb.onconnect");
  };

  navigator.usb.ondisconnect = (e) => {
    navigator.disconnect_counter++;
    console.warn("navigator.usb.ondisconnect");
  };  
}

initialize();
rpc.timeout_transfers();


// /*
//   setup disconnect/reconnect handlers
// */
// if(navigator.reconnect_initialized === undefined) {
//   navigator.disconnect_counter = 0;
//   navigator.reconnect_resolver = null;
//   navigator.reconnect_initialized = performance.now();

//   // device reconnect handler
//   navigator.usb.onconnect = (e) => {
//     navigator.disconnect_counter--;
//     if(navigator.reconnect_resolver !== null) {

//       // wait 500ms, then resolve
//       setTimeout(() => {
//         navigator.reconnect_resolver();
//         navigator.reconnect_resolver = null;
//       }, 500);
//     }
//   };
  
//   // device disconnect handler
//   navigator.usb.ondisconnect = (e) => {
//     navigator.disconnect_counter++;
//   }
// }


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
