import { setupMipMaps, setTextureAnisotropy } from "./tex-utils.js";

export function initTexture(gl, width, height) {
  // Initializes a 2D texture object, extending the default gl.createTexture()
  // The GL context and the binding target are implicitly saved in the closure.
  // Returns the sampler (as a property) along with update and replace methods.
  // Input data is an ImageData object

  const target = gl.TEXTURE_2D;
  const texture = gl.createTexture();
  gl.bindTexture(target, texture);

  // Initialize with default parameters
  const level = 0;  // Mipmap level
  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const border = 0;

  gl.texImage2D(target, level, internalFormat, width, height, border,
      srcFormat, srcType, null);

  // Set up mipmapping and anisotropic filtering, if appropriate
  setupMipMaps(gl, target, width, height);
  setTextureAnisotropy(gl, target);

  return {
    sampler: texture,
    replace,
    update,
  }

  function replace( image ) {
    // Replaces the texture with the supplied image data
    // WARNING: will change texture width/height to match the image
    gl.bindTexture(target, texture);
    gl.texImage2D(target, level, internalFormat, srcFormat, srcType, image);

    // Re-do mipmap setup, since width/height may have changed
    setupMipMaps(gl, target, image.width, image.height);
    return;
  }

  function update( image ) {
    // Updates a portion of the texture with the supplied image data.
    gl.bindTexture(target, texture);

    // Image will be written starting from the pixel (xoffset, yoffset).
    // If these values are not set on the input, use (0,0)
    var xoff = image.xoffset || 0;
    var yoff = image.yoffset || 0;
    gl.texSubImage2D(target, level, xoff, yoff, srcFormat, srcType, image);

    setupMipMaps(gl, target, image.width, image.height);
    return;
  }
}

export function loadTexture(gl, url, callBack) {
  // Initialize a single-pixel image to use before the supplied image loads
  const width = 1;
  const height = 1;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  const dummy = new ImageData(width, height, pixel);

  const texture = initTexture(gl, dummy);

  // Load image asynchronously from supplied URL
  const image = new Image();
  image.onload = function () {
    texture.replace(image);
    callBack();
  };
  image.src = url;

  return texture.sampler;
}
