import { defineConfig } from 'tsdown';
import { getCommonConfig } from '../../tsdown.config.common.ts';

const { configBase } = getCommonConfig(import.meta.dirname);

export default defineConfig(configBase);
