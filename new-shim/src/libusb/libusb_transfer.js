/*

struct libusb_transfer

*/
class libusb_transfer {

  constructor(ptr, data) {

    if(ptr !== undefined && data === undefined) {
      this.ptr = ptr;
      this.load(HEAP8.subarray(this.ptr, this.ptr+SIZEOF_LIBUSB_TRANSFER));
    }

    else {
      this.ptr = 0;
      this.load(data);
    }
  }

  save() {
    writeArrayToMemory(this.u8, this.ptr);
  }

  load(data) {
    this.u8 = new Uint8Array(data); 
    this.u32 = new Uint32Array(this.u8.buffer);
    this.i32 = new Int32Array(this.u8.buffer);
  }

  handle_completed(length) {
    this.actual_length = length;
    this.status = LIBUSB_TRANSFER_COMPLETED;
    this.save();
    // console.error("HANDLE COMPLETED");
    // console.error(this);
    Module._handle_completed_transfer(this.ptr);
  }

  handle_timeout() {
    this.actual_length = 0;
    this.status = LIBUSB_TRANSFER_TIMED_OUT;
    this.save();
    // console.error("HANDLE TIMEOUT");
    // console.error(this);    
    Module._handle_completed_transfer(this.ptr);
  }

  handle_failure() {
    this.actual_length = 0;
    this.status = LIBUSB_TRANSFER_ERROR;
    this.save();
    // console.error("HANDLE FAILURE");
    // console.error(this);    
    Module._handle_completed_transfer(this.ptr);
  }  

  /*
  libusb_device_handle *dev_handle;
  */
  get dev_handle() { return this.i32[0]; }
  set dev_handle(value) { this.i32[0] = value; this.save(); }

  /*
  uint8_t flags;
  */
  get flags() { return this.u8[4]; }
  set flags(value) { this.u8[4] = value; }

  /*
  unsigned char endpoint;
  */
  get endpoint() { return this.u8[5]; }
  set endpoint(value) { this.u8[5] = value; }

  /*
  unsigned char type;
  */
  get type() { return this.u8[6]; }
  set type(value) { this.u8[6] = value; }

  /*
  unsigned int timeout;
  */
  get timeout() { return this.u32[2]; }
  set timeout(value) { this.u32[2] = value; }
   
  /*
  enum libusb_transfer_status status;
  */
  get status() { return this.u32[3]; }
  set status(value) { this.u32[3] = value; }

  /*
  int length;
  */
  get length() { return this.i32[4]; }
  set length(value) { this.i32[4] = value; }

  /*
  int actual_length;
  */
  get actual_length() { return this.i32[5]; }
  set actual_length(value) { this.i32[5] = value; }

  /*
  libusb_transfer_cb_fn callback;
  */
  get callback() { return this.i32[6]; }
  set callback(value) { this.i32[6] = value; }

  /*
  void *user_data;
  */
  get user_data() { return this.i32[7]; }
  set user_data(value) { this.i32[7] = value; }

  /*
  unsigned char *buffer;
  */
  get buffer() { return this.i32[8]; }
  set buffer(value) { this.i32[8] = value; }

  /*
  int num_iso_packets;
  */
  get num_iso_packets() { return this.i32[9]; }
  set num_iso_packets(value) { this.i32[9] = value; }

  /*
  struct libusb_iso_packet_descriptor iso_packet_desc[ZERO_SIZED_ARRAY];
  
  NOT IMPLEMENTED
  */
}