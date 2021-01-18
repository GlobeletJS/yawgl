export function initMipMapper(gl, target) {
  const isPowerOf2 = (v) => Math.log2(v) % 1 == 0;
  const setAnisotropy = setupAnisotropy(gl, target);

  return function({ mips = true, width, height }) {
    if (mips && isPowerOf2(width) && isPowerOf2(height)) {
      setAnisotropy();
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(target);
    } else {
      // WebGL1 can't handle mipmapping for non-power-of-2 images
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  };
}

function setupAnisotropy(gl, target) {
  const ext = (
    gl.getExtension('EXT_texture_filter_anisotropic') ||
    gl.getExtension('MOZ_EXT_texture_filter_anisotropic') || 
    gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
  );
  if (!ext) return () => undefined;

  const maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
  const pname = ext.TEXTURE_MAX_ANISOTROPY_EXT;

  // BEWARE: this texParameterf call is slow on Intel integrated graphics.
  return () => gl.texParameterf(target, pname, maxAnisotropy);
}
