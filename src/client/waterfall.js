/*

draw a frame of the waterfall animation (via window.requestAnimationFrame)

*/
window.draw_waterfall = function() {
  const width = config.waterfall.width;
  const height = config.waterfall.height;

  // get the 2D rendering context
  let waterfall = document.getElementById("waterfall");
  let ctx = waterfall.getContext("2d");

  // populate image data from the heap-backed rgba data
  let clamped = new Uint8ClampedArray(window.waterfall_rgba);
  let data = new ImageData(clamped, width, height);

  // draw the image data, offset with the circular buffer
  let row_offset = Module._row_offset();
  ctx.putImageData(data, 0, row_offset);
  ctx.putImageData(data, 0, row_offset-height);

  // queue the next frame
  window.requestAnimationFrame(window.draw_waterfall);
};



/*

start the waterfall animation

*/
function start_waterfall() {
  const width = config.waterfall.width;
  const height = config.waterfall.height;

  // create a view of the rgba heap buffer
  let buffer_offset = Module._rgba_buffer(); 
  window.waterfall_rgba = HEAPU8.subarray(buffer_offset, buffer_offset+(width*height*4));

  // start the animation loop
  window.requestAnimationFrame(window.draw_waterfall);
}