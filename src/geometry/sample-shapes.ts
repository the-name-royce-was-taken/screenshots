// Analytic object SDFs for the built-in sample shapes, in millimetres.
//
// Negative inside, positive outside, exact Euclidean distance outside every
// shape (and exact or a lower bound inside), so |sdf| at a point on or outside
// the surface is its distance to the shape in mm.
//
// This module is the single source of the sample-shape primitives, dimensions
// and generation bounds: the lattice builders, the generation and tile
// workers, sparse tile skipping, and validation all evaluate these functions.
import type { SampleShape } from '../types/project';
import type { Vec3 } from './vec3';

export type ObjectSdf = (x: number, y: number, z: number) => number;

/** Fallback sphere radius used whenever the stored radius is unset or zero. */
export const DEFAULT_SAMPLE_SPHERE_RADIUS = 25;

/** Fixed dimensions of the non-sphere samples. */
export const SAMPLE_SHAPE_DIMENSIONS = {
  cube: { halfSize: 15 },
  cylinder: { radius: 15, halfHeight: 20 },
  torus: { majorRadius: 20, tubeRadius: 8 },
  capsule: { radius: 12, halfHeight: 15 },
} as const;

export function sampleSphereRadius(sphereRadius: number): number {
  return sphereRadius || DEFAULT_SAMPLE_SPHERE_RADIUS;
}

/** Sphere centred at the origin. */
export function sphereSdf(radius: number): ObjectSdf {
  return (x, y, z) => Math.sqrt(x * x + y * y + z * z) - radius;
}

/** Axis-aligned cube centred at the origin. */
export function cubeSdf(halfSize: number, halfHeight = halfSize): ObjectSdf {
  return (x, y, z) => {
    const dx = Math.abs(x) - halfSize;
    const dy = Math.abs(y) - halfSize;
    const dz = Math.abs(z) - halfHeight;
    const outside = Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2 + Math.max(dz, 0) ** 2);
    const inside = Math.min(Math.max(dx, dy, dz), 0);
    return outside + inside;
  };
}

/** Capped cylinder along z, centred at the origin. */
export function cylinderSdf(radius: number, halfHeight: number): ObjectSdf {
  return (x, y, z) => {
    const dRadial = Math.sqrt(x * x + y * y) - radius;
    const dAxial = Math.abs(z) - halfHeight;
    const outside = Math.sqrt(Math.max(dRadial, 0) ** 2 + Math.max(dAxial, 0) ** 2);
    const inside = Math.min(Math.max(dRadial, dAxial), 0);
    return outside + inside;
  };
}

/** Torus in the xy plane, centred at the origin. */
export function torusSdf(majorRadius: number, tubeRadius: number): ObjectSdf {
  return (x, y, z) => {
    const qx = Math.sqrt(x * x + y * y) - majorRadius;
    return Math.sqrt(qx * qx + z * z) - tubeRadius;
  };
}

/** Capsule along z: a cylinder body of half-height `halfHeight` with hemispherical caps. */
export function capsuleSdf(radius: number, halfHeight: number): ObjectSdf {
  return (x, y, z) => {
    // Clamp z to the cylinder body, then measure distance to that clamped point.
    const cz = Math.max(-halfHeight, Math.min(halfHeight, z));
    return Math.sqrt(x * x + y * y + (z - cz) * (z - cz)) - radius;
  };
}

export interface SampleShapeDimensions {
  sphereDiameter: number;
  cubeWidth: number;
  cubeHeight: number;
  cylinderDiameter: number;
  cylinderHeight: number;
  torusInnerDiameter: number;
  torusOuterDiameter: number;
}

export const DEFAULT_SAMPLE_SHAPE_DIMENSIONS: SampleShapeDimensions = {
  sphereDiameter: 50, cubeWidth: 30, cubeHeight: 30,
  cylinderDiameter: 30, cylinderHeight: 40,
  torusInnerDiameter: 24, torusOuterDiameter: 56,
};

export function sampleShapeObjectSdf(shape: SampleShape, sphereRadius: number, dimensions?: SampleShapeDimensions): ObjectSdf {
  const dims = dimensions ?? DEFAULT_SAMPLE_SHAPE_DIMENSIONS;
  switch (shape) {
    case 'sphere':
      return sphereSdf(dimensions ? dims.sphereDiameter / 2 : sampleSphereRadius(sphereRadius));
    case 'cube':
      return cubeSdf(dims.cubeWidth / 2, dims.cubeHeight / 2);
    case 'cylinder': {
      const radius = dims.cylinderDiameter / 2;
      const halfHeight = dims.cylinderHeight / 2;
      return cylinderSdf(radius, halfHeight);
    }
    case 'torus': {
      const majorRadius = (dims.torusOuterDiameter + dims.torusInnerDiameter) / 4;
      const tubeRadius = (dims.torusOuterDiameter - dims.torusInnerDiameter) / 4;
      return torusSdf(majorRadius, tubeRadius);
    }
    case 'capsule': {
      const { radius, halfHeight } = SAMPLE_SHAPE_DIMENSIONS.capsule;
      return capsuleSdf(radius, halfHeight);
    }
  }
}

/** Generation grid bounds: the shape's bounding box grown by `pad` mm on every side. */
export function sampleShapeBounds(
  shape: SampleShape,
  sphereRadius: number,
  pad: number,
  dimensions?: SampleShapeDimensions,
): { min: Vec3; max: Vec3 } {
  switch (shape) {
    case 'sphere': {
      const r = (dimensions ? dimensions.sphereDiameter / 2 : sampleSphereRadius(sphereRadius)) + pad;
      return { min: [-r, -r, -r], max: [r, r, r] };
    }
    case 'cube': {
      const x = dimensions.cubeWidth / 2 + pad;
      const z = dimensions.cubeHeight / 2 + pad;
      return { min: [-x, -x, -z], max: [x, x, z] };
    }
    case 'cylinder': {
      const xy = dimensions.cylinderDiameter / 2 + pad;
      const z = dimensions.cylinderHeight / 2 + pad;
      return { min: [-xy, -xy, -z], max: [xy, xy, z] };
    }
    case 'torus': {
      const xy = dimensions.torusOuterDiameter / 2 + pad;
      const z = (dimensions.torusOuterDiameter - dimensions.torusInnerDiameter) / 4 + pad;
      return { min: [-xy, -xy, -z], max: [xy, xy, z] };
    }
    case 'capsule': {
      const { radius, halfHeight } = SAMPLE_SHAPE_DIMENSIONS.capsule;
      const xy = radius + pad;
      const z = halfHeight + radius + pad;
      return { min: [-xy, -xy, -z], max: [xy, xy, z] };
    }
  }
}

/**
 * Largest bounding-box extent (mm) of a sample shape; no shape (null) falls
 * back to the sphere, matching the generation worker. Used to size sampling
 * voxels from the export resolution.
 */
export function sampleShapeMaxSpan(shape: SampleShape | null, sphereRadius: number): number {
  const { min, max } = sampleShapeBounds(shape ?? 'sphere', sphereRadius, 0);
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}
