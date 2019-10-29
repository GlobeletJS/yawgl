export function createUniformSetters(gl, program) {
  // Very similar to greggman's module:
  // webglfundamentals.org/docs/module-webgl-utils.html#.createUniformSetters

  var uniformSetters = {};
  var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

  // Track texture bindpoint index in case multiple textures are required
  var textureUnit = 0;

  for (let i = 0; i < numUniforms; i++) {
    var uniformInfo = gl.getActiveUniform(program, i);
    if (!uniformInfo) break;

    var name = uniformInfo.name;
    // remove the array suffix added by getActiveUniform
    if (name.substr(-3) === "[0]") name = name.substr(0, name.length - 3);

    var setter = createUniformSetter(program, uniformInfo);
    uniformSetters[name] = setter;
  }
  return uniformSetters;

  // This function must be nested to access the textureUnit index
  function createUniformSetter(program, uniformInfo) {
    var loc = gl.getUniformLocation(program, uniformInfo.name);
    var isArray = (uniformInfo.size > 1 && uniformInfo.name.substr(-3) === "[0]");
    var type = uniformInfo.type;
    switch (type) {
      case gl.FLOAT:
        return (isArray)
          ? (v) => gl.uniform1fv(loc, v)
          : (v) => gl.uniform1f(loc, v);
      case gl.FLOAT_VEC2:
        return (v) => gl.uniform2fv(loc, v);
      case gl.FLOAT_VEC3:
        return (v) => gl.uniform3fv(loc, v);
      case gl.FLOAT_VEC4:
        return (v) => gl.uniform4fv(loc, v);
      case gl.INT:
        return (isArray)
          ? (v) => gl.uniform1iv(loc, v)
          : (v) => gl.uniform1i(loc, v);
      case gl.INT_VEC2:
        return (v) => gl.uniform2iv(loc, v);
      case gl.INT_VEC3:
        return (v) => gl.uniform3iv(loc, v);
      case gl.INT_VEC4:
        return (v) => gl.uniform4iv(loc, v);
      case gl.BOOL:
        return (v) => gl.uniform1iv(loc, v);
      case gl.BOOL_VEC2:
        return (v) => gl.uniform2iv(loc, v);
      case gl.BOOL_VEC3:
        return (v) => gl.uniform3iv(loc, v);
      case gl.BOOL_VEC4:
        return (v) => gl.uniform4iv(loc, v);
      case gl.FLOAT_MAT2:
        return (v) => gl.uniformMatrix2fv(loc, false, v);
      case gl.FLOAT_MAT3:
        return (v) => gl.uniformMatrix3fv(loc, false, v);
      case gl.FLOAT_MAT4:
        return (v) => gl.uniformMatrix4fv(loc, false, v);
      case gl.SAMPLER_2D:
      case gl.SAMPLER_CUBE:
        if (isArray) {
          var units = Array.from(Array(uniformInfo.size), () => textureUnit++);
          return function(bindPoint, units) {
            return function(textures) {
              gl.uniform1iv(loc, units);
              textures.forEach( function(texture, index) {
                gl.activeTexture(gl.TEXTURE0 + units[index]);
                gl.bindTexture(bindPoint, texture);
              });
            };
          }(getBindPointForSamplerType(gl, type), units);
        } else {
          return function(bindPoint, unit) {
            return function(texture) {
              //gl.uniform1i(loc, units); // Typo? How did it even work?
              gl.uniform1i(loc, unit);
              gl.activeTexture(gl.TEXTURE0 + unit);
              gl.bindTexture(bindPoint, texture);
            };
          }(getBindPointForSamplerType(gl, type), textureUnit++);
        }
     default:  // we should never get here
        throw("unknown type: 0x" + type.toString(16));
    }
  }
}

function getBindPointForSamplerType(gl, type) {
  if (type === gl.SAMPLER_2D)   return gl.TEXTURE_2D;
  if (type === gl.SAMPLER_CUBE) return gl.TEXTURE_CUBE_MAP;
  return undefined;
}

export function setUniforms(setters, values) {
  Object.keys(values).forEach( function(name) {
    var setter = setters[name];
    if (setter) setter(values[name]);
  });
}
