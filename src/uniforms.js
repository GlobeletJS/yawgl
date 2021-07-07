import { createUniformSetter } from "./uniform-setter.js";

export function createUniformSetters(gl, program) {
  // Collect info about all the uniforms used by the program
  const uniformInfo = Array
    .from({ length: gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) })
    .map((v, i) => gl.getActiveUniform(program, i))
    .filter(info => info !== undefined);

  const textureTypes = [gl.SAMPLER_2D, gl.SAMPLER_CUBE];
  var textureUnit = 0;

  return uniformInfo.reduce((d, info) => {
    const { name, type, size } = info;
    const isArray = name.endsWith("[0]");
    const key = isArray ? name.slice(0, -3) : name;

    d[key] = createUniformSetter(gl, program, info, textureUnit);

    if (textureTypes.includes(type)) textureUnit += size;

    return d;
  }, {});
}
