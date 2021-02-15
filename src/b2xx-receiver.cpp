#include <pthread.h>
#include <uhd.h>
#include <uhd/usrp/multi_usrp.hpp>
#include <emscripten.h>


extern "C" {
  
  #include "kiss_fft.h"


  /*

  interface to the waterfall JS client

  */
  extern "C" {
    int buffer_offset = -1;
    float * power_circular_buffer = 0;
    uint8_t * rgba_circular_buffer = 0;
    uint8_t * rgba_buffer() { return (uint8_t *)rgba_circular_buffer; };
    int row_offset() { return buffer_offset; }
  }



  /*

  UHD static initializers required to use a USRP B2xx

  */
  extern void register_b200_device();
  extern void convert_register_item_sizes();
  extern void register_convert_sc16_item32_1_to_fcxx_1();
  extern void register_b200_image_loader();



  /*

  USRP B2xx device instance

  */
  uhd::usrp::multi_usrp::sptr usrp;



  /*

  USRP B2xx receive loop

  - configures the USRP and streams/processes IQ for the waterfall

  */
  void * b2xx_receiver_loop(void * data) {

    /*
      read the numeric configuration values
    */
    double freq = MAIN_THREAD_EM_ASM_DOUBLE({ return window.config.usrp.freq; });
    double gain = MAIN_THREAD_EM_ASM_DOUBLE({ return window.config.usrp.gain; });
    double sample_rate = MAIN_THREAD_EM_ASM_DOUBLE({ return window.config.usrp.sample_rate; });
    size_t fft_size = MAIN_THREAD_EM_ASM_INT({ return window.config.waterfall.width; });
    size_t buffer_depth = MAIN_THREAD_EM_ASM_INT({ return window.config.waterfall.height; });
    double range_low = MAIN_THREAD_EM_ASM_DOUBLE({ return window.config.waterfall.dynamic_range.low; });
    double range_high = MAIN_THREAD_EM_ASM_DOUBLE({ return window.config.waterfall.dynamic_range.high; });
    double range = range_high - range_low;

    /*
      marshal the antenna name
    */
    int bl = MAIN_THREAD_EM_ASM_INT({ return lengthBytesUTF8(window.config.usrp.antenna)+1; });
    char * antenna = (char *)malloc(bl);
    MAIN_THREAD_EM_ASM({ return stringToUTF8(window.config.usrp.antenna, $0, $1); }, antenna, bl);

    /*
      allocate buffers
    */
    std::vector<std::complex<float> > fft_out(fft_size);
    kiss_fft_cfg cfg = kiss_fft_alloc(fft_size, false, 0, 0);
    power_circular_buffer = (float *)calloc(fft_size * buffer_depth, sizeof(float));
    rgba_circular_buffer = (uint8_t *)calloc(fft_size * buffer_depth, sizeof(uint32_t));
    for(int x = 0; x < fft_size*buffer_depth; x++) {
      rgba_circular_buffer[x*4+3] = 255;
    }

    // start the waterfall animation loop
    MAIN_THREAD_ASYNC_EM_ASM({ 
      window.start_waterfall();
    });

    /*
      initialize UHD and configure the USRP
    */

    // set the log level to trace
    uhd::log::set_console_level(uhd::log::severity_level::trace);
    uhd::log::set_log_level(uhd::log::severity_level::trace);

    // call the static initializers
    convert_register_item_sizes();
    register_convert_sc16_item32_1_to_fcxx_1();
    register_b200_device();
    register_b200_image_loader();

    // initialize the usrp
    std::string device_args("type=b200,spp=512");
    usrp = uhd::usrp::multi_usrp::make(device_args);

    // apply the default configuration
    usrp->set_rx_freq(uhd::tune_request_t(freq));
    usrp->set_rx_rate(sample_rate);
    usrp->set_rx_gain(gain);
    usrp->set_rx_antenna(antenna);

    // configure the RX streamer
    uhd::stream_args_t stream_args("fc32", "sc16");
    stream_args.channels = {0};
    uhd::rx_streamer::sptr rx_streamer = usrp->get_rx_stream(stream_args);
 
    // allocate RX buffer
    const size_t samps_per_buff = fft_size;
    uhd::rx_metadata_t md;
    std::vector<std::complex<float> > rx_buffer(samps_per_buff);

    // start streaming 
    uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
    stream_cmd.stream_now = true;
    stream_cmd.time_spec  = uhd::time_spec_t();
    rx_streamer->issue_stream_cmd(stream_cmd);

    /*
      receive loop
    */
    size_t total_received_samples = 0;
    size_t overflow_count = 0;
    while(true) {

      // get some samples
      size_t rx_sample_count = rx_streamer->recv(
          rx_buffer.data(), samps_per_buff, md, 0.1, false
      );

      // overflow
      if(md.error_code == uhd::rx_metadata_t::ERROR_CODE_OVERFLOW) {
        fprintf(stderr, "overflow %u\n", overflow_count);
        overflow_count++;
        continue;
      }

      // timeout
      else if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_TIMEOUT) {
        fprintf(stderr, "RECEIVE TIMEOUT @ %u; aborting\n", total_received_samples);
        break;
      }

      // unhandled error code
      else if (md.error_code != uhd::rx_metadata_t::ERROR_CODE_NONE){
        fprintf(stderr, "unhandled error in b2xx receive loop - %s\n", md.strerror().c_str());
        throw std::runtime_error(str(boost::format("unhandled error in b2xx receive loop - %s") % md.strerror()));
      }

      // convert to frequency domain      
      kiss_fft(cfg, (const kiss_fft_cpx *)rx_buffer.data(), (kiss_fft_cpx *)fft_out.data());

      // compute the power values (in dB), which are used by the client to draw the spectrogram
      buffer_offset = (buffer_offset + 1) % buffer_depth;
      for(int x = 0; x < fft_size; x++) {

        // calculate the green intensity for the configured dynamic range
        double v = 10 * std::log10(std::norm(fft_out[(x+fft_size/2) % fft_size]));
        v = std::max(range_low, v);
        v = std::min(range_high, v);
        v -= range_low;
        v = v * 255 / range;

        // update the corresponding pixel in the rgba buffer
        rgba_circular_buffer[(buffer_offset*fft_size+x)*4+1] = v;
      }

      total_received_samples += rx_sample_count;
    }
  }



  /*

  start the receiver event loop in a pthread

  */
  void start_b2xx_receiver() {

    // start the UHD event loop
    pthread_t thread;
    pthread_create(&thread, NULL, b2xx_receiver_loop, NULL); 
  }
}