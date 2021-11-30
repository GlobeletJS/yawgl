export function initMipMapper(gl, target) {
  const setAnisotropy = setupAnisotropy(gl, target);

  return function({ mips = true }) {
    if (mips) {
      setAnisotropy();
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(target);
    } else {
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  };
}

function setupAnisotropy(gl, target) {
  const ext = gl.getExtension("EXT_texture_filter_anisotropic");
  if (!ext) return () => undefined;

  const maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
  const pname = ext.TEXTURE_MAX_ANISOTROPY_EXT;

  // BEWARE: this texParameterf call is slow on Intel integrated graphics.
  return () => gl.texParameterf(target, pname, maxAnisotropy);
}
