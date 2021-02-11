if(Module.preRun === undefined) Module.preRun = [];
Module.preRun.push(function(){
  ENV.UHD_LOG_LEVEL = 0;
  ENV.UHD_LOG_MIN_LEVEL = 0;
  ENV.UHD_SYS_CONF_FILE = "uhd.conf";
  ENV.UHD_IMAGES_DIR = "/images";  
});


function trace_enter(function_name) {
  // NOP
}


function trace_enter_quiet() {
  // NOP
}


async function call_rpc(rpc, args) {

  let id = navigator.next_rpc_id;

  let promise = new Promise((resolve) => {
    navigator.rpc_resolvers[id] = resolve;
  });

  navigator.usb_worker.postMessage({
    rpc: rpc,
    args: args,
    id: id,
  });

  navigator.next_rpc_id++;

  return promise;
}


function mark_end(name) {
  performance.mark(`${name}-1`);
  performance.measure(`${name}`, `${name}-0`, `${name}-1`);
}


function mark_start(name) {
  performance.mark(`${name}-0`);
}


async function call_rpc_timeout(rpc, args, timeout) {
  if(timeout > 0) {
    return Promise.race([
      call_rpc(rpc, args),
      new Promise((resolve) => setTimeout(() => { 
        resolve(LIBUSB_ERROR_TIMEOUT); 
      }, timeout)),
    ]);
  }
  else {
    return call_rpc(rpc, args);
  }
}


// runtime constants
const PTR_SIZE = 4; // wasm32
