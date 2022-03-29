export function initAttributes(gl, program) {
  // Construct a dictionary of the locations of each attribute in the program
  const attrIndices = Array
    .from({ length: gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) })
    .map((v, i) => gl.getActiveAttrib(program, i).name)
    .reduce((d, n) => (d[n] = gl.getAttribLocation(program, n), d), {});

  // Construct a dictionary of functions to set a constant value for a given
  // vertex attribute, when a per-vertex buffer is not needed
  const constantSetters = Object.entries(attrIndices).reduce((d, [name, i]) => {
    d[name] = function(v) {
      gl.disableVertexAttribArray(i);
      const method = getConstMethod(v.length);
      if (method) gl[method](i, v);
    };
    return d;
  }, {});

  function getConstMethod(len) {
    if (len === undefined) return "vertexAttrib1f";
    if ([1, 2, 3, 4].includes(len)) return "vertexAttrib" + len + "fv";
  }

  function constructVao({ attributes, indices }) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    Object.entries(attributes).forEach(([name, a]) => {
      const index = attrIndices[name];
      if (index === undefined) return;

      gl.enableVertexAttribArray(index);
      gl.bindBuffer(gl.ARRAY_BUFFER, a.buffer);
      gl.vertexAttribPointer(
        index,                // index of attribute in program
        a.numComponents || a.size, // Number of elements to read per vertex
        a.type || gl.FLOAT,   // Type of each element
        a.normalize || false, // Whether to normalize it
        a.stride || 0,        // Byte spacing between vertices
        a.offset || 0         // Byte # to start reading from
      );
      gl.vertexAttribDivisor(index, a.divisor || 0);
    });

    if (indices) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices.buffer);

    gl.bindVertexArray(null);
    return vao;
  }

  return { constantSetters, constructVao };
}
