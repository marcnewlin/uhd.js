/*

setup USB RPC-client message handlers

*/
this._onmessage = this.onmessage;
this.onmessage = (e) => {

  switch(e.data.cmd) {

    case "set-usb-rpc-port":

      navigator.usb_rpc_port = e.ports[0];
      navigator.next_rpc_id = 100; // reserve IDs 0-99
      navigator.rpc_resolvers = {};

      // handle messages received from the USB RPC thread
      navigator.usb_rpc_port.onmessage = function(e) {

        /*
          completion handlers for async libusb transfers
        */

        // output transfer completed successfully
        if(e.data.cmd == "completed-out-transfer") {
          let xfer = new libusb_transfer(e.data.transfer_handle);
          xfer.handle_completed(e.data.length);
        }

        // input transfer completed successfully
        else if(e.data.cmd == "completed-in-transfer") {
          let xfer = new libusb_transfer(e.data.transfer_handle);
          writeArrayToMemory(e.data.data, xfer.buffer);
          xfer.handle_completed(e.data.data.length);
        }        

        // transfer timed out
        else if(e.data.cmd == "timed-out-transfer") {
          let xfer = new libusb_transfer(e.data.transfer_handle);
          xfer.handle_timeout();
        }

        // transfer failed
        else if(e.data.cmd == "failed-transfer") {
          let xfer = new libusb_transfer(e.data.transfer_handle);
          xfer.handle_failure();
        }

        /*
          default RPC response handler
        */

        else if(typeof navigator.rpc_resolvers[e.data.id] === "function") {
          navigator.rpc_resolvers[e.data.id](e.data.response);
          delete navigator.rpc_resolvers[e.data.id];
        }

        else {
          console.error("usb-rpc-hook.js - unhandled message!");
          console.error(e);
          throw "unhandled message in usb-rpc-hook.js";
        }
      };
      break;

    // pass through to the existing message handler
    default:
      this._onmessage(e);
      break;
  }
};  



/*

call an RPC function on the USB Worker thread

*/
async function usb_worker_rpc(rpc, args, timeout) {

  let id = navigator.next_rpc_id;

  let promise = new Promise((resolve) => {
    navigator.rpc_resolvers[id] = resolve;
  });

  navigator.usb_rpc_port.postMessage({
    rpc: rpc,
    args: args,
    id: id,
  });

  navigator.next_rpc_id++;

  if(timeout !== undefined && timeout > 0) {
    return Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => { 
        resolve(LIBUSB_ERROR_TIMEOUT); 
      }, timeout)),
    ]);
  }

  return promise;
}
