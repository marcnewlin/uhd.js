#include <libusb.h>
#include <emscripten.h>
#include <queue>
#include <mutex>
#include <iostream>

static std::queue<struct libusb_transfer *> completed_transfer_queue;
static std::mutex transfer_queue_mutex;

extern "C" {

  void * xfer_callback(void * data)
  {
    try {
      EM_ASM({
        usb_worker_rpc(RPC_REGISTER_TRANSFER_CALLBACK);
      });

      while(1)
      {
        emscripten_sleep(100000);
      }
    }
    catch(std::exception &error)
    {
      // print_exception(error);
      std::cout << error.what() << std::endl;
      throw "well shit - xfer callback";
    }
  }

  void enqueue_completed_transfer(struct libusb_transfer * transfer)
  {
    transfer_queue_mutex.lock();
    completed_transfer_queue.push(transfer);
    transfer_queue_mutex.unlock();
  }

  void process_completed_transfer()
  {
    if(!completed_transfer_queue.empty()) {
      transfer_queue_mutex.lock();
      struct libusb_transfer * xfer = completed_transfer_queue.front();
      completed_transfer_queue.pop();
      xfer->callback(xfer);
      transfer_queue_mutex.unlock();
    }
  }  

  void handle_completed_transfer(libusb_transfer * xfer)
  {
    enqueue_completed_transfer(xfer);
  }

  void start_libusb_shim()
  {

    emscripten_sleep(1000);

    MAIN_THREAD_EM_ASM({

      // spin up the USB worker thread (RPC server)
      Module.usb_dedicated_worker = new Worker("libusb/rpc-worker.js");
      Module.usb_dedicated_worker.onmessage = (e) => {
        if(e.data.cmd == "get-device") {
            show_get_device_prompt();
        }
      };

      // setup a message channel between each preallocated pthread and the RPC server
      let workers = [].concat(Module.PThread.unusedWorkers, Module.PThread.runningWorkers);
      console.warn(workers);
      for(let worker of workers) {
        let channel = new MessageChannel();
        
        // port1 -> USB RPC server
        Module.usb_dedicated_worker.postMessage({ cmd: "set-usb-rpc-port" }, [channel.port1]);
        
        // port2 -> pthread (allocated with eg. "-s PTHREAD_POOL_SIZE=6")
        worker.postMessage({ cmd: "set-usb-rpc-port" }, [channel.port2]);
      }
    });

    // wait briefly to make sure the threads are spun up
    emscripten_sleep(1000);

    // initialize transfer callback thread
    pthread_t xfer_thread;
    pthread_create(&xfer_thread, NULL, xfer_callback, NULL);

    emscripten_sleep(1000);

  }
}
