#include <stdio.h>
#include <pthread.h>
#include <uhd.h>
#include <uhd/usrp/multi_usrp.hpp>
#include <libusb.h>
#include <uhd/utils/log.hpp>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <queue>
#include "kiss_fft.h"

extern "C" {
  extern void register_b200_device();
  extern void convert_register_item_sizes();
  extern void register_convert_sc16_item32_1_to_fcxx_1();
  extern void register_b200_image_loader();
  extern void load_modules();
}

uhd::usrp::multi_usrp::sptr usrp;

struct property_get_request {
  property_get_request(const char * property, double value=0) : property(property), value(value) {}
  const char * property;
  double value;
};

struct property_get_response {
  property_get_response(const char * property, double value=0) : property(property), value(value) {}
  const char * property;
  double value;
};

std::queue<property_get_request> property_get_request_queue;

#define FFT_SIZE 512
#define WATERFALL_BUFFER_DEPTH 1024

int iq_circular_buffer_last_row = -1;
float power_circular_buffer[WATERFALL_BUFFER_DEPTH][FFT_SIZE];
std::complex<float> iq_fft_out[FFT_SIZE];
std::complex<float> iq_fft_in[FFT_SIZE];

extern "C" {
  float * power_buffer() { return (float *)power_circular_buffer; };
  int row_offset() { return iq_circular_buffer_last_row; }
}



// boost::circular_buffer<std::complex<float>[FFT_SIZE]> rgb_circular_buffer(FFT_SIZE);

void start_receiving(double freq, double sample_rate, double gain, const char * antenna)
{
  // fprintf(stderr, "usrp->get_rx_stream(stream_args);\n");

  // int sample_count = 10e6;
  // int total_num_samps = sample_count;

  //setup streaming
  // std::cout << std::endl;

  //meta-data will be filled in by recv()
  // uhd::rx_metadata_t md;

  // //allocate buffers to receive with samples (one buffer per channel)
  // size_t samps_per_buff = rx_stream->get_max_num_samps();
  // samps_per_buff = FFT_SIZE;
  // // samps_per_buff = 200;
  // std::vector<std::vector<std::complex<float> > > buffs(
  //     // usrp->get_rx_num_channels(), std::vector<std::complex<float> >(samps_per_buff)
  //     1, std::vector<std::complex<float> >(samps_per_buff)
  // );

  // fprintf(stderr, "buffs count %u\n", buffs.size());

  // //create a vector of pointers to point to each of the channel buffers
  // std::vector<std::complex<float> *> buff_ptrs;
  // for (size_t i = 0; i < buffs.size(); i++) buff_ptrs.push_back(&buffs[i].front());

  // //the first call to recv() will block this many seconds before receiving
  // // double timeout = seconds_in_future + 0.1; //timeout (delay before receive + padding)

  // fprintf(stderr, "samps_per_buff: %i\n", samps_per_buff);

  // // fprintf(stderr, "streaming %u samples...\n", sample_count);
  // uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
  // // stream_cmd.num_samps = sample_count;
  // stream_cmd.stream_now = true;
  // stream_cmd.time_spec  = uhd::time_spec_t();

  // kiss_fft_cfg cfg = kiss_fft_alloc(samps_per_buff, false /* inverse=false */, NULL, NULL);
  // std::vector<std::complex<float> > fft_out(samps_per_buff);
  // while ...
  
      // ... // put kth sample in cx_in[k].r and cx_in[k].i
      
      // kiss_fft( cfg , cx_in , cx_out );
      
      // ... // transformed. DC is in cx_out[0].r and cx_out[0].i 
      
  // kiss_fft_free(cfg);

  // emscripten_sleep(1);
  // double start = emscripten_get_now();
  // fprintf(stderr, "start: %f\n", start);

  // rx_stream->issue_stream_cmd(stream_cmd);
  // fprintf(stderr, "rx_stream->issue_stream_cmd(stream_cmd);\n");

  // std::complex<float> * buffer = (std::complex<float> *)malloc(FFT_SIZE * sizeof(std::complex<float>));
  // size_t buffer_offset = 0;

  // size_t input_offset = 0;
  // size_t chunk_size = 0;
  // size_t offset = 0;

  // size_t num_acc_samps = 0; //number of accumulated samples
  // while(true){
  //     //receive a single packet

  //     // fprintf(stderr, "before calling rx_stream->recv\n");

  //     size_t num_rx_samps = rx_stream->recv(
  //         buff_ptrs, samps_per_buff, md, 0.2, false
  //     );

  //     // fprintf(stderr, "num_rx_samps = %u\n", num_rx_samps);

  //     //use a small timeout for subsequent packets
  //     // timeout = 0.1;

  //     if(md.error_code == uhd::rx_metadata_t::ERROR_CODE_OVERFLOW) {
  //       fprintf(stderr, "OVERFLOW @ %u\n", num_acc_samps);
  //       continue;
  //     }

  //     // fprintf(stderr, "md.error_code = %u\n", md.error_code);

  //     //handle the error code
  //     else if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_TIMEOUT) {
  //       fprintf(stderr, "RECEIVE TIMEOUT @ %u\n", num_acc_samps);
  //       continue;
  //       // break;
  //     }
  //     else if (md.error_code != uhd::rx_metadata_t::ERROR_CODE_NONE){
  //         throw std::runtime_error(str(boost::format(
  //             "Receiver error %s"
  //         ) % md.strerror()));
  //     } 

  //     // if(num_rx_samps != samps_per_buff) {
  //     //   fprintf(stderr, "num_rx_samps=%u\n", num_rx_samps);
  //     //   continue;
  //     // }

  //     // if(verbose) std::cout << boost::format(
  //     // fprintf(stderr, "Received packet: %u samples, %u full secs, %f frac secs", 
  //             // num_rx_samps, md.time_spec.get_full_secs(), md.time_spec.get_frac_secs());

  //     num_acc_samps += num_rx_samps;

  //     kiss_fft(cfg, (const kiss_fft_cpx *)buff_ptrs[0], (kiss_fft_cpx *)iq_fft_out);

  //     iq_circular_buffer_last_row = (iq_circular_buffer_last_row + 1) % WATERFALL_BUFFER_DEPTH;


  //     // fprintf(stderr, "%f %f %f %f %f %f %f %f\n", iq_fft_out[0].real(), iq_fft_out[0].imag(),
  //     //                                              iq_fft_out[1].real(), iq_fft_out[1].imag(),
  //     //                                              iq_fft_out[2].real(), iq_fft_out[2].imag(),
  //     //                                              iq_fft_out[3].real(), iq_fft_out[3].imag());


  //     // fprintf(stderr, "vals:");
  //     for(int x = 0; x < FFT_SIZE/2; x++) {
  //       power_circular_buffer[iq_circular_buffer_last_row][x] = 10 * std::log10(std::norm(iq_fft_out[x+FFT_SIZE/2]));
  //       // fprintf(stderr, "%f ", power_circular_buffer[iq_circular_buffer_last_row][x]);
  //     }
  //     for(int x = 0; x < FFT_SIZE/2; x++) {
  //       power_circular_buffer[iq_circular_buffer_last_row][x+FFT_SIZE/2] = 10 * std::log10(std::norm(iq_fft_out[x]));
  //       // fprintf(stderr, "%f ", power_circular_buffer[iq_circular_buffer_last_row][x]);
  //     }
  //     // fprintf(stderr, "\n");



  //     // memcpy((void *)iq_circular_buffer[iq_circular_buffer_last_row], (void *)iq_fft_out, FFT_SIZE * sizeof(std::complex<float>));

  //     // power_circular_buffer

  //     // if(iq_circular_buffer_last_row == FFT_SIZE-1) {
  //     //   fprintf(stderr, "frame\n");
  //     // }
  // }

  // kiss_fft_free(cfg);

  // if (num_acc_samps < total_num_samps) std::cerr << "Receive timeout before all samples received..." << std::endl;

  // //finished
  // fprintf(stderr, "done\n");

  // // uhd_usrp_handle handle;
  // // int ret = uhd_usrp_make(&handle, "type=b200");

  // // fprintf(stderr, "HERE AT THE END OF init_uhd_thread\n");
  // // fflush(stderr);

  // double end = emscripten_get_now();
  // fprintf(stderr, "end: %f\n", end);
  // double elapsed = end - start;
  // UHD_LOGGER_DEBUG("PERF") << "rx_iq_to_file(" << freq << ", " << sample_rate << ", '" << antenna << "'); completed in " << elapsed << "ms";
}


  // double get_rx_freq() {
  //   return usrp->get_rx_freq();
  // }

  // double set_rx_freq(double freq) {
  //   uhd::tune_request_t tune_request(freq);
  //   usrp->set_rx_freq(tune_request);
  //   return usrp->get_rx_freq();
  // }

extern "C" {
  void get_rx_freq() {
    property_get_request req = property_get_request("rx_freq");
    property_get_request_queue.push(req);
    UHD_LOGGER_DEBUG("UHD-PROXY") << "added get_rx_freq() request to the queue";
  }
}

  double set_rx_freq(double freq) {
    // uhd::tune_request_t tune_request(freq);
    // usrp->set_rx_freq(tune_request);
    // return usrp->get_rx_freq();
    // TODO figure out RPC call
  }


void * uhd_loop(void * data)
{
  uhd::log::set_console_level(uhd::log::severity_level::trace);
  uhd::log::set_log_level(uhd::log::severity_level::trace);

  // UHD static registration functions
  convert_register_item_sizes();
  register_convert_sc16_item32_1_to_fcxx_1();
  register_b200_device();
  register_b200_image_loader();


  double start = emscripten_get_now();

  std::string device_args("type=b200,spp=2048");
  usrp = uhd::usrp::multi_usrp::make(device_args);

  double elapsed = emscripten_get_now() - start;

  UHD_LOGGER_DEBUG("PERF") << "uhd::usrp::multi_usrp::make(...) completed in " << elapsed << "ms";


  double sample_rate = 2e6;
  double freq = 2402e6;
  double gain = 30;

  uhd::tune_request_t tr = uhd::tune_request_t(freq);
  usrp->set_rx_freq(tr);
  usrp->set_rx_rate(sample_rate);
  usrp->set_rx_bandwidth(sample_rate);
  usrp->set_rx_gain(gain);
  usrp->set_rx_antenna("TX/RX");


  uhd::stream_args_t stream_args("fc32", "sc16");
  stream_args.channels = {0};
  uhd::rx_streamer::sptr rx_stream = usrp->get_rx_stream(stream_args);
 

  
  uhd::rx_metadata_t md;
  size_t samps_per_buff = FFT_SIZE;
  // samps_per_buff = 200;
  std::vector<std::vector<std::complex<float> > > buffs(
      1, std::vector<std::complex<float> >(samps_per_buff)
  );

  //create a vector of pointers to point to each of the channel buffers
  std::vector<std::complex<float> *> buff_ptrs;
  for (size_t i = 0; i < buffs.size(); i++) buff_ptrs.push_back(&buffs[i].front());

  //the first call to recv() will block this many seconds before receiving
  // double timeout = seconds_in_future + 0.1; //timeout (delay before receive + padding)

  fprintf(stderr, "samps_per_buff: %i\n", samps_per_buff);

  // fprintf(stderr, "streaming %u samples...\n", sample_count);
  uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
  // stream_cmd.num_samps = sample_count;
  stream_cmd.stream_now = true;
  stream_cmd.time_spec  = uhd::time_spec_t();

  kiss_fft_cfg cfg = kiss_fft_alloc(samps_per_buff, false /* inverse=false */, NULL, NULL);





  emscripten_sleep(1);
  start = emscripten_get_now();
  fprintf(stderr, "start: %f\n", start);

  rx_stream->issue_stream_cmd(stream_cmd);
  fprintf(stderr, "rx_stream->issue_stream_cmd(stream_cmd);\n");

  std::complex<float> * buffer = (std::complex<float> *)malloc(FFT_SIZE * sizeof(std::complex<float>));
  size_t buffer_offset = 0;

  size_t input_offset = 0;
  size_t chunk_size = 0;
  size_t offset = 0;

  size_t num_acc_samps = 0; //number of accumulated samples
  while(true){
      //receive a single packet

      // fprintf(stderr, "before calling rx_stream->recv\n");

      size_t num_rx_samps = rx_stream->recv(
          buff_ptrs, samps_per_buff, md, 0.2, false
      );

      // fprintf(stderr, "num_rx_samps = %u\n", num_rx_samps);

      //use a small timeout for subsequent packets
      // timeout = 0.1;

      if(md.error_code == uhd::rx_metadata_t::ERROR_CODE_OVERFLOW) {
        fprintf(stderr, "OVERFLOW @ %u\n", num_acc_samps);
        continue;
      }

      // fprintf(stderr, "md.error_code = %u\n", md.error_code);

      //handle the error code
      else if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_TIMEOUT) {
        fprintf(stderr, "RECEIVE TIMEOUT @ %u\n", num_acc_samps);
        continue;
        // break;
      }
      else if (md.error_code != uhd::rx_metadata_t::ERROR_CODE_NONE){
          throw std::runtime_error(str(boost::format(
              "Receiver error %s"
          ) % md.strerror()));
      } 

      // if(num_rx_samps != samps_per_buff) {
      //   fprintf(stderr, "num_rx_samps=%u\n", num_rx_samps);
      //   continue;
      // }

      // if(verbose) std::cout << boost::format(
      // fprintf(stderr, "Received packet: %u samples, %u full secs, %f frac secs", 
              // num_rx_samps, md.time_spec.get_full_secs(), md.time_spec.get_frac_secs());

      num_acc_samps += num_rx_samps;

      kiss_fft(cfg, (const kiss_fft_cpx *)buff_ptrs[0], (kiss_fft_cpx *)iq_fft_out);

      iq_circular_buffer_last_row = (iq_circular_buffer_last_row + 1) % WATERFALL_BUFFER_DEPTH;


      // fprintf(stderr, "%f %f %f %f %f %f %f %f\n", iq_fft_out[0].real(), iq_fft_out[0].imag(),
      //                                              iq_fft_out[1].real(), iq_fft_out[1].imag(),
      //                                              iq_fft_out[2].real(), iq_fft_out[2].imag(),
      //                                              iq_fft_out[3].real(), iq_fft_out[3].imag());


      // fprintf(stderr, "vals:");
      for(int x = 0; x < FFT_SIZE/2; x++) {
        power_circular_buffer[iq_circular_buffer_last_row][x] = 10 * std::log10(std::norm(iq_fft_out[x+FFT_SIZE/2]));
        // fprintf(stderr, "%f ", power_circular_buffer[iq_circular_buffer_last_row][x]);
      }
      for(int x = 0; x < FFT_SIZE/2; x++) {
        power_circular_buffer[iq_circular_buffer_last_row][x+FFT_SIZE/2] = 10 * std::log10(std::norm(iq_fft_out[x]));
        // fprintf(stderr, "%f ", power_circular_buffer[iq_circular_buffer_last_row][x]);
      }
      // fprintf(stderr, "\n");



      // memcpy((void *)iq_circular_buffer[iq_circular_buffer_last_row], (void *)iq_fft_out, FFT_SIZE * sizeof(std::complex<float>));

      // power_circular_buffer

      // if(iq_circular_buffer_last_row == FFT_SIZE-1) {
      //   fprintf(stderr, "frame\n");
      // }
  }

  kiss_fft_free(cfg);

}


static std::queue<struct libusb_transfer *> completed_transfer_queue;
static std::mutex transfer_queue_mutex;


extern "C" {

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
      // fprintf(stderr, "calling transfer callback - xfer %u, actual_length %u\n", xfer, xfer->actual_length);
      // EM_ASM({mark_start("transfer-callback");});
      // fprintf(stderr, "// callback - xfer %u\n", xfer);
      // EM_ASM({mark_end("transfer-callback");});
    }
  }


  static int USB_THREAD_ID = -1;

  bool test_usb_thread() {
    return pthread_self() == USB_THREAD_ID;
  }

  void set_usb_thread() {
    USB_THREAD_ID = pthread_self();
    fprintf(stderr, "USB thread ID set to %i\n", USB_THREAD_ID);
  }

  void print_exception(std::exception * error) 
  {
    // UHD_LOGGER_INFO("B200") << "Loading firmware image: " << filestring << "...";
    // UHD_LOGGER_ERROR("B200") << error->what();

    std::cout << "print_exception(" << error << ")" << std::endl;

// /    fprintf(stderr, "error (as i32): %i\n", (int)error);
    // fprintf(stderr, "*error (as i32): %i\n", *(int*)error);

    // std::cout << "this is the error:" << std::endl;
    std::cout << error->what() << std::endl;
    // std::cout << "this is after the error" << std::endl;
    // fprintf(stderr, "[print_exception]:\n%s\n", error->what());
  }

  void * xfer_callback(void * data)
  {
    try {
      EM_ASM({
        // trace_enter("xfer_callback_thread");
        call_rpc(RPC_REGISTER_TRANSFER_CALLBACK, { timeout: 0 });
        // trace_enter("xfer_callback_thread 2");
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

  void handle_completed_transfer(libusb_transfer * xfer)
  {
    enqueue_completed_transfer(xfer);
  }

  // void loop_iter(void) {
  // }

  int main()
  {
    fprintf(stderr, "main()\n");

    MAIN_THREAD_EM_ASM({

      // spin up the USB worker thread (RPC server)
      Module.usb_dedicated_worker = new Worker("worker.js");

      Module.usb_dedicated_worker.onmessage = (e) => {
        switch(e.data.cmd) {
          case "get-device":
            show_get_device_prompt();
            break;
          default:
            console.error("unhandled postMessage command: ");
            console.error(e.data);
            break;
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
    emscripten_sleep(100);

    // initialize transfer callback thread
    pthread_t xfer_thread;
    pthread_create(&xfer_thread, NULL, xfer_callback, NULL);
    // pthread_setname_np(xfer_thread, "xfer_thread");

    emscripten_sleep(1000);

    // kick off the UHD event loop
    pthread_t thread;
    pthread_create(&thread, NULL, uhd_loop, NULL); 
    // pthread_setname_np(thread, "thread");

    // emscripten_request_animation_frame_loop(one_iter, 0);
    // emscripten_set_main_loop(loop_iter, 10, true);

  }
}