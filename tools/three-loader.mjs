// Node module-resolution hook: map the browser import-map specifiers
// ("three", "three/addons/...") to the vendored files.
export async function resolve(specifier, context, next) {
  if (specifier === 'three') {
    return { url: new URL('../vendor/three/build/three.module.min.js', import.meta.url).href, shortCircuit: true };
  }
  if (specifier.startsWith('three/addons/')) {
    return { url: new URL(`../vendor/three/addons/${specifier.slice('three/addons/'.length)}`, import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
