import nextConfig from 'eslint-config-next';

export default [
  ...nextConfig,
  {
    ignores: ['.next/', 'node_modules/', 'dist/'],
  },
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
];
