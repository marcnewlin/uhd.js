window.config = {

  usrp: {
    freq: 2402e6,
    gain: 30,
    sample_rate: 2e6,
    antenna: "TX/RX",
  },

  waterfall: {

    // canvas 512
    width: 512,   /* fft size */
    height: 1024, /* circular buffer depth */

    // simple dynamic range for spectrogram rendering
    // - input data is clamped to [low, high]
    // - the power range maps linearly to [RGB(0,0,0), RGB(0,255,0)]
    dynamic_range: {
      low: -80,
      high: -20,
    }
  },
};


document.addEventListener("DOMContentLoaded", (e) => {

  const c = window.config;
  let w = document.getElementById("waterfall");
  w.setAttribute("width", `${c.waterfall.width}`);
  w.setAttribute("height", `${c.waterfall.height}`);

  /*

  print (display) the current configuration and intro message

  */
  function print_config() {
    const c = window.config;

    let rows = {
      "center frequency": `${(c.usrp.freq / 1e6)} MHz`,
      "sample rate": `${(c.usrp.sample_rate / 1e6)} MS/s`,
      "gain": `${c.usrp.gain}`,
      "antenna": `${c.usrp.antenna}`,
      "fft size": `${c.waterfall.width}`,
      "waterfall dynamic range": `[${c.waterfall.dynamic_range.low},${c.waterfall.dynamic_range.high}] dB`,
    };
  
    let val_max = Math.max(...(Object.values(rows).map(v => v.length)));
    let key_max = Math.max(...(Object.keys(rows).map(v => v.length)));
  
    let msg = `Welcome to the <a href="https://github.com/marcnewlin/uhd.js">uhd.js</a> waterfall-plot demo :)\n\n`+
              `Active Configuration:\n`+
              `${'-'.repeat(val_max + key_max + 6)}\n`;
    for(let k of Object.keys(rows)) {
      let line = `${k}: ${' '.repeat(key_max-k.length)}`+`${rows[k]}${' '.repeat(val_max-rows[k].length)}`;
      msg += `| ${line} |\n`;
    };
    msg += `${'-'.repeat(val_max + key_max + 6)}\n`;
  
    var tag = "<pre>" + msg + "</pre>";
  
    uhd_log("info", "config.js", tag);
  }

  print_config();

});