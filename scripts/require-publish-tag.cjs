'use strict';

/* global console, process */

const {publishConfig} = require('../package.json');

const expectedTag = publishConfig && publishConfig.tag;
const actualTag = process.env.npm_config_tag;

if (actualTag !== expectedTag) {
  console.error(
      `Refusing to publish: use \`npm publish --tag ${expectedTag}\` for this release line.`,
  );
  process.exitCode = 1;
}
