/*

enum libusb_error

*/
const LIBUSB_SUCCESS = 0;
const LIBUSB_ERROR_IO = -1;
const LIBUSB_ERROR_INVALID_PARAM = -2;
const LIBUSB_ERROR_ACCESS = -3;
const LIBUSB_ERROR_NO_DEVICE = -4;
const LIBUSB_ERROR_NOT_FOUND = -5;
const LIBUSB_ERROR_BUSY = -6;
const LIBUSB_ERROR_TIMEOUT = -7;
const LIBUSB_ERROR_OVERFLOW = -8;
const LIBUSB_ERROR_PIPE = -9;
const LIBUSB_ERROR_INTERRUPTED = -10;
const LIBUSB_ERROR_NO_MEM = -11;
const LIBUSB_ERROR_NOT_SUPPORTED = -12;
const LIBUSB_ERROR_OTHER = -99;



/*

enum libusb_transfer_status

*/
const LIBUSB_TRANSFER_COMPLETED = 0;
const LIBUSB_TRANSFER_ERROR = 1;
const LIBUSB_TRANSFER_TIMED_OUT = 2;
const LIBUSB_TRANSFER_CANCELLED = 3;
const LIBUSB_TRANSFER_STALL = 4;
const LIBUSB_TRANSFER_NO_DEVICE = 5;
const LIBUSB_TRANSFER_OVERFLOW = 6;



/*

misc libusb constants

*/
const LIBUSB_DEFAULT_CONTEXT = 0;
const LIBUSB_OPTION_LOG_LEVEL = 0;
const LIBUSB_DT_DEVICE = 1;
const LIBUSB_DEVICE_DESCRIPTOR_LENGTH = 18;
const LIBUSB_DESCRIPTOR_INDEX_MANUFACTURER = 1;
const LIBUSB_DESCRIPTOR_INDEX_PRODUCT = 2;
const LIBUSB_DESCRIPTOR_INDEX_SERIAL_NUMBER = 3;
const SIZEOF_LIBUSB_TRANSFER = 40;
const SIZEOF_LIBUSB_ISO_PACKET_DESCRIPTOR = 12;



/*

RPC function IDs

*/
const RPC_SET_USB_THREAD_ID = 100;
const RPC_GET_USB_DEVICE_COUNT = 101;
const RPC_SET_USB_DEVICE_HANDLE = 102;
const RPC_GET_USB_DEVICE_DESCRIPTOR = 200;
const RPC_OPEN_DEVICE = 201;
const RPC_CLOSE_DEVICE = 202;
const RPC_CLAIM_INTERFACE = 203;
const RPC_RELEASE_INTERFACE = 204;
const RPC_GET_STRING_DESCRIPTOR = 205;
const RPC_CONTROL_TRANSFER_IN = 206;
const RPC_CONTROL_TRANSFER_OUT = 207;
const RPC_BULK_TRANSFER_IN = 208;
const RPC_BULK_TRANSFER_OUT = 209;
const RPC_BULK_TRANSFER_IN_ASYNC = 210;
const RPC_BULK_TRANSFER_OUT_ASYNC = 211;
const RPC_SUBMIT_BULK_IN_TRANSFER = 212;
const RPC_SUBMIT_BULK_OUT_TRANSFER = 213;
const RPC_INIT_SESSION = 214;
const RPC_WAIT_FOR_RECONNECT = 215;
const RPC_REGISTER_TRANSFER_CALLBACK = 216;
const RPC_CANCEL_TRANSFER = 217;
const RPC_EVENT_BULK_IN = 1;
const RPC_EVENT_BULK_OUT = 2;



/*

struct libusb_transfer

*/
class libusb_transfer {

  constructor(ptr) {
    this.ptr = ptr;
    this.load(HEAP8.subarray(this.ptr, this.ptr+SIZEOF_LIBUSB_TRANSFER));
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
    Module._handle_completed_transfer(this.ptr);
  }

  handle_timeout() {
    this.actual_length = 0;
    this.status = LIBUSB_TRANSFER_TIMED_OUT;
    this.save(); 
    Module._handle_completed_transfer(this.ptr);
  }

  handle_failure() {
    this.actual_length = 0;
    this.status = LIBUSB_TRANSFER_ERROR;
    this.save();
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