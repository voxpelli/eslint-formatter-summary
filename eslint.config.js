import { voxpelli } from '@voxpelli/eslint-config';

export default voxpelli({
  noMocha: true,
  cliFiles: ['bin/**/*.js', 'lib/cli/cmd-*.js'],
});
