import {registerHooks} from 'node:module';
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier === 'react-native' || specifier === 'react') return {url: new URL('./native-mock.mjs', import.meta.url).href, shortCircuit: true};
  return nextResolve(specifier, context);
}});
