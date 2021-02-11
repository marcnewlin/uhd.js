this._onmessage = this.onmessage;
this.onmessage = (e) => {

  switch(e.data.cmd) {
    case "set-usb-rpc-port":
      trace_enter("set-usb-rpc-port");

      // initialize RPC state
      navigator.usb_worker = e.ports[0];
      navigator.next_rpc_id = 100; // reserve IDs 0-99
      navigator.rpc_resolvers = {};
      
      // RPC response handler
      navigator.usb_worker.onmessage = function(e) {

        if(e.data.cmd == "completed-transfer") {
          let xfer = new libusb_transfer(undefined, e.data.xfer.u8);
          xfer.ptr = e.data.ptr;
          
          // input
          if(e.data.input) {
            writeArrayToMemory(e.data.data, xfer.buffer);
            xfer.handle_completed(e.data.data.length);
          }

          // output
          else {
            xfer.handle_completed(e.data.length);
          }

          return;
        }

        else if(e.data.cmd == "timed-out-transfer") {
          let xfer = new libusb_transfer(undefined, e.data.xfer.u8);
          xfer.ptr = e.data.ptr;
          xfer.handle_timeout();
          return;
        }

        else if(e.data.cmd == "failed-transfer") {
          let xfer = new libusb_transfer(undefined, e.data.xfer.u8);
          xfer.ptr = e.data.ptr;
          xfer.handle_failure();
          return;
        }        
        
        if(typeof navigator.rpc_resolvers[e.data.id] !== "function") {
          console.error("UNHANDLED MESSAGE IN POST.JS");
          console.error(e.data);
        } 
        
        else {
          navigator.rpc_resolvers[e.data.id](e.data.response);
          delete navigator.rpc_resolvers[e.data.id];
        }
        
      };      
      break;

    default:
      this._onmessage(e);
      break;
  }
};
