#include <stdio.h>
#include <pthread.h>
#include <iostream>


extern "C" {

  void print_exception(std::exception * error) 
  {
    std::cout << "print_exception(" << error << ")" << std::endl;
    std::cout << error->what() << std::endl;
  }

  void start_libusb_shim();
  void start_b2xx_receiver();

  int main()
  {
    setenv("UHD_IMAGES_DIR", "/images", true);
    start_libusb_shim();
    start_b2xx_receiver();
  }
}

