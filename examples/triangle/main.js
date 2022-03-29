import { initContext } from "../..";
import vert from "./vert.glsl";
import frag from "./frag.glsl";

export function main() {
  const context = initContext(document.getElementById("canvas"));
  context.resizeCanvasToDisplaySize();
  context.gl.pixelStorei(context.gl.UNPACK_ALIGNMENT, 1);
  context.gl.pixelStorei(context.gl.PACK_ALIGNMENT, 1);

  const program = context.initProgram(vert, frag);

  context.bindFramebufferAndSetViewport();
  context.clear([0.0, 1.0, 1.0, 1.0]);

  const attributes = {
    position: context.initAttribute({
      data: new Float32Array([-0.9, 0.0, 0.0, -0.9, 0.8, 0.8]),
      numComponents: 2,
      divisor: 0,
    }),
  };
  const indices = context.initIndices({
    data: new Uint32Array([0, 1, 2]),
  });

  program.use();
  const vao = program.constructVao({ attributes, indices });
  program.uniformSetters.fillColor([1.0, 1.0, 0.0, 1.0]);
  program.uniformSetters.fillOpacity(0.75);
  context.draw({ vao, indices, count: 3 });
}
