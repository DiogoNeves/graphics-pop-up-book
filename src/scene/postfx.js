import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, directionToColor, colorToDirection, sample, vec3, vec4, mix, float } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';

const AO_STRENGTH = 1;

// Scene pass + ground-truth ambient occlusion: soft contact shadows where pieces meet the
// page and the table, without changing the flat colours themselves. GTAO needs a
// single-sampled depth buffer, so anti-aliasing comes from SMAA at the end instead of MSAA.
export function createPipeline(renderer, scene, camera) {
  const pipeline = new THREE.RenderPipeline(renderer);
  const scenePass = pass(scene, camera, { samples: 0 });
  scenePass.setMRT(mrt({ output, normal: directionToColor(normalView) }));
  scenePass.getTexture('normal').type = THREE.UnsignedByteType;

  const color = scenePass.getTextureNode('output');
  const depth = scenePass.getTextureNode('depth');
  const normalTex = scenePass.getTextureNode('normal');
  const normal = sample((uv) => colorToDirection(normalTex.sample(uv)));

  const aoPass = ao(depth, normal, camera);
  aoPass.resolutionScale = 0.5;
  aoPass.radius.value = 0.6;
  aoPass.distanceExponent.value = 1.5;
  aoPass.thickness.value = 1;
  aoPass.scale.value = 1.15;
  aoPass.samples.value = 12;
  const occlusion = denoise(aoPass.getTextureNode(), depth, normal, camera).r;

  const shaded = color.mul(vec4(vec3(mix(float(1), occlusion, AO_STRENGTH)), 1));
  pipeline.outputNode = smaa(shaded);
  return pipeline;
}
